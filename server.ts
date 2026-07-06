import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import WebSocket from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

// Import Routes
import documentRoutes from './routes/documentRoutes';
import authRoutes from './routes/authRoutes';
import cookieParser from 'cookie-parser';

const app = express();
const port = process.env.PORT || 1234;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:3000'] : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/auth', authRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SyncDocs API + WebSocket' });
});

// Create HTTP Server
const server = http.createServer(app);

import jwt from 'jsonwebtoken';
import { db } from './db/index';
import { documents } from './db/schema';
import { eq } from 'drizzle-orm';
import url from 'url';

import { OTWebSocketGateway } from './src/gateway/WebSocketGateway';

// Start OT WebSocket Gateway attached to HTTP server
const gateway = new OTWebSocketGateway(server);

import { client } from './db/index';

const startServer = async () => {
  try {
    // Test the database connection
    await client`SELECT 1`;
    console.log('✅ Connected to Supabase PostgreSQL database');
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
  }

  server.listen(port, () => {
    console.log(`HTTP and WebSocket server listening on port ${port}`);
  });
};

startServer();
