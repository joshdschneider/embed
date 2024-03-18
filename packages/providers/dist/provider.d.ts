import { ProviderSpecification, SyncContext } from './types';
export declare class Provider {
    specification: ProviderSpecification;
    constructor(provider: string);
    getSpecification(): ProviderSpecification;
    syncCollection(collection: string, context: SyncContext): Promise<any>;
}
