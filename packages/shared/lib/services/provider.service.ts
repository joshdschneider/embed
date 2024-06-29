import type { ProviderSpecification } from '@embed/providers';
import { Registry } from '@embed/providers';
import { ActionContext } from '../context/action.context';
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

  public async getProviderCollection(providerKey: string, collectionKey: string) {
    try {
      const spec = await this.registry.getProviderSpecification(providerKey);
      const providerCollection = spec?.collections?.find((c) => c.unique_key === collectionKey);
      if (!providerCollection) {
        return null;
      }

      return providerCollection;
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

  public async triggerProviderAction(
    providerKey: string,
    actionKey: string,
    actionContext: ActionContext
  ): Promise<void> {
    return this.registry.triggerProviderAction(providerKey, actionKey, actionContext);
  }
}

export default new ProviderService();
