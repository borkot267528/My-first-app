/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import process from 'node:process';
import { createServer as createViteServer } from 'vite';
import apiRouter from './src/server/routes/index';
import { RealtimeServer } from './src/server/realtime/websocket';

async function startServer() {
  const app = express();
  // In the AI Studio container, Nginx listens on port 8080 and proxies to 3000.
  // The dev server must always bind to port 3000.
  const portArgIndex = process.argv.indexOf('--port');
  const portFromArg = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
  const PORT = portFromArg || (process.env.APP_PORT ? Number(process.env.APP_PORT) : 3000);
  const server = http.createServer(app);

  // Initialize Real-time WebSocket Server
  const realtimeServer = new RealtimeServer(server);

  // Security & Middleware setup
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Security Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Demo-User-Id, X-CSRF-Token');
    next();
  });

  // Simple Rate Limiter simulation (for API protection)
  const ipHitCount: Map<string, { count: number; resetTime: number }> = new Map();
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || '127.0.0.1';
    const now = Date.now();
    const record = ipHitCount.get(ip) || { count: 0, resetTime: now + 60000 };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + 60000;
    } else {
      record.count++;
    }
    ipHitCount.set(ip, record);

    if (record.count > 600) { // 600 requests per minute limit
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Try again later.' });
    }
    next();
  });

  // API Routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Aura Voice Chat Backend API',
      version: '1.0.0',
      websocket: 'ws://localhost:3000/ws',
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development or Static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Development SPA HTML fallback
    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/ws')) {
        return next();
      }
      try {
        const fs = await import('node:fs');
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(indexPath)) return next();
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Aura Voice Chat Full-Stack Server running on http://localhost:${PORT}`);
    console.log(`📡 Real-time WebSocket Server ready on ws://localhost:${PORT}/ws`);
    console.log(`📚 OpenAPI JSON Documentation ready on http://localhost:${PORT}/api/docs/json`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
