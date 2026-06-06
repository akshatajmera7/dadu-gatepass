import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

console.log("DB URL from env:", process.env.DATABASE_URL);

try {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  console.log("Prisma client with Pg Driver Adapter created successfully!");
} catch (e: any) {
  console.error("Failed to create client:", e.message);
}
