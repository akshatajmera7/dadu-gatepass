import 'dotenv/config';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL;
console.log("DATABASE_URL:", dbUrl ? dbUrl.replace(/:[^:@]+@/, ':***@') : 'NOT SET');

async function testConnection() {
  // Step 1: Test raw pg connection
  console.log("\n--- Step 1: Testing raw pg Pool connection ---");
  const pool = new Pool({ connectionString: dbUrl });
  
  try {
    const client = await pool.connect();
    console.log("✅ Raw pg Pool connected successfully!");
    
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log("✅ Query result:", result.rows[0]);
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("✅ Tables in public schema:", tables.rows.map(r => r.table_name));
    
    client.release();
  } catch (err: any) {
    console.error("❌ Raw pg connection FAILED:", err.message);
    if (err.code) console.error("   Error code:", err.code);
  }

  // Step 2: Test Prisma connection
  console.log("\n--- Step 2: Testing Prisma connection ---");
  try {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('@prisma/client');
    
    const pool2 = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool2);
    const prisma = new PrismaClient({ adapter });
    
    await prisma.$connect();
    console.log("✅ Prisma connected successfully!");
    
    // Try counting users
    const userCount = await prisma.user.count();
    console.log("✅ User count:", userCount);
    
    await prisma.$disconnect();
  } catch (err: any) {
    console.error("❌ Prisma connection FAILED:", err.message);
  }

  await pool.end();
  process.exit(0);
}

testConnection();
