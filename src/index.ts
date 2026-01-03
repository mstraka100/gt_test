import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import { setupSocketServer } from './socket';

const app = express();
const httpServer = createServer(app);

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
