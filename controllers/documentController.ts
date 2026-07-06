import type { Request, Response } from 'express';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    const ownedDocs = await db.query.documents.findMany({
      where: eq(documents.ownerId, userId),
      orderBy: (documents, { desc }) => [desc(documents.updatedAt)],
    });

    // We can merge this or use a more complex query in production.
    res.json(ownedDocs);
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
