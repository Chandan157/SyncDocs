import { InferSelectModel } from 'drizzle-orm';
import { documents } from '../db/schema';

export type Document = InferSelectModel<typeof documents>;

export type DocumentResponse = Document & {
  isShared?: boolean;
  role?: string;
};
