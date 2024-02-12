import { useCallback } from 'react';

const DEFAULT_HOST = 'https://api.kit.zip';
const DEFAULT_WEBSOCKET_PATH = '/';

export type UseKitLinkProps = {
  linkToken: string;
  linkMethod?: 'popup' | 'redirect';
  redirectUrl?: string;
  host?: string;
  websocketPath?: string;
};

enum MessageType {
  ConnectionAck = 'connection_ack',
  Error = 'error',
  Success = 'success',
}

export const useKitLink = ({
  linkToken,
  linkMethod,
  redirectUrl,
  host,
  websocketPath,
}: UseKitLinkProps) => {
  const appendParamsToUrl = (url: string, params: Record<string, string>) => {
    const baseUrl = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      baseUrl.searchParams.set(key, value);
    });

    return baseUrl.toString();
  };

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

  const openPopup = useCallback(
    (url: string) => {
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

      window.open(url, '_blank', featuresString);
    },
    [getPopupLayout, featuresToString]
  );

  const prefersDarkMode = () => {
    const pefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return pefersDark.toString();
  };

  const handleMessage = useCallback(
    (
      message: MessageEvent,
      websocket: WebSocket,
      url: string,
      onSuccess: (linkedAccountId: string) => any,
      onError: (error: Error) => any
    ) => {
      const data = JSON.parse(message.data);
      switch (data.message_type) {
        case MessageType.ConnectionAck:
          const params = {
            ws_client_id: data.ws_client_id,
            link_method: 'popup',
            prefers_dark_mode: prefersDarkMode(),
          };
          const popupUrl = appendParamsToUrl(url, params);
          openPopup(popupUrl);
          return;

        case MessageType.Error:
          const error = new Error(data.error);
          onError(error);
          websocket.close();
          return;

        case MessageType.Success:
          onSuccess(data.linked_account_id);
          websocket.close();
          return;

        default:
          return;
      }
    },
    [appendParamsToUrl, prefersDarkMode, openPopup, redirectUrl]
  );

  const link = useCallback(() => {
    if (!linkToken) {
      throw new Error('Link token is required');
    }

    return new Promise((resolve, reject) => {
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

      const onSuccess = (linkedAccountId: string) => {
        return resolve(linkedAccountId);
      };

      const onError = (error: Error) => {
        return reject(error);
      };

      const url = `${hostBaseUrl}/link/${linkToken}`;

      if (linkMethod === 'popup' || (!linkMethod && !redirectUrl)) {
        const websocket = new WebSocket(websocketBaseUrl);
        websocket.onmessage = (message: MessageEvent) => {
          handleMessage(message, websocket, url, onSuccess, onError);
        };
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
  }, [linkToken, linkMethod, host, websocketPath, handleMessage, appendParamsToUrl]);

  return { link };
};
