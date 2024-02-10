import { promises as fs } from 'fs';
import path from 'path';
import { Provider, ProviderSpecification } from './provider';

export class Registry {
  private providers: {
    [key: string]: Provider;
  } = {};

  private async load(slug: string): Promise<void> {
    const providerPath = path.join(__dirname, slug);
    const module = await import(providerPath);
    this.providers[slug] = new module.default();
  }

  private async loadAll(): Promise<void> {
    const dir = path.join(__dirname);
    const slugs = await fs.readdir(dir);

    for (const slug of slugs) {
      const providerPath = path.join(dir, slug);
      const stats = await fs.lstat(providerPath);

      if (stats.isDirectory()) {
        const module = await import(providerPath);
        this.providers[slug] = new module.default();
      }
    }
  }

  public async getProviderSpec(slug: string): Promise<ProviderSpecification | null> {
    await this.load(slug);
    const provider = this.providers[slug];
    return provider ? provider.getSpec() : null;
  }

  public async getAllProviderSpecs(): Promise<ProviderSpecification[] | null> {
    await this.loadAll();
    const specs = [];
    for (const provider in this.providers) {
      const spec = this.providers[provider]?.getSpec();
      if (spec) {
        specs.push(spec);
      }
    }

    return specs;
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
