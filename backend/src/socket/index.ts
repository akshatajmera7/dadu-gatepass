import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketServer(server: HTTPServer) {
  io = new SocketIOServer(server, {
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

export function broadcastGateLog(log: any) {
  if (io) {
    io.emit('gate_log_activity', log);
  }
}
