require('dotenv').config({ path: '.env' });
const postgres = require('postgres');

async function fix() {
  const client = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    const res = await client`
      INSERT INTO users (id, email, password)
      VALUES (gen_random_uuid(), 'web.dev.mi04@gmail.com', 'SUPABASE_AUTH_MANAGED')
      ON CONFLICT (email) DO NOTHING
      RETURNING id;
    `;
    console.log('Inserted:', res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
fix();
