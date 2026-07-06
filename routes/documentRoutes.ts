import { Router } from 'express';
import { getDocuments, createDocument, getDocumentById, getDocumentMembers, shareDocument, updateDocument } from '../controllers/documentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all document routes
router.use(authenticate);

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', getDocumentById);
router.get('/:id/members', getDocumentMembers);
router.put('/:id', updateDocument);
router.post('/:id/share', shareDocument);

export default router;
