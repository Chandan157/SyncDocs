import { pgTable, uuid, text, timestamp, jsonb, integer, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
export const roleEnum = pgEnum('role', ['owner', 'editor', 'viewer']);
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull().default('Untitled Document'),
  content: text('content').notNull().default(''), 
  revision: integer('revision').notNull().default(0), 
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const documentMembers = pgTable('document_members', {
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: roleEnum('role').notNull().default('viewer'),
}, (t) => ({
  pk: primaryKey({ columns: [t.documentId, t.userId] })
}));
export const operations = pgTable('operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  revision: integer('revision').notNull(), 
  clientId: text('client_id').notNull(), 
  operationJSON: jsonb('operation_json').notNull(), 
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const documentMembersRelations = relations(documentMembers, ({ one }) => ({
  document: one(documents, {
    fields: [documentMembers.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentMembers.userId],
    references: [users.id],
  }),
}));
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  memberships: many(documentMembers),
}));
export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
  members: many(documentMembers),
  operations: many(operations),
}));
