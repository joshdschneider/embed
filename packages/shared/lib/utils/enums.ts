export enum Resource {
  Account = 'acct',
  ApiKey = 'key',
  Environment = 'env',
  SessionToken = 'tok',
  Connection = 'conn',
  Sync = 'sync',
  SyncRun = 'sync_run',
  ActionRun = 'act_run',
  SyncSchedule = 'sync_sch',
  Activity = 'act',
  ActivityLog = 'act_log',
  Webhook = 'web',
  WebhookEvent = 'web_ev',
  Record = 'rec',
  PaymentMethod = 'pm',
  Subscription = 'sub',
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
  Connect = 'connect',
  SyncRun = 'sync_run',
  ActionRun = 'action_run',
}

export enum SyncStatus {
  Running = 'running',
  Stopped = 'stopped',
  Error = 'error',
}

export enum SyncRunStatus {
  Running = 'running',
  Stopped = 'stopped',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export enum ActionRunStatus {
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export enum SyncScheduleStatus {
  Running = 'running',
  Stopped = 'stopped',
}

export enum SyncFrequency {
  RealTime = 'real_time',
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
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

export const embeddingModelDimensions = {
  [TextEmbeddingModel.OpenaiTextEmbeddingAda]: 1536,
  [TextEmbeddingModel.OpenaiTextEmbedding3Small]: 1536,
  [TextEmbeddingModel.OpenaiTextEmbedding3Large]: 3072,
  [TextEmbeddingModel.CohereEmbedEnglish3]: 1024,
  [TextEmbeddingModel.CohereEmbedEnglishLight3]: 384,
  [TextEmbeddingModel.CohereEmbedMultilingual3]: 1024,
  [TextEmbeddingModel.CohereEmbedMultilingualLight3]: 384,
  [TextEmbeddingModel.AmazonTitanTextG1]: 1536,
  [TextEmbeddingModel.GoogleVertexTextEmbeddingGecko003]: 768,
  [TextEmbeddingModel.MistralEmbed]: 1024,
  [MultimodalEmbeddingModel.AmazonTitanMultimodalG1]: 1024,
  [MultimodalEmbeddingModel.GoogleVertexMultimodalEmbedding001]: 1408,
};

export enum UsageAction {
  CreateConnection = 'create_connection',
}

export enum UsageType {
  Connection = 'connection',
  Query = 'query',
  Action = 'action',
  ProxyRequest = 'proxy_request',
  Sync = 'sync',
}

export enum QueryMode {
  default = 'default',
  insensitive = 'insensitive',
}

export enum SubscriptionPlan {
  PayAsYouGo = 'pay_as_you_go',
  Custom = 'custom',
  Enterprise = 'enterprise',
}

export enum SubscriptionStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}

export enum MeterEvent {
  TextQueries = 'text_queries',
  ImageQueries = 'image_queries',
  SyncedWords = 'synced_words',
  SyncedImages = 'synced_images',
  SyncedAudio = 'synced_audio',
  SyncedVideo = 'synced_video',
  Actions = 'actions',
  ProxyRequests = 'proxy_requests',
}

export enum LockedReason {
  PaymentMethodRequired = 'payment_method_required',
  PaymentMethodInvalid = 'payment_method_invalid',
  AccountSuspended = 'account_suspended',
}
