import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { Provider, ProviderSpecification } from '../provider';

export default class Github extends Provider {
  public spec: ProviderSpecification;

  constructor() {
    super();
    this.spec = yaml.load(
      fs.readFileSync(path.join(__dirname, 'spec.yaml'), 'utf8')
    ) as ProviderSpecification;
  }

  public getSpec(): ProviderSpecification {
    return this.spec;
  }
}
