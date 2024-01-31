const DEFAULT_HOST = 'https://api.beta.com';
const DEFAULT_WEBSOCKET_PATH = '/';

export type BetaOptions = {
  host?: string;
  websocketPath?: string;
};

export function Beta(options?: BetaOptions) {
  return new BetaLink(options);
}

class BetaLink {
  private hostBaseUrl: string;
  private websocketBaseUrl: string;

  constructor(options?: BetaOptions) {
    const host = options?.host || DEFAULT_HOST;
    const websocketPath = options?.websocketPath || DEFAULT_WEBSOCKET_PATH;
    this.hostBaseUrl = host.endsWith('/') ? host.slice(0, -1) : host;

    try {
      const baseUrl = new URL(this.hostBaseUrl);
      const websocketUrl = new URL(websocketPath, baseUrl);
      this.websocketBaseUrl = websocketUrl
        .toString()
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
    } catch (err) {
      throw new Error('Invalid host URL or websocket path');
    }
  }

  public link(
    linkToken: string,
    options?: { linkMethod?: 'popup' | 'redirect'; redirectUrl?: string }
  ): Promise<string> {
    if (!linkToken) {
      throw new Error('Link token is required');
    }

    return new Promise((resolve, reject) => {
      const onSuccess = (linkedAccountId: string) => {
        return resolve(linkedAccountId);
      };

      const onError = (error: Error) => {
        return reject(error);
      };

      const url = `${this.hostBaseUrl}/link/${linkToken}`;
      const linkMethod = options?.linkMethod;
      const redirectUrl = options?.redirectUrl;

      if (linkMethod === 'popup' || (!linkMethod && !redirectUrl)) {
        createLinkPopup({
          url,
          websocketUrl: this.websocketBaseUrl,
          onSuccess,
          onError,
        });
      }

      if (linkMethod === 'redirect' || (!linkMethod && redirectUrl)) {
        const params: { link_method: string; redirect_url?: string } = { link_method: 'redirect' };
        if (redirectUrl) {
          params.redirect_url = redirectUrl;
        }

        window.location.href = appendParamsToUrl(url, params);
      }

      if (linkMethod && linkMethod !== 'popup' && linkMethod !== 'redirect') {
        const err = new Error('Invalid link method');
        onError(err);
      }
    });
  }
}

type LinkPopupOptions = {
  url: string;
  websocketUrl: string;
  onSuccess: (linkedAccountId: string) => any;
  onError: (error: Error) => any;
};

function createLinkPopup(options: LinkPopupOptions) {
  return new LinkPopup(options);
}

enum MessageType {
  ConnectionAck = 'connection_ack',
  Error = 'error',
  Success = 'success',
}

class LinkPopup {
  private url: string;
  private socket: WebSocket;
  private window: Window;

  constructor(options: LinkPopupOptions) {
    this.url = options.url;

    const layout = this.getLayout(500, 600);
    const featuresString = this.featuresToString({
      width: layout.computedWidth,
      height: layout.computedHeight,
      top: layout.top,
      left: layout.left,
      scrollbars: 'yes',
      resizable: 'yes',
      status: 'no',
      toolbar: 'no',
      location: 'no',
      copyhistory: 'no',
      menubar: 'no',
      directories: 'no',
    });

    this.window = window.open('', '_blank', featuresString)!;
    this.socket = new WebSocket(options.websocketUrl);
    this.socket.onmessage = (message: MessageEvent) => {
      this.handleMessage(message, options.onSuccess, options.onError);
    };
  }

  private handleMessage(
    message: MessageEvent,
    onSuccess: (linkedAccountId: string) => any,
    onError: (error: Error) => any
  ) {
    const data = JSON.parse(message.data);
    switch (data.message_type) {
      case MessageType.ConnectionAck:
        const params = { ws_client_id: data.ws_client_id, link_method: 'popup' };
        this.window.location = appendParamsToUrl(this.url, params);
        break;

      case MessageType.Error:
        const error = new Error(data.error);
        onError(error);
        this.socket.close();
        break;

      case MessageType.Success:
        onSuccess(data.linked_account_id);
        this.socket.close();
        break;

      default:
        return;
    }
  }

  private getLayout(width: number, height: number) {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const left = screenWidth / 2 - width / 2;
    const top = screenHeight / 2 - height / 2;
    const computedWidth = Math.min(width, screenWidth);
    const computedHeight = Math.min(height, screenHeight);

    return {
      left: Math.max(left, 0),
      top: Math.max(top, 0),
      computedWidth,
      computedHeight,
    };
  }

  private featuresToString(features: Record<string, any>): string {
    return Object.entries(features)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }
}

function appendParamsToUrl(url: string, params: Record<string, string>) {
  const baseUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    baseUrl.searchParams.set(key, value);
  });

  return url.toString();
}
