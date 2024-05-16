(function () {
  if (process.env['NODE_ENV'] !== 'production') {
    require('dotenv').config({
      path: require('path').resolve(__dirname, '../../../.env'),
    });
  }
})();

import { ACTION_TASK_QUEUE, getTemporalNamespace, getTemporalUrl } from '@embed/shared';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: getTemporalUrl(),
  });

  const worker = await Worker.create({
    connection,
    namespace: getTemporalNamespace(),
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
