import type { ProviderSpecification } from '@beta/providers';
import { Registry } from '@beta/providers';
import errorService from './error.service';

class ProviderService {
  private registry: Registry;

  constructor() {
    this.registry = new Registry();
  }

  public async listProviders(): Promise<ProviderSpecification[] | null> {
    try {
      await this.registry.loadAll();
      return this.registry.getAllProviderSpecs();
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }

  public async getProviderSpec(providerSlug: string): Promise<ProviderSpecification | null> {
    try {
      await this.registry.load(providerSlug);
      return this.registry.getProviderSpec(providerSlug);
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }
}

export default new ProviderService();
