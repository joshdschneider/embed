export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

export enum DuplicateAccountBehavior {
  CreateNew = 'create_new',
  UseExisting = 'use_existing',
  ThrowError = 'throw_error',
}
