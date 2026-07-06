import { Router } from 'express';
import { getDocuments, createDocument, getDocumentById } from '../controllers/documentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all document routes
router.use(authenticate);

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', getDocumentById);

export default router;
