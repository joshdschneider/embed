import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { ProviderSpecification, ProviderSpecificationSchema, SyncContext } from './types';

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

  public getSpecification(): ProviderSpecification {
    return this.specification;
  }

  public async syncModel(model: string, context: SyncContext) {
    const modelPath = path.join(__dirname, this.specification.slug, `sync-${model}`);
    const script = await import(modelPath);
    return script.default(context);
  }
}
