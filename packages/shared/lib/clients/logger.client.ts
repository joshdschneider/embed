import type { Logger as WinstonLogger } from 'winston';
import winston from 'winston';
import { getLogLevel, isProd } from '../utils/constants';

class Logger {
  winstonLogger: WinstonLogger;

  constructor() {
    this.winstonLogger = winston.createLogger({
      levels: winston.config.syslog.levels,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          return `${info['timestamp']} [${info['level'].toUpperCase()}] ${info['message']}`;
        })
      ),
    });

    if (!isProd()) {
      this.winstonLogger.add(
        new winston.transports.Console({
          level: getLogLevel(),
        })
      );
    }
  }
}

export default new Logger().winstonLogger;
