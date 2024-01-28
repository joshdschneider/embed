export enum EnvironmentType {
  Staging = 'staging',
  Production = 'production',
}

export enum DuplicateAccountBehavior {
  CreateNew = 'create_new',
  UseExisting = 'use_existing',
  ThrowError = 'throw_error',
}

export enum AccountType {
  Personal = 'personal',
  Organization = 'organization',
}

export enum LogLevel {
  Info = 'info',
  Debug = 'debug',
  Error = 'error',
  Warn = 'warn',
  Verbose = 'verbose',
}

export enum LogAction {
  Link = 'link',
  Sync = 'sync',
  Action = 'action',
}
