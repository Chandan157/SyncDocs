import type { Request, Response } from 'express';
import { db } from '../db';
import { documents, documentMembers, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { DocumentResponse } from '../types';

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub; // Assuming JWT subject is user ID
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Tenant Isolation: Only get docs owned by user OR where user is a member
    // Since Drizzle query builder makes OR conditions on relations tricky,
    // we query documentMembers and owned documents separately or use SQL operator
    const ownedDocs: DocumentResponse[] = await db.query.documents.findMany({
      where: eq(documents.ownerId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)],
    });

    const sharedMemberRecords = await db.query.documentMembers.findMany({
      where: eq(documentMembers.userId, userId),
      with: {
        document: true
      }
    });

    const sharedDocs: DocumentResponse[] = sharedMemberRecords.map(m => ({
      ...m.document,
      isShared: true,
      role: m.role
    }));

    // Merge and sort by updatedAt desc
    const allDocs: DocumentResponse[] = [...ownedDocs, ...sharedDocs].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    res.json(allDocs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createDocument = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title } = req.body;
    
    const newDoc = await db.insert(documents).values({
      title: title || 'Untitled Document',
      ownerId: userId,
    }).returning();

    res.status(201).json(newDoc[0]);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    
    // Strict ORM Scoping (Tenant Isolation)
    // Only return document if the user is the owner OR a member
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      with: {
        members: {
          where: (members, { eq }) => eq(members.userId, userId)
        }
      }
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Authorization Check: Must be owner or have a membership record
    const isOwner = doc.ownerId === userId;
    const isMember = doc.members && doc.members.length > 0;

    if (!isOwner && !isMember) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this document' });
      return;
    }

    // Remove members array before sending to client for privacy
    const { members, ...safeDoc } = doc;
    res.json(safeDoc);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDocumentMembers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      with: {
        members: {
          where: (members, { eq }) => eq(members.userId, userId)
        }
      }
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const isOwner = doc.ownerId === userId;
    const isMember = doc.members && doc.members.length > 0;

    if (!isOwner && !isMember) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this document' });
      return;
    }

    const membersList = await db.query.documentMembers.findMany({
      where: eq(documentMembers.documentId, id),
      with: {
        user: true
      }
    });

    const result = membersList.map(m => ({
      userId: m.userId,
      email: m.user?.email,
      role: m.role
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching document members:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const shareDocument = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required' });
      return;
    }

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id)
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (doc.ownerId !== userId) {
      res.status(403).json({ error: 'Only the owner can share this document' });
      return;
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User with this email not found' });
      return;
    }

    if (targetUser.id === userId) {
      res.status(400).json({ error: 'You cannot share a document with yourself' });
      return;
    }

    if (role === 'remove') {
      await db.delete(documentMembers).where(
        and(
          eq(documentMembers.documentId, id),
          eq(documentMembers.userId, targetUser.id)
        )
      );
      res.json({ success: true, message: 'User access removed' });
      return;
    }

    if (!['viewer', 'editor'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    await db.insert(documentMembers)
      .values({
        documentId: id,
        userId: targetUser.id,
        role: role as 'viewer' | 'editor'
      })
      .onConflictDoUpdate({
        target: [documentMembers.documentId, documentMembers.userId],
        set: { role: role as 'viewer' | 'editor' }
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sharing document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
      with: {
        members: {
          where: (members, { eq }) => eq(members.userId, userId)
        }
      }
    });

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const isOwner = doc.ownerId === userId;
    const isEditor = doc.members && doc.members.some(m => m.role === 'editor');

    if (!isOwner && !isEditor) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to edit this document' });
      return;
    }

    const updatedDoc = await db.update(documents)
      .set({ title, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();

    res.json(updatedDoc[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
