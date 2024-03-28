import type { Response } from 'express';
import logger from '../clients/logger.client';
import { ErrorCode } from '../utils/enums';

interface ErrorObject {
  code: ErrorCode;
  message?: string;
}

class ErrorService {
  public async reportError(err: unknown) {
    console.error(err);
    logger.error(`Exception caught: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
  }

  public errorResponse(res: Response, err: ErrorObject) {
    res.status(err.code ?? 500).send({
      object: 'error',
      error: this.getErrorFromCode(err.code),
      code: err.code,
      message: err.message,
    });
  }

  private getErrorFromCode(code: ErrorCode): string {
    switch (code) {
      case ErrorCode.BadRequest:
        return 'Bad Request';
      case ErrorCode.Unauthorized:
        return 'Unauthorized';
      case ErrorCode.Forbidden:
        return 'Forbidden';
      case ErrorCode.NotFound:
        return 'Not Found';
      default:
        return 'Internal Server Error';
    }
  }
}

export default new ErrorService();
