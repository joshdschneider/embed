import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { ProviderSpecification, ProviderSpecificationSchema, SyncContext } from './types';

export class Provider {
  public specification: ProviderSpecification;

  constructor(provider: string) {
    const file = yaml.load(fs.readFileSync(path.join(__dirname, `${provider}/kit.yaml`), 'utf8'));
    const spec = ProviderSpecificationSchema.safeParse(file);
    if (spec.success) {
      this.specification = spec.data;
    } else {
      throw new Error(`Failed to parse ${provider} specification`);
    }
  }

  public getSpecification(): ProviderSpecification {
    return this.specification;
  }

  public async syncCollection(collection: string, context: SyncContext) {
    const file = path.join(__dirname, this.specification.unique_key, `sync-${collection}`);
    const script = await import(file);
    return script.default(context);
  }
}
