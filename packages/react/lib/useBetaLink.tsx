import { useCallback } from 'react';

const DEFAULT_HOST = 'https://api.beta.com';
const DEFAULT_WEBSOCKET_PATH = '/';

export type LinkMethod = 'modal' | 'popup' | 'redirect';

export type UseBetaLinkProps = {
  linkToken: string;
  linkMethod?: LinkMethod;
  host?: string;
  websocketPath?: string;
};

enum MessageType {
  ConnectionAck = 'connection_ack',
  Error = 'error',
  Success = 'success',
}

export const useBetaLink = ({ linkToken, linkMethod, host, websocketPath }: UseBetaLinkProps) => {
  const getPopupLayout = (width: number, height: number) => {
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
  };

  const featuresToString = (features: Record<string, any>) => {
    return Object.entries(features)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  };

  const initiateLink = useCallback(
    (url: string, linkMethod: LinkMethod) => {
      if (linkMethod === 'modal') {
        //..
      } else if (linkMethod === 'popup') {
        const layout = getPopupLayout(500, 600);

        const featuresString = featuresToString({
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

        window.open(`${url}&link_method=${linkMethod}`, '_blank', featuresString);
      } else if (linkMethod === 'redirect') {
        //..
      } else {
        throw new Error('Invalid link method');
      }
    },
    [getPopupLayout, featuresToString]
  );

  const handleMessage = useCallback(
    (
      message: MessageEvent<any>,
      websocket: WebSocket,
      url: string,
      onSuccess: (linkedAccountId: string) => any,
      onError: (error: Error) => any
    ) => {
      const data = JSON.parse(message.data);

      switch (data.message_type) {
        case MessageType.ConnectionAck:
          const clientId = data.ws_client_id;
          const method = linkMethod || 'modal';
          initiateLink(`${url}?ws_client_id=${clientId}`, method);
          break;

        case MessageType.Error:
          const error = new Error(data.error);
          onError(error);
          websocket.close();
          break;

        case MessageType.Success:
          onSuccess(data.linked_account_id);
          websocket.close();
          break;

        default:
          return;
      }
    },
    [initiateLink, linkMethod]
  );

  const link = useCallback(() => {
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

      const hostUrl = host || DEFAULT_HOST;
      const wsPath = websocketPath || DEFAULT_WEBSOCKET_PATH;
      const hostBaseUrl = hostUrl.slice(-1) === '/' ? hostUrl.slice(0, -1) : hostUrl;
      let websocketBaseUrl: string;

      try {
        const baseUrl = new URL(hostBaseUrl);
        const websocketUrl = new URL(wsPath, baseUrl);
        websocketBaseUrl = websocketUrl
          .toString()
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');
      } catch (err) {
        throw new Error('Invalid host URL or websocket path');
      }

      const url = `${hostBaseUrl}/link/${linkToken}`;
      const websocket = new WebSocket(websocketBaseUrl);
      websocket.onmessage = (message: MessageEvent) => {
        handleMessage(message, websocket, url, onSuccess, onError);
      };
    });
  }, [linkToken, host, handleMessage]);

  return { link };
};
