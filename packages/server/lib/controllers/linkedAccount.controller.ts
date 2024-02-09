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

      const linkedAccountsList = linkedAccounts.map((linkedAccount) => {
        return {
          id: linkedAccount.id,
          environment_id: linkedAccount.environment_id,
          integration_provider: linkedAccount.integration_provider,
          configuration: linkedAccount.configuration,
          metadata: linkedAccount.metadata,
          created_at: linkedAccount.created_at,
          updated_at: linkedAccount.updated_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: linkedAccountsList,
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

  public async retrieveLinkedAccount(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];
      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      }

      const linkedAccount = await linkedAccountService.getLinkedAccountById(linkedAccountId);
      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.NotFound,
          message: 'Integration not found',
        });
      }

      let credentials = linkedAccount.credentials;
      try {
        credentials = JSON.parse(credentials);
      } catch (err) {
        await errorService.reportError(err);
      }

      res.status(200).send({
        object: 'linked_account',
        id: linkedAccount.id,
        environment_id: linkedAccount.environment_id,
        integration_provider: linkedAccount.integration_provider,
        credentials,
        configuration: linkedAccount.configuration,
        metadata: linkedAccount.metadata,
        created_at: linkedAccount.created_at,
        updated_at: linkedAccount.updated_at,
      });
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async deleteLinkedAccount(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];

      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'API key ID missing',
        });
      }

      const linkedAccount = await linkedAccountService.deleteLinkedAccount(linkedAccountId);

      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      res.status(200).json({
        object: 'linked_account',
        id: linkedAccount.id,
        deleted: true,
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
