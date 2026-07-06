import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { db } from './db/index';

async function test() {
  const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-local-dev';
  const user = await db.query.users.findFirst();
  const token = jwt.sign({ sub: user.id, email: user.email }, secretKey, { expiresIn: '7d' });
  
  const doc = await db.query.documents.findFirst({ where: (d, {eq}) => eq(d.ownerId, user.id) });
  
  const ws = new WebSocket(`ws://localhost:1234?token=${token}`);
  
  ws.on('open', () => {
    console.log("Connected to WS");
    ws.send(JSON.stringify({ type: 'join-document', documentId: doc.id }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Received:", msg.type);
    
    if (msg.type === 'document-loaded') {
      console.log("Sending operation...");
      ws.send(JSON.stringify({
        type: 'operation',
        revision: msg.revision,
        operation: { type: 'replace', position: 0, text: '<p>Testing Save ' + Date.now() + '</p>' },
        clientId: 'test-client'
      }));
    }
    
    if (msg.type === 'operation-applied') {
      console.log("Operation applied! Exiting.");
      process.exit(0);
    }
  });
  
  ws.on('error', (err) => console.error("WS Error:", err));
}

test();
