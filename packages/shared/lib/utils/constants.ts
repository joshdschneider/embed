import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { CohereClient } from 'cohere-ai';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai';

export function getServerUrl() {
  return process.env['SERVER_URL'];
}

export function getServerPort() {
  const port = process.env['SERVER_PORT'];
  return port ? Number(port) : 5555;
}

export function getWebsocketsPath() {
  return process.env['SERVER_WEBSOCKETS_PATH'];
}

export function getRedisUrl() {
  return process.env['REDIS_URL'];
}

export function getWeaviateUrl() {
  return process.env['WEAVIATE_URL'];
}

export function getWeaviateApiKey() {
  return process.env['WEAVIATE_API_KEY'];
}

export function getTemporalUrl() {
  return process.env['TEMPORAL_URL'];
}

export function getTemporalNamespace() {
  return process.env['TEMPORAL_NAMESPACE'];
}

export function getTemporalKeyPath() {
  return process.env['TEMPORAL_KEY_PATH'];
}

export function getTemporalCertPath() {
  return process.env['TEMPORAL_CERT_PATH'];
}

export function getLocalhostUrl() {
  const serverPort = getServerPort();
  return `http://localhost:${serverPort}`;
}

export function getEncryptonKey() {
  return process.env['ENCRYPTION_KEY'];
}

export function getInternalApiKey() {
  return process.env['KIT_INTERNAL_API_KEY'];
}

export function getLogLevel() {
  return process.env['LOG_LEVEL'] || 'info';
}

export function isProd() {
  return process.env['NODE_ENV'] === 'production';
}

export function isCloud() {
  return process.env['KIT_CLOUD']?.toLowerCase() === 'true';
}

export function isEnterprise() {
  return process.env['KIT_ENTERPRISE']?.toLowerCase() === 'true';
}

export function getAuthTokenSecret() {
  return process.env['KIT_AUTH_TOKEN_SECRET'];
}

export function getOpenai(): OpenAI {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OpenAI API key not set');
  }

  return new OpenAI({ apiKey });
}

export function getCohere(): CohereClient {
  const token = process.env['COHERE_API_KEY'];
  if (!token) {
    throw new Error('Cohere API key not set');
  }

  return new CohereClient({ token });
}

export function getBedrock(): BedrockRuntimeClient {
  const awsAccessKey = process.env['AWS_ACCESS_KEY'];
  const awsSecretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
  const awsRegion = process.env['AWS_REGION'];

  if (!awsAccessKey) {
    throw new Error('Bedrock access key not set');
  } else if (!awsSecretAccessKey) {
    throw new Error('Bedrock secret access key not set');
  }

  return new BedrockRuntimeClient({
    credentials: {
      accessKeyId: awsAccessKey,
      secretAccessKey: awsSecretAccessKey,
    },
    region: awsRegion,
  });
}

export async function getGoogleCloud() {
  const keyPath = process.env['GOOGLE_CLOUD_KEY_PATH'];
  const projectId = process.env['GOOGLE_CLOUD_PROJECT_ID'];
  const region = process.env['GOOGLE_CLOUD_REGION'];

  if (!keyPath) {
    throw new Error('Google Cloud key path not set');
  } else if (!projectId) {
    throw new Error('Google Cloud project ID not set');
  } else if (!region) {
    throw new Error('Google Cloud region not set');
  }

  const auth = new GoogleAuth({ keyFilename: keyPath });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error('Failed to get Google access token');
  }

  return {
    accessToken: accessToken.token,
    projectId,
    region,
  };
}

export function getMistralApiKey() {
  const apiKey = process.env['MISTRAL_API_KEY'];
  if (!apiKey) {
    throw new Error('Mistral API key not set');
  }

  return apiKey;
}

export const ACCOUNT_ID_LOCALS_KEY = 'kit_account_id';
export const ENVIRONMENT_ID_LOCALS_KEY = 'kit_environment_id';

export const ENCRYPTION_KEY_BYTE_LENGTH = 32;
export const ENCRYPTION_KEY_SALT = 'X89FHEGqR3yNK0+v7rPWxQ==';

export const KIT_AUTH_TOKEN_KEY = 'kit_token';
export const KIT_ENVIRONMENT_KEY = 'kit_enviroment';

export const SYNC_TASK_QUEUE = 'syncs';
export const ACTIONS_TASK_QUEUE = 'actions';

export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const DEFAULT_SYNC_FREQUENCY = '1d';
export const DEFAULT_AUTO_START_SYNC = false;

export const SUPPORTED_LANGUAGES = ['en'];

export const DEFAULT_BRANDING = {
  name: null,
  appearance: 'system',
  border_radius: 'medium',
  light_mode: {
    logo: null,
    favicon: null,
    page_background: 'FCFCFC',
    button_background: '000000',
    button_text: 'FFFFFF',
    links: '5753C6',
  },
  dark_mode: {
    logo: null,
    favicon: null,
    page_background: '000000',
    button_background: 'FFFFFF',
    button_text: '000000',
    links: 'B1A9FF',
  },
};

export const DEFAULT_ERROR_MESSAGE = 'Something went wrong';
