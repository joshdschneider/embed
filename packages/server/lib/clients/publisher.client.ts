import crypto from 'crypto';
import type { Response } from 'express';
import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import { v4 } from 'uuid';
import type { WebSocket } from 'ws';
import { Branding, DefaultTemplateData, ErrorTemplateData } from '../types';
import { DEFAULT_BRANDING, getRedisUrl } from '../utils/constants';
import { appendParamsToUrl } from '../utils/helpers';

enum MessageType {
  ConnectionAck = 'connection_ack',
  Error = 'error',
  Success = 'success',
}

class Redis {
  private url: string;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor(url: string) {
    this.url = url;
    this.publisher = createClient({ url: this.url });
    this.subscriber = createClient({ url: this.url });
  }

  public async connect() {
    await this.publisher.connect();
    await this.subscriber.connect();
  }

  public async publish(channel: string, message: string) {
    await this.publisher.publish(channel, message);
  }

  public async subscribe(channel: string, onMessage: (message: string, channel: string) => void) {
    await this.subscriber.subscribe(channel, async (message, channel) => {
      onMessage(message, channel);
    });
  }

  public async unsubscribe(channel: string) {
    await this.subscriber.unsubscribe(channel);
  }
}

class RedisPublisher {
  private redis: Redis;
  public static REDIS_CHANNEL_PREFIX = 'publisher:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  public async publish(wsClientId: string, message: string): Promise<boolean> {
    const channel = RedisPublisher.REDIS_CHANNEL_PREFIX + wsClientId;

    try {
      await this.redis.publish(channel, message);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  public async subscribe(
    wsClientId: string,
    onMessage: (message: string, channel: string) => void
  ) {
    const channel = RedisPublisher.REDIS_CHANNEL_PREFIX + wsClientId;

    try {
      await this.redis.subscribe(channel, (message, channel) => {
        const wsClientId = channel.replace(RedisPublisher.REDIS_CHANNEL_PREFIX, '');
        onMessage(message, wsClientId);
      });
    } catch (err) {
      console.error(err);
    }
  }

  public async unsubscribe(wsClientId: string) {
    const channel = RedisPublisher.REDIS_CHANNEL_PREFIX + wsClientId;

    try {
      await this.redis.unsubscribe(channel);
    } catch (err) {
      console.error(err);
    }
  }
}

class WebSocketPublisher {
  private wsClients = new Map<string, WebSocket>();

  public subscribe(ws: WebSocket, wsClientId: string): string {
    this.wsClients.set(wsClientId, ws);

    const message = JSON.stringify({
      message_type: MessageType.ConnectionAck,
      ws_client_id: wsClientId,
    });

    ws.send(message);
    return wsClientId;
  }

  public unsubscribe(wsClientId: string) {
    this.wsClients.delete(wsClientId);
  }

  public publish(wsClientId: string, message: string): boolean {
    const client = this.wsClients.get(wsClientId);
    if (client) {
      client.send(message);
      return true;
    }

    return false;
  }
}

export class Publisher {
  private redisPublisher: RedisPublisher | null;
  private wsPublisher: WebSocketPublisher;

  constructor() {
    this.wsPublisher = new WebSocketPublisher();
    this.redisPublisher = null;
  }

  public async connect() {
    const redisUrl = getRedisUrl();
    if (redisUrl) {
      const redis = new Redis(redisUrl);
      await redis.connect();
      this.redisPublisher = new RedisPublisher(redis);
    }
  }

  public async subscribe(ws: WebSocket, wsClientId = v4()) {
    this.wsPublisher.subscribe(ws, wsClientId);
    if (this.redisPublisher) {
      const onMessage = async (message: string, channel: string) => {
        this.wsPublisher.publish(channel, message);
        await this.unsubscribe(wsClientId);
      };

      await this.redisPublisher.subscribe(wsClientId, onMessage);
    }
  }

  public async unsubscribe(wsClientId: string) {
    this.wsPublisher.unsubscribe(wsClientId);
    if (this.redisPublisher) {
      await this.redisPublisher.unsubscribe(wsClientId);
    }
  }

  public async publish(wsClientId: string, message: string): Promise<boolean> {
    const delivered = this.wsPublisher.publish(wsClientId, message);
    if (!delivered) {
      if (this.redisPublisher) {
        await this.redisPublisher.publish(wsClientId, message);
      }
    }

    return delivered;
  }

  public async publishError(
    res: Response,
    {
      error,
      wsClientId,
      linkMethod,
      redirectUrl,
      branding,
      prefersDarkMode,
    }: {
      error: string;
      wsClientId?: string;
      linkMethod?: string;
      redirectUrl?: string;
      branding?: Branding;
      prefersDarkMode?: boolean;
    }
  ) {
    if (wsClientId) {
      const data = JSON.stringify({ message_type: MessageType.Error, error });
      const published = await this.publish(wsClientId, data);
      if (published) {
        await this.unsubscribe(wsClientId);
      }
    }

    if (linkMethod === 'popup') {
      this.closePopup(res);
    } else if (linkMethod === 'redirect' && redirectUrl) {
      const errorRedirectUrl = appendParamsToUrl(redirectUrl, { error });
      res.redirect(errorRedirectUrl);
    } else {
      const data: ErrorTemplateData = {
        error_message: error,
        branding: branding || DEFAULT_BRANDING,
        prefers_dark_mode: prefersDarkMode || false,
      };

      res.render('error', data);
    }
  }

  public async publishSuccess(
    res: Response,
    {
      linkedAccountId,
      wsClientId,
      linkMethod,
      redirectUrl,
      branding,
      prefersDarkMode,
    }: {
      linkedAccountId: string;
      wsClientId?: string;
      linkMethod?: string;
      redirectUrl?: string;
      branding?: Branding;
      prefersDarkMode?: boolean;
    }
  ) {
    if (wsClientId) {
      const data = JSON.stringify({
        message_type: MessageType.Success,
        linked_account_id: linkedAccountId,
      });

      const published = await this.publish(wsClientId, data);
      if (published) {
        await this.unsubscribe(wsClientId);
      }
    }

    if (linkMethod === 'popup') {
      this.closePopup(res);
    } else if (linkMethod === 'redirect' && redirectUrl) {
      const successRedirectUrl = appendParamsToUrl(redirectUrl, {
        linked_account_id: linkedAccountId,
      });

      res.redirect(successRedirectUrl);
    } else {
      const data: DefaultTemplateData = {
        branding: branding || DEFAULT_BRANDING,
        prefers_dark_mode: prefersDarkMode || false,
      };

      res.render('finish', data);
    }
  }

  private closePopup(res: Response) {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
    res.render('close', { nonce });
  }
}

export default new Publisher();
