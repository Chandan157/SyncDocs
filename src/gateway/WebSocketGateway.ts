import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { db } from '../../db/index';
import { documents, operations } from '../../db/schema';
import { eq, desc, and, gte, asc } from 'drizzle-orm';
import { OTEngine, ClientOperation } from '../ot/OperationalTransformation';
export class OTWebSocketGateway {
  private wss: WebSocket.Server;
  private activeDocuments: Map<string, {
    content: string;
    revision: number;
    connections: Set<WebSocket>;
    presence: Map<string, any>; 
  }> = new Map();
  constructor(server: any) {
    this.wss = new WebSocket.Server({ server });
    this.init();
    setInterval(() => this.autosaveAll(), 5000);
  }
  private init() {
    this.wss.on('connection', async (ws: any, req: any) => {
      const token = new URLSearchParams(req.url?.split('?')[1]).get('token');
      if (!token) return ws.close(1008, 'Unauthorized');
      let userId = '';
      try {
        const decoded = jwt.decode(token) as any;
        userId = decoded.sub;
      } catch(e) {
        return ws.close(1008, 'Invalid token');
      }
      ws.userId = userId;
      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch(e) {
          console.error('[WebSocket] Error processing message:', e);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Internal Server Error' }));
          }
        }
      });
      ws.on('close', () => {
        this.handleLeave(ws);
      });
    });
  }
  private async handleMessage(ws: any, data: any) {
    switch (data.type) {
      case 'join-document':
        await this.handleJoin(ws, data.documentId);
        break;
      case 'leave-document':
        this.handleLeave(ws);
        break;
      case 'operation':
        await this.handleOperation(ws, data);
        break;
      case 'cursor-update':
        this.broadcast(ws.documentId, { type: 'cursor-updated', ...data }, ws);
        break;
      case 'save-document':
        await this.autosave(ws.documentId);
        ws.send(JSON.stringify({ type: 'document-saved' }));
        break;
    }
  }
  private async handleJoin(ws: any, documentId: string) {
    try {
      ws.documentId = documentId;
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, documentId),
        with: {
          members: {
            where: (members, { eq }) => eq(members.userId, ws.userId)
          }
        }
      });
      if (!doc) return ws.send(JSON.stringify({ type: 'error', message: 'Document not found' }));
      const isOwner = doc.ownerId === ws.userId;
      const memberRecord = doc.members?.[0];
      const role = isOwner ? 'owner' : (memberRecord?.role || null);
      if (!role) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }));
      }
      ws.role = role; 
      if (!this.activeDocuments.has(documentId)) {
        this.activeDocuments.set(documentId, {
          content: doc.content || '',
          revision: doc.revision || 0,
          connections: new Set(),
          presence: new Map()
        });
      }
      const docState = this.activeDocuments.get(documentId)!;
      docState.connections.add(ws);
      ws.send(JSON.stringify({
        type: 'document-loaded',
        content: docState.content,
        revision: docState.revision,
        role: ws.role
      }));
      this.broadcast(documentId, { type: 'user-joined', userId: ws.userId }, ws);
    } catch (e) {
      console.error('[WebSocket] Error in handleJoin:', e);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal Server Error' }));
    }
  }
  private handleLeave(ws: any) {
    if (!ws.documentId) return;
    const docState = this.activeDocuments.get(ws.documentId);
    if (docState) {
      docState.connections.delete(ws);
      if (docState.connections.size === 0) {
        this.autosave(ws.documentId).then(() => {
          this.activeDocuments.delete(ws.documentId);
        });
      } else {
        this.broadcast(ws.documentId, { type: 'user-left', userId: ws.userId }, ws);
      }
    }
  }
  private async handleOperation(ws: any, data: ClientOperation) {
    if (ws.role === 'viewer') {
      console.warn(`[SECURITY] Blocked state update from Viewer ${ws.userId}`);
      return; 
    }
    const documentId = ws.documentId;
    const docState = this.activeDocuments.get(documentId);
    if (!docState) return;
    let incomingOp = data.operation;
    if (data.revision < docState.revision) {
      const pastOps = await db.query.operations.findMany({
        where: and(
          eq(operations.documentId, documentId),
          gte(operations.revision, data.revision + 1)
        ),
        orderBy: [asc(operations.revision)]
      });
      for (const pastOp of pastOps) {
        const storedOp = pastOp.operationJSON as any;
        incomingOp = OTEngine.transform(incomingOp, storedOp);
      }
    }
    docState.content = OTEngine.apply(docState.content, incomingOp);
    docState.revision += 1;
    try {
      await db.insert(operations).values({
        documentId,
        revision: docState.revision,
        clientId: data.clientId,
        operationJSON: incomingOp
      });
    } catch (e) {
      console.error(`[Operation] Failed to persist operation for doc ${documentId} (offline?):`, e);
    }
    const ackPayload = {
      type: 'operation-applied',
      revision: docState.revision,
      operation: incomingOp,
      clientId: data.clientId
    };
    this.broadcast(documentId, ackPayload);
  }
  private broadcast(documentId: string, payload: any, excludeWs?: any) {
    const docState = this.activeDocuments.get(documentId);
    if (!docState) return;
    const msg = JSON.stringify(payload);
    docState.connections.forEach(client => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
  private async autosave(documentId: string) {
    const docState = this.activeDocuments.get(documentId);
    if (!docState) return;
    try {
      await db.update(documents)
        .set({ content: docState.content, revision: docState.revision, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
    } catch (e) {
      console.error(`[Autosave] Failed to autosave document ${documentId} (offline?):`, e);
    }
  }
  private async autosaveAll() {
    for (const [docId, state] of this.activeDocuments.entries()) {
      await this.autosave(docId);
    }
  }
}
