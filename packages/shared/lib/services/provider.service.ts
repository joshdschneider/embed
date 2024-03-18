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

  public async getProviderSpec(providerSlug: string): Promise<ProviderSpecification | null> {
    try {
      return await this.registry.getProviderSpecification(providerSlug);
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }

  public async syncProviderModel(
    provider: string,
    model: string,
    context: SyncContext
  ): Promise<void> {
    return await this.registry.syncProviderModel(provider, model, context);
  }
}

export default new ProviderService();
