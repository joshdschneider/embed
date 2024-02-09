import { Connection, Client as TemporalClient } from '@temporalio/client';
import fs from 'fs';
import errorService from '../services/error.service';
import { getTemporalNamespace, getTemporalUrl, isProd } from '../utils/constants';

const namespace = getTemporalNamespace();

class WorkerClient {
  private static instance: Promise<WorkerClient | null>;
  private client: TemporalClient | null = null;

  private constructor(client: TemporalClient) {
    this.client = client;
  }

  static getInstance(): Promise<WorkerClient | null> {
    if (!this.instance) {
      this.instance = this.create();
    }

    return this.instance;
  }

  private static async create(): Promise<WorkerClient | null> {
    try {
      const connection = await Connection.connect({
        address: getTemporalUrl(),
        tls: isProd()
          ? {
              clientCertPair: {
                crt: fs.readFileSync(`/etc/secrets/${namespace}.crt`),
                key: fs.readFileSync(`/etc/secrets/${namespace}.key`),
              },
            }
          : false,
      });

      const client = new TemporalClient({
        connection,
        namespace,
      });

      return new WorkerClient(client);
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async initiateSync(linkedAccountId: string): Promise<void> {}
}

export default WorkerClient;
