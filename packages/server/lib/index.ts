import dotenv from 'dotenv';
dotenv.config();

import { getServerPort, getWebsocketsPath } from '@embed/shared';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import publisher from './clients/publisher.client';
import connectRouter from './routes/connect.router';
import connectTokenRouter from './routes/connectToken.router';
import connectionRouter from './routes/connection.router';
import integrationRouter from './routes/integration.router';
import oauthRouter from './routes/oauth.router';
import providerRouter from './routes/provider.router';
import proxyRouter from './routes/proxy.router';
import webRouter from './routes/web.router';
import webhookRouter from './routes/webhook.router';
import { corsOptions } from './utils/cors';

function setupExpressApp() {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '75mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.use('/v1/integrations', integrationRouter);
  app.use('/v1/connect-tokens', connectTokenRouter);
  app.use('/v1/connections', connectionRouter);
  app.use('/v1/proxy', proxyRouter);
  app.use('/v1/webhooks', webhookRouter);

  app.use('/web', webRouter);
  app.use('/oauth', oauthRouter);
  app.use('/connect', connectRouter);
  app.use('/providers', providerRouter);

  return app;
}

async function setupWebSockets(server: http.Server) {
  const wss = new WebSocketServer({
    server,
    path: getWebsocketsPath(),
  });

  await publisher.connect();
  wss.on('connection', async (ws: WebSocket) => {
    await publisher.subscribe(ws);
  });
}

async function start() {
  const app = setupExpressApp();
  const server = http.createServer(app);
  await setupWebSockets(server);

  const port = getServerPort();
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start the server:', err);
});
