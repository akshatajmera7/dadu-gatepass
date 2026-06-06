import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gatepass?schema=public';

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully via PrismaPg Driver Adapter');
  } catch (error) {
    console.error('Database connection failed. Running in demo mode/local state might be limited. Please check your DB settings.');
    console.error(error);
  }
}

export default prisma;
