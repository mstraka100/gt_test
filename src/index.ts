import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
