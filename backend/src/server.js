import http from 'http';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { setupPresenceWebSocket } from './websocket/presence.js';

const app = express();

const corsOrigin = env.clientUrl === '*' || !env.clientUrl ? true : env.clientUrl;
app.use(cors({ origin: corsOrigin, credentials: false }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

const server = http.createServer(app);
setupPresenceWebSocket(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`Backend started on http://0.0.0.0:${env.port}`);
});
