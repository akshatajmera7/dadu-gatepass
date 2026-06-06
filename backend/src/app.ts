import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initSocketServer } from './socket';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error';

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
initSocketServer(server);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routing API endpoints
app.use('/api/v1', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB();
  await connectRedis();

  server.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
}

// Global handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
});
