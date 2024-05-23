import * as Sentry from '@sentry/node';
import { getSentryDsn, isProd } from './constants';

export function initSentry() {
  if (isProd() && !!getSentryDsn()) {
    Sentry.init({ dsn: getSentryDsn() });
  }
}
