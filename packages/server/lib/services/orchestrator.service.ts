import { syncService } from '@kit/shared';
import { StringValue } from 'ms';
import integrationService from './integration.service';
import linkedAccountService from './linkedAccount.service';

class Orchestrator {
  public async startSync(linkedAccountId: string, models: string[]): Promise<void> {
    const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);

    if (!linkedAccount) {
      throw new Error(`Linked account with id ${linkedAccountId} not found`);
    }

    const syncModels = await integrationService.getIntegrationSyncModels(
      linkedAccount.integration_provider,
      linkedAccount.environment_id
    );

    if (!syncModels) {
      throw new Error(`No sync models found for ${linkedAccount.integration_provider}`);
    }

    for (const model of models) {
      const syncModel = syncModels.find((syncModel) => syncModel.name === model);

      if (!syncModel) {
        throw new Error(`Sync model ${model} not found for ${linkedAccount.integration_provider}`);
      }

      if (!syncModel.is_enabled) {
        throw new Error(
          `Sync model ${model} is not enabled for ${linkedAccount.integration_provider}`
        );
      }

      const sync = await syncService.getSyncByModelId(syncModel.id, linkedAccountId);

      if (!sync) {
        // create sync
        // create initial sync job
        // start sync schedule
      } else {
        /**
         * Initial sync still running?
         * - return error, initial sync still running
         *
         * Initial sync failed?
         *
         */
        // initial sync still running?
        // - return error, initial sync still running
        // check sync schedule
        // -
        // create sync schedule
      }
    }
  }

  public async pauseSync(syncId: string): Promise<void> {
    //..
  }

  public async stopSync(syncId: string): Promise<void> {
    //..
  }

  public async triggerSync(syncId: string): Promise<void> {
    //..
  }

  public async updateSync(syncId: string, frequency: StringValue): Promise<void> {
    //..
  }
}

export default new Orchestrator();
