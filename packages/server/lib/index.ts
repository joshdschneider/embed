import dotenv from 'dotenv';
dotenv.config();

import { getServerPort, getWebsocketsPath, isCloud } from '@kit/shared';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import publisher from './clients/publisher.client';
import integrationRouter from './routes/integration.router';
import jobRouter from './routes/job.router';
import linkRouter from './routes/link.router';
import linkTokenRouter from './routes/linkToken.router';
import linkedAccountRouter from './routes/linkedAccount.router';
import oauthRouter from './routes/oauth.router';
import providerRouter from './routes/provider.router';
import proxyRouter from './routes/proxy.router';
import webRouter from './routes/web.router';
import webhookRouter from './routes/webhook.router';
import { corsOptions } from './utils/cors';
import { setupSelfHosted } from './utils/selfHosted';

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
  app.use('/v1/link-tokens', linkTokenRouter);
  app.use('/v1/linked-accounts', linkedAccountRouter);
  app.use('/v1/proxy', proxyRouter);
  app.use('/v1/webhooks', webhookRouter);

  app.use('/web', webRouter);
  app.use('/oauth', oauthRouter);
  app.use('/link', linkRouter);
  app.use('/providers', providerRouter);
  app.use('/jobs', jobRouter);

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

  if (!isCloud()) {
    await setupSelfHosted();
  }

  const port = getServerPort();
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start the server:', err);
});
