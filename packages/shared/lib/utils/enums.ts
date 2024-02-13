export enum Resource {
  Account = 'acc',
  ApiKey = 'key',
  Environment = 'env',
  Sync = 'sync',
  SyncJob = 'syncj',
  Schedule = 'sch',
  Activity = 'act',
  ActivityLog = 'actl',
  LinkedAccount = 'link',
  LinkToken = 'tok',
  Webhook = 'web',
  WebhookLog = 'webl',
}

export enum ErrorCode {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  InternalServerError = 500,
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

export enum SyncStatus {
  Running = 'running',
  Paused = 'paused',
  Stopped = 'stopped',
  Success = 'success',
  Error = 'error',
}

export enum SyncType {
  Initial = 'initial',
  Incremental = 'incremental',
  Full = 'full',
}

export enum ScheduleStatus {
  Running = 'running',
  Paused = 'paused',
  Stopped = 'stopped',
}
