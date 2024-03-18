import { ProviderSpecification, SyncContext } from './types';
export declare class Registry {
    private providers;
    private load;
    private loadAll;
    getProviderSpecification(uniqueKey: string): Promise<ProviderSpecification | null>;
    getAllProviderSpecifications(): Promise<ProviderSpecification[]>;
    syncProviderModel(uniqueKey: string, model: string, context: SyncContext): Promise<void>;
}
