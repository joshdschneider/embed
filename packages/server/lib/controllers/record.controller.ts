import { DEFAULT_ERROR_MESSAGE, ErrorCode, errorService } from '@embed/shared';
import type { Request, Response } from 'express';

class RecordController {
  public async listRecords(req: Request, res: Response) {
    try {
      // listRecords
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async retrieveRecord(req: Request, res: Response) {
    try {
      // retrieveRecord
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async queryRecords(req: Request, res: Response) {
    try {
      // queryRecords
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new RecordController();
