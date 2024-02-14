import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { ProviderSpecification } from '../dist';
import { KitSyncContext, ProviderSpecificationSchema } from './types';

export class Provider {
  public specification: ProviderSpecification;

  constructor(slug: string) {
    const file = yaml.load(fs.readFileSync(path.join(__dirname, `${slug}/kit.yaml`), 'utf8'));
    const spec = ProviderSpecificationSchema.safeParse(file);
    if (spec.success) {
      this.specification = spec.data;
    } else {
      throw new Error(`Failed to parse ${slug} provider specification`);
    }
  }

  public getSpec(): ProviderSpecification {
    return this.specification;
  }

  public async fetchData(model: string, kit: KitSyncContext) {
    throw new Error(`Model ${model} not implemented on provider ${this.specification.slug}`);
  }
}
