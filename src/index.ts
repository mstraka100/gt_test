/// <reference path="./types/express.d.ts" />
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import dmRoutes from './routes/dms';
import notificationRoutes from './routes/notifications';
import searchRoutes from './routes/search';
import fileRoutes from './routes/files';
import workspaceRoutes from './routes/workspaces';
import { setupSocketServer } from './socket';

const app = express();
const httpServer = createServer(app);

// Handle server errors (including EPIPE)
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
    console.log(`Connection error (${err.code}): client disconnected`);
  } else {
    console.error('Server error:', err);
  }
});

// Handle client errors to prevent crashes from broken connections
httpServer.on('clientError', (err: NodeJS.ErrnoException, socket) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    socket.destroy();
  } else {
    console.error('Client error:', err);
    socket.destroy();
  }
});

// Setup WebSocket server
const io = setupSocketServer(httpServer);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/channels', channelRoutes);
app.use('/messages', messageRoutes);
app.use('/dms', dmRoutes);
app.use('/notifications', notificationRoutes);
app.use('/search', searchRoutes);
app.use('/files', fileRoutes);
app.use('/workspaces', workspaceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`WebSocket server ready`);
});

export { app, io };
export default app;
