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

export function getLocalhostUrl() {
  const serverPort = getServerPort();
  return `http://localhost:${serverPort}`;
}

export function getEncryptonKey() {
  return process.env['ENCRYPTION_KEY'];
}

export function getLogLevel() {
  return process.env['LOG_LEVEL'] || 'info';
}

export function isProd() {
  return process.env['NODE_ENV'] === 'production';
}

export function isCloud() {
  return process.env['BETA_CLOUD']?.toLowerCase() === 'true';
}

export function getAuthTokenSecret() {
  return process.env['BETA_CLOUD_AUTH_TOKEN_SECRET'];
}

export const ACCOUNT_ID_LOCALS_KEY = 'beta_account_id';
export const ENVIRONMENT_ID_LOCALS_KEY = 'beta_environment_id';

export const ENCRYPTION_KEY_BYTE_LENGTH = 32;
export const ENCRYPTION_KEY_SALT = 'X89FHEGqR3yNK0+v7rPWxQ==';

export const BETA_CLOUD_AUTH_TOKEN_KEY = 'beta_cloud_token';
export const BETA_CLOUD_ENVIRONMENT_KEY = 'beta_cloud_enviroment';

export const SUPPORTED_LANGUAGES = [
  'da', // Danish
  'nl', // Dutch
  'en', // English
  'et', // Estonian
  'fr', // French
  'de', // German
  'it', // Italian
  'lv', // Latvian
  'lt', // Lithuanian
  'no', // Norwegian
  'pl', // Polish
  'pt', // Portuguese
  'ro', // Romanian
  'es', // Spanish
  'sv', // Swedish
];

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
