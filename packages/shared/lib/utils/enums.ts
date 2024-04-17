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
  Record = 'rec',
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
  SyncRun = 'sync_run',
  Action = 'action',
}

export enum SyncStatus {
  Running = 'running',
  Stopped = 'stopped',
  Success = 'success',
  Error = 'error',
}

export enum SyncRunStatus {
  Running = 'running',
  Stopped = 'stopped',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export enum SyncScheduleStatus {
  Running = 'running',
  Stopped = 'stopped',
}

export enum PaginationType {
  Cursor = 'cursor',
  Link = 'link',
  Offset = 'offset',
}

export enum TextEmbeddingModel {
  OpenaiTextEmbeddingAda = 'openai-text-embedding-ada-002',
  OpenaiTextEmbedding3Small = 'openai-text-embedding-3-small',
  OpenaiTextEmbedding3Large = 'openai-text-embedding-3-large',
  CohereEmbedEnglish3 = 'cohere-embed-english-v3.0',
  CohereEmbedEnglishLight3 = 'cohere-embed-english-light-v3.0',
  CohereEmbedMultilingual3 = 'cohere-embed-multilingual-v3.0',
  CohereEmbedMultilingualLight3 = 'cohere-embed-multilingual-light-v3.0',
  AmazonTitanTextG1 = 'amazon.titan-embed-text-v1',
  GoogleVertexTextEmbeddingGecko003 = 'textembedding-gecko@003',
  MistralEmbed = 'mistral-embed',
}

export enum MultimodalEmbeddingModel {
  AmazonTitanMultimodalG1 = 'amazon.titan-embed-image-v1',
  GoogleVertexMultimodalEmbedding001 = 'multimodalembedding@001',
}
