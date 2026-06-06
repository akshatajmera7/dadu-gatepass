"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const socket_1 = require("./socket");
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middlewares/error");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize WebSockets
(0, socket_1.initSocketServer)(server);
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routing API endpoints
app.use('/api/v1', routes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
});
// Global Error Handler
app.use(error_1.errorHandler);
const PORT = process.env.PORT || 5000;
async function bootstrap() {
    await (0, db_1.connectDB)();
    await (0, redis_1.connectRedis)();
    server.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
    });
}
bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
