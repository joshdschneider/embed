import type {
  ApiKey,
  Record as DataRecord,
  Integration,
  LinkedAccount,
  Webhook,
} from '@prisma/client';
import crypto, { CipherGCMTypes } from 'crypto';
import { getEncryptonKey } from '../utils/constants';

class EncryptionService {
  private key: string | undefined;
  private algorithm: CipherGCMTypes = 'aes-256-gcm';
  private encoding: BufferEncoding = 'base64';
  private byteLength = 32;

  constructor(key: string | undefined) {
    this.key = key;

    if (key && Buffer.from(key, this.encoding).byteLength != this.byteLength) {
      throw new Error('Encryption key must be base64-encoded and 256-bit');
    }
  }

  private shouldEncrypt(): boolean {
    return !!this.key && this.key.length > 0;
  }

  private encrypt(str: string): [string, string | null, string | null] {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key!, this.encoding), iv);
    let enc = cipher.update(str, 'utf8', this.encoding);
    enc += cipher.final(this.encoding);
    return [enc, iv.toString(this.encoding), cipher.getAuthTag().toString(this.encoding)];
  }

  private decrypt(enc: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.key!, this.encoding),
      Buffer.from(iv, this.encoding)
    );

    decipher.setAuthTag(Buffer.from(authTag, this.encoding));
    let str = decipher.update(enc, this.encoding, 'utf8');
    str += decipher.final('utf8');
    return str;
  }

  public encryptIntegration(integration: Integration): Integration {
    if (!this.shouldEncrypt() || !integration.oauth_client_secret) {
      return integration;
    }

    const [encryptedSecret, iv, tag] = this.encrypt(integration.oauth_client_secret);
    const encryptedIntegration: Integration = {
      ...integration,
      oauth_client_secret: encryptedSecret,
      oauth_client_secret_iv: iv,
      oauth_client_secret_tag: tag,
    };

    return encryptedIntegration;
  }

  public decryptIntegration(integration: Integration): Integration {
    if (
      !integration.oauth_client_secret ||
      !integration.oauth_client_secret_iv ||
      !integration.oauth_client_secret_tag
    ) {
      return integration;
    }

    const decryptedSecret = this.decrypt(
      integration.oauth_client_secret,
      integration.oauth_client_secret_iv,
      integration.oauth_client_secret_tag
    );

    const decryptedIntegration: Integration = {
      ...integration,
      oauth_client_secret: decryptedSecret,
    };

    return decryptedIntegration;
  }

  public hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  public encryptApiKey(apiKey: ApiKey): ApiKey {
    if (!this.shouldEncrypt()) {
      return apiKey;
    }

    const [encryptedKey, iv, tag] = this.encrypt(apiKey.key);

    const encryptedApiKey: ApiKey = {
      ...apiKey,
      key: encryptedKey,
      key_iv: iv,
      key_tag: tag,
    };

    return encryptedApiKey;
  }

  public decryptApiKey(apiKey: ApiKey): ApiKey {
    if (!apiKey.key_iv || !apiKey.key_tag) {
      return apiKey;
    }

    const key = this.decrypt(apiKey.key, apiKey.key_iv, apiKey.key_tag);
    const decryptedApiKey: ApiKey = { ...apiKey, key };
    return decryptedApiKey;
  }

  public encryptLinkedAccount(linkedAccount: LinkedAccount): LinkedAccount {
    if (!this.shouldEncrypt()) {
      return linkedAccount;
    }

    const [credentials, iv, tag] = this.encrypt(linkedAccount.credentials);

    const encryptedLinkedAccount: LinkedAccount = {
      ...linkedAccount,
      credentials: credentials,
      credentials_iv: iv,
      credentials_tag: tag,
    };

    return encryptedLinkedAccount;
  }

  public decryptLinkedAccount(linkedAccount: LinkedAccount): LinkedAccount {
    if (!linkedAccount.credentials_iv || !linkedAccount.credentials_tag) {
      return linkedAccount;
    }

    const decrypted = this.decrypt(
      linkedAccount.credentials,
      linkedAccount.credentials_iv,
      linkedAccount.credentials_tag
    );

    const decryptedLinkedAccount: LinkedAccount = {
      ...linkedAccount,
      credentials: decrypted,
    };

    return decryptedLinkedAccount;
  }

  public encryptWebhook(webhook: Webhook): Webhook {
    if (!this.shouldEncrypt()) {
      return webhook;
    }

    const [secret, iv, tag] = this.encrypt(webhook.secret);

    const encryptedWebhook: Webhook = {
      ...webhook,
      secret: secret,
      secret_iv: iv,
      secret_tag: tag,
    };

    return encryptedWebhook;
  }

  public decryptWebhook(webhook: Webhook): Webhook {
    if (!webhook.secret_iv || !webhook.secret_tag) {
      return webhook;
    }

    const decrypted = this.decrypt(webhook.secret, webhook.secret_iv, webhook.secret_tag);

    const decryptedWebhook: Webhook = {
      ...webhook,
      secret: decrypted,
    };

    return decryptedWebhook;
  }

  public encryptRecord(record: DataRecord): DataRecord {
    if (!this.shouldEncrypt()) {
      return record;
    }

    const [object, iv, tag] = this.encrypt(record.object);

    const encryptedRecord: DataRecord = {
      ...record,
      object: object,
      object_iv: iv,
      object_tag: tag,
    };

    return encryptedRecord;
  }

  public decryptRecord(record: DataRecord): DataRecord {
    if (!record.object_iv || !record.object_tag) {
      return record;
    }

    const decrypted = this.decrypt(record.object, record.object_iv, record.object_tag);

    const decryptedRecord: DataRecord = {
      ...record,
      object: decrypted,
    };

    return decryptedRecord;
  }
}

export default new EncryptionService(getEncryptonKey());
