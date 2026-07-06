import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { db } from './db/index';
import { eq } from 'drizzle-orm';
import { users } from './db/schema';
const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-local-dev';
async function test() {
  const userArray = await db.query.users.findMany({ where: eq(users.email, 'chandandebsingha1@gmail.com') });
  const user = userArray[0];
  if (!user) return console.log("No user");
  const token = jwt.sign({ sub: user.id, email: user.email }, secretKey, { expiresIn: '7d' });
  console.log("Calling API to get documents for", user.email);
  const res = await fetch(`http://localhost:1234/api/documents`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
  process.exit(0);
}
test();
