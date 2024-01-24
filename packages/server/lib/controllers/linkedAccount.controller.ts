import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import linkedAccountService from '../services/linkedAccount.service';
import { DEFAULT_ERROR_MESSAGE, ENVIRONMENT_ID_LOCALS_KEY } from '../utils/constants';

class LinkedAccountController {
  public async listLinkedAccounts(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const searchQuery = req.query['search_query'] as string | undefined;
      const endingBefore = req.query['ending_before'] as string | undefined;
      const startingAfter = req.query['starting_after'] as string | undefined;
      const limit = parseInt(req.query['limit'] as string) || 20;

      const list = await linkedAccountService.listLinkedAccounts(
        environmentId,
        { limit, endingBefore, startingAfter },
        searchQuery
      );

      if (!list) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const { linkedAccounts, firstId, lastId, hasMore } = list;

      res.status(200).json({
        object: 'list',
        data: linkedAccounts,
        first_id: firstId,
        last_id: lastId,
        has_more: hasMore,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }
}

export default new LinkedAccountController();
