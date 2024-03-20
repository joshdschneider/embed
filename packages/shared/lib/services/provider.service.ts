import type { ProviderSpecification } from '@embed/providers';
import { Registry } from '@embed/providers';
import { SyncContext } from '../context/sync.context';
import errorService from './error.service';

class ProviderService {
  private registry: Registry;

  constructor() {
    this.registry = new Registry();
  }

  public async listProviders(): Promise<ProviderSpecification[] | null> {
    try {
      return await this.registry.getAllProviderSpecifications();
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }

  public async getProviderSpec(providerKey: string): Promise<ProviderSpecification | null> {
    try {
      return await this.registry.getProviderSpecification(providerKey);
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }

  public async syncProviderCollection(
    providerKey: string,
    collectionKey: string,
    syncContext: SyncContext
  ): Promise<void> {
    return this.registry.syncProviderCollection(providerKey, collectionKey, syncContext);
  }
}

export default new ProviderService();
