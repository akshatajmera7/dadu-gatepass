"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
exports.broadcastGateLog = broadcastGateLog;
const socket_io_1 = require("socket.io");
let io = null;
function initSocketServer(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*', // Allow all for local simulation development
            methods: ['GET', 'POST'],
        }
    });
    io.on('connection', (socket) => {
        console.log(`Socket client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`Socket client disconnected: ${socket.id}`);
        });
    });
    return io;
}
function broadcastGateLog(log) {
    if (io) {
        io.emit('gate_log_activity', log);
    }
}
