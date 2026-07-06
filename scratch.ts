import 'dotenv/config';
import { db } from './db';
import { documentMembers } from './db/schema';
async function test() {
  try {
    await db.insert(documentMembers)
      .values({
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'editor'
      })
      .onConflictDoUpdate({
        target: [documentMembers.documentId, documentMembers.userId],
        set: { role: 'editor' }
      });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
test();
