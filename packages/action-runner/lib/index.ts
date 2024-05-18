(function () {
  if (process.env['NODE_ENV'] !== 'production') {
    require('dotenv').config({
      path: require('path').resolve(__dirname, '../../../.env'),
    });
  }
})();

import {
  ACTION_TASK_QUEUE,
  getTemporalCertPath,
  getTemporalKeyPath,
  getTemporalNamespace,
  getTemporalUrl,
  isProd,
} from '@embed/shared';
import { NativeConnection, Worker } from '@temporalio/worker';
import fs from 'fs';
import * as activities from './activities';

const TEMPORAL_URL = getTemporalUrl();
const TEMPORAL_NAMESPACE = getTemporalNamespace();
const TEMPORAL_CERT_PATH = getTemporalCertPath();
const TEMPORAL_KEY_PATH = getTemporalKeyPath();

async function run() {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_URL,
    tls: isProd()
      ? {
          clientCertPair: {
            crt: fs.readFileSync(TEMPORAL_CERT_PATH!),
            key: fs.readFileSync(TEMPORAL_KEY_PATH!),
          },
        }
      : false,
  });

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: ACTION_TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
