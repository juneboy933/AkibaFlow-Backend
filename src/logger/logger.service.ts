import { Injectable } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info({ message, context });
  }

  error(message: string, context?: string) {
    this.logger.error({ message, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn({ message, context });
  }
}
