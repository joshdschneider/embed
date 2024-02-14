import { promises as fs } from 'fs';
import path from 'path';
import { Provider } from './provider';
import { KitSyncContext, ProviderSpecification } from './types';

export class Registry {
  private providers: {
    [key: string]: Provider;
  } = {};

  private async load(slug: string): Promise<void> {
    this.providers[slug] = new Provider(slug);
  }

  private async loadAll(): Promise<void> {
    const dir = path.join(__dirname);
    const slugs = await fs.readdir(dir);
    for (const slug of slugs) {
      const providerPath = path.join(dir, slug);
      const stats = await fs.lstat(providerPath);
      if (stats.isDirectory()) {
        this.providers[slug] = new Provider(slug);
      }
    }
  }

  public async getProviderSpecification(slug: string): Promise<ProviderSpecification | null> {
    await this.load(slug);
    const provider = this.providers[slug];
    return provider ? provider.getSpec() : null;
  }

  public async getAllProviderSpecifications(): Promise<ProviderSpecification[]> {
    await this.loadAll();
    return Object.values(this.providers).map((provider) => provider.getSpec());
  }

  public async fetchData(slug: string, model: string, kit: KitSyncContext) {
    await this.load(slug);
    const provider = this.providers[slug];
    if (!provider) {
      throw new Error(`Failed to load provider ${slug}`);
    }

    return provider.fetchData(model, kit);
  }

  // public async postLink(slug: string): Promise<void> {
  //   await this.load(slug);
  //   const provider = this.providers[slug];

  //   if (!provider) {
  //     throw new Error(`Failed to load provider ${slug}`);
  //   }

  //   if (provider.postLink) {
  //     return provider.postLink();
  //   }
  // }
}
