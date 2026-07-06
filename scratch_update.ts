import 'dotenv/config';
import { db } from './db/index';
import { documents } from './db/schema';
import { eq } from 'drizzle-orm';

async function testUpdate() {
  try {
    const allDocs = await db.query.documents.findMany();
    if (allDocs.length === 0) {
      console.log('No docs to update');
      return;
    }
    const docId = allDocs[0].id;
    console.log('Updating doc:', docId, 'Current title:', allDocs[0].title);
    
    const updated = await db.update(documents).set({ title: 'Test New Title', updatedAt: new Date() }).where(eq(documents.id, docId)).returning();
    console.log('Updated to:', updated[0]?.title);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
testUpdate();
