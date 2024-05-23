(function () {
  if (process.env['NODE_ENV'] !== 'production') {
    require('dotenv').config({
      path: require('path').resolve(__dirname, '../../../.env'),
    });
  }
})();

import { getServerPort, getWebsocketsPath, initSentry } from '@embed/shared';
initSentry();

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import publisher from './clients/publisher.client';
import connectionRouter from './routes/connection.router';
import filePickerRouter from './routes/filePicker.router';
import integrationRouter from './routes/integration.router';
import oauthRouter from './routes/oauth.router';
import previewRouter from './routes/preview.router';
import providerRouter from './routes/provider.router';
import proxyRouter from './routes/proxy.router';
import sessionRouter from './routes/session.router';
import sessionTokenRouter from './routes/sessionToken.router';
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
  app.use('/v1/session-tokens', sessionTokenRouter);
  app.use('/v1/connections', connectionRouter);
  app.use('/v1/proxy', proxyRouter);
  app.use('/v1/webhooks', webhookRouter);

  app.use('/web', webRouter);
  app.use('/oauth', oauthRouter);
  app.use('/session', sessionRouter);
  app.use('/file-picker', filePickerRouter);
  app.use('/preview', previewRouter);
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
