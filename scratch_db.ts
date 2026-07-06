import 'dotenv/config';
import { db } from './db/index';
async function test() {
  const allShared = await db.query.documentMembers.findMany({
    with: {
      document: true,
      user: true
    }
  });
  console.log("All shared records in DB:", JSON.stringify(allShared, null, 2));
  process.exit(0);
}
test();
