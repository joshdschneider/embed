import { promises as fs } from 'fs';
import path from 'path';
import { Provider } from './provider';
import { ProviderSpecification, SyncContext } from './types';

export class Registry {
  private providers: {
    [key: string]: Provider;
  } = {};

  private async load(providerKey: string): Promise<void> {
    this.providers[providerKey] = new Provider(providerKey);
  }

  private async loadAll(): Promise<void> {
    const dir = path.join(__dirname);
    const keys = await fs.readdir(dir);
    for (const providerKey of keys) {
      const providerPath = path.join(dir, providerKey);
      const stats = await fs.lstat(providerPath);
      if (stats.isDirectory()) {
        this.providers[providerKey] = new Provider(providerKey);
      }
    }
  }

  public async getProviderSpecification(
    providerKey: string
  ): Promise<ProviderSpecification | null> {
    await this.load(providerKey);
    const provider = this.providers[providerKey];
    return provider ? provider.getSpecification() : null;
  }

  public async getAllProviderSpecifications(): Promise<ProviderSpecification[]> {
    await this.loadAll();
    return Object.values(this.providers).map((provider) => provider.getSpecification());
  }

  public async syncProviderCollection(
    providerKey: string,
    collectionKey: string,
    context: SyncContext
  ): Promise<void> {
    await this.load(providerKey);
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`Failed to load provider ${providerKey}`);
    }

    return provider.syncCollection(collectionKey, context);
  }
}
