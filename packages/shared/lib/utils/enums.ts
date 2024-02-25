export enum Resource {
  Account = 'acct',
  ApiKey = 'key',
  Environment = 'env',
  Collection = 'coll',
  Action = 'act',
  ActionRun = 'act_run',
  Sync = 'sync',
  SyncRun = 'sync_run',
  SyncSchedule = 'sync_sch',
  Activity = 'act',
  ActivityLog = 'act_log',
  LinkedAccount = 'link',
  LinkToken = 'link_tok',
  Webhook = 'web',
  WebhookEvent = 'web_ev',
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
  Stopped = 'stopped',
  Success = 'success',
  Error = 'error',
}

export enum SyncRunType {
  Initial = 'initial',
  Incremental = 'incremental',
  Full = 'full',
}

export enum SyncRunStatus {
  Running = 'running',
  Stopped = 'stopped',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export enum ScheduleStatus {
  Running = 'running',
  Stopped = 'stopped',
}

export enum PaginationType {
  Cursor = 'cursor',
  Link = 'link',
  Offset = 'offset',
}
