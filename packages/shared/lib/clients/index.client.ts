import { MappingProperty } from '@elastic/elasticsearch/lib/api/types';
import { CollectionProperty } from '@embed/providers';

export class IndexClient {
  public static transformStringProperty(
    name: string,
    prop: CollectionProperty
  ): [string, MappingProperty][] {
    let mappingProperty: MappingProperty;

    if (prop.keyword_searchable && prop.filterable) {
      mappingProperty = { type: 'text', fields: { keyword: { type: 'keyword' } } };
    } else if (prop.filterable) {
      mappingProperty = { type: 'keyword' };
    } else if (prop.keyword_searchable) {
      mappingProperty = { type: 'text' };
    } else {
      mappingProperty = { type: 'text', index: false };
    }

    const mappingProperties: [string, MappingProperty][] = [[name, mappingProperty]];

    if (prop.vector_searchable) {
      mappingProperties.push([`${name}_vector`, { type: 'dense_vector' }]);
    }

    return mappingProperties;
  }

  public static transformArrayProperty(
    name: string,
    prop: CollectionProperty
  ): [string, MappingProperty][] {
    if (!prop.items) {
      throw new Error('Array property missing items');
    }

    switch (prop.items.type) {
      case 'string':
        let mappingProperty: MappingProperty;

        if (prop.keyword_searchable && prop.filterable) {
          mappingProperty = { type: 'text', fields: { keyword: { type: 'keyword' } } };
        } else if (prop.filterable) {
          mappingProperty = { type: 'keyword' };
        } else if (prop.keyword_searchable) {
          mappingProperty = { type: 'text' };
        } else {
          mappingProperty = { type: 'text', index: false };
        }

        return [[name, mappingProperty]];
      case 'number':
        return [[name, { type: 'float', index: prop.filterable }]];
      case 'integer':
        return [[name, { type: 'integer', index: prop.filterable }]];
      case 'boolean':
        return [[name, { type: 'boolean', index: prop.filterable }]];
      case 'date':
        return [[name, { type: 'date', index: prop.filterable }]];

      default:
        throw new Error(`Unsupported array item type: ${prop.items.type}`);
    }
  }

  public static transformNestedProperty(
    name: string,
    prop: CollectionProperty
  ): [string, MappingProperty][] {
    if (!prop.properties) {
      throw new Error('Nested property missing properties');
    }

    const properties: [string, MappingProperty][] = [];
    for (const [nestedName, nestedProp] of Object.entries(prop.properties)) {
      properties.push(...IndexClient.transformProperty(nestedName, nestedProp));
    }

    return [[name, { type: 'nested', properties: Object.fromEntries(properties) }]];
  }

  public static transformProperty(
    name: string,
    prop: CollectionProperty
  ): [string, MappingProperty][] {
    switch (prop.type) {
      case 'string':
        return IndexClient.transformStringProperty(name, prop);
      case 'number':
        return [[name, { type: 'float', index: prop.filterable }]];
      case 'integer':
        return [[name, { type: 'integer', index: prop.filterable }]];
      case 'boolean':
        return [[name, { type: 'boolean', index: prop.filterable }]];
      case 'date':
        return [[name, { type: 'date', index: prop.filterable }]];
      case 'object':
        return [[name, { type: 'object', dynamic: true }]];
      case 'array':
        return IndexClient.transformArrayProperty(name, prop);
      case 'nested':
        return IndexClient.transformNestedProperty(name, prop);

      default:
        throw new Error(`Unsupported property type: ${prop.type}`);
    }
  }
}
