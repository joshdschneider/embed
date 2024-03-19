import { ProviderSpecification, SyncContext } from './types';
export declare class Registry {
    private providers;
    private load;
    private loadAll;
    getProviderSpecification(providerKey: string): Promise<ProviderSpecification | null>;
    getAllProviderSpecifications(): Promise<ProviderSpecification[]>;
    syncProviderCollection(providerKey: string, collectionKey: string, context: SyncContext): Promise<void>;
}
