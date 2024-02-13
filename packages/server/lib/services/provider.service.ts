import type { ProviderSpecification } from '@kit/providers';
import { Registry } from '@kit/providers';
import { errorService } from '@kit/shared';

class ProviderService {
  private registry: Registry;

  constructor() {
    this.registry = new Registry();
  }

  public async listProviders(): Promise<ProviderSpecification[] | null> {
    try {
      return await this.registry.getAllProviderSpecs();
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }

  public async getProviderSpec(providerSlug: string): Promise<ProviderSpecification | null> {
    try {
      return await this.registry.getProviderSpec(providerSlug);
    } catch (err) {
      errorService.reportError(err);
      return null;
    }
  }
}

export default new ProviderService();
