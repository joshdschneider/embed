import { SYNC_TASK_QUEUE, getTemporalNamespace } from '@kit/shared';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env['TEMPORAL_ADDRESS'] || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: getTemporalNamespace(),
    taskQueue: SYNC_TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
