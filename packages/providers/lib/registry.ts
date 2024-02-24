import { promises as fs } from 'fs';
import path from 'path';
import { Provider } from './provider';
import { ProviderSpecification, SyncContext } from './types';

export class Registry {
  private providers: {
    [key: string]: Provider;
  } = {};

  private async load(uniqueKey: string): Promise<void> {
    this.providers[uniqueKey] = new Provider(uniqueKey);
  }

  private async loadAll(): Promise<void> {
    const dir = path.join(__dirname);
    const keys = await fs.readdir(dir);
    for (const uniqueKey of keys) {
      const providerPath = path.join(dir, uniqueKey);
      const stats = await fs.lstat(providerPath);
      if (stats.isDirectory()) {
        this.providers[uniqueKey] = new Provider(uniqueKey);
      }
    }
  }

  public async getProviderSpecification(uniqueKey: string): Promise<ProviderSpecification | null> {
    await this.load(uniqueKey);
    const provider = this.providers[uniqueKey];
    return provider ? provider.getSpecification() : null;
  }

  public async getAllProviderSpecifications(): Promise<ProviderSpecification[]> {
    await this.loadAll();
    return Object.values(this.providers).map((provider) => provider.getSpecification());
  }

  public async syncProviderModel(
    uniqueKey: string,
    model: string,
    context: SyncContext
  ): Promise<void> {
    await this.load(uniqueKey);
    const provider = this.providers[uniqueKey];
    if (!provider) {
      throw new Error(`Failed to load provider ${uniqueKey}`);
    }

    return provider.syncCollection(model, context);
  }
}
