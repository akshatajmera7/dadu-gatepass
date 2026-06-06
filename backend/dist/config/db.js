"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
require("dotenv/config");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gatepass?schema=public';
const pool = new pg_1.Pool({ connectionString: databaseUrl });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function connectDB() {
    try {
        await prisma.$connect();
        console.log('Database connected successfully via PrismaPg Driver Adapter');
    }
    catch (error) {
        console.error('Database connection failed. Running in demo mode/local state might be limited. Please check your DB settings.');
        console.error(error);
    }
}
exports.default = prisma;
