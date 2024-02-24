import {
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  ErrorCode,
  errorService,
  linkedAccountService,
} from '@kit/shared';
import type { Request, Response } from 'express';
import { zodError } from '../utils/helpers';
import {
  LinkedAccountDeletedObject,
  LinkedAccountObject,
  Metadata,
  PaginationParametersSchema,
  UpdateLinkedAccountRequestSchema,
} from '../utils/types';

class LinkedAccountController {
  public async listLinkedAccounts(req: Request, res: Response) {
    try {
      const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
      const searchQuery = req.query['query'] as string | undefined;
      const parsedParams = PaginationParametersSchema.safeParse(req.query);

      if (!parsedParams.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedParams.error),
        });
      }

      const { before, after, limit, order } = parsedParams.data;
      const list = await linkedAccountService.listLinkedAccounts(environmentId, {
        query: searchQuery,
        order,
        pagination: { after, before, limit },
      });

      if (!list) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const { linkedAccounts, firstId, lastId, hasMore } = list;
      const linkedAccountObjects: LinkedAccountObject[] = linkedAccounts.map((linkedAccount) => {
        return {
          object: 'linked_account',
          id: linkedAccount.id,
          integration: linkedAccount.integration_key,
          configuration: linkedAccount.configuration as Record<string, any>,
          metadata: linkedAccount.metadata as Metadata,
          created_at: linkedAccount.created_at,
          updated_at: linkedAccount.updated_at,
        };
      });

      res.status(200).json({
        object: 'list',
        data: linkedAccountObjects,
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

      const linkedAccountObject: LinkedAccountObject = {
        object: 'linked_account',
        id: linkedAccount.id,
        integration: linkedAccount.integration_key,
        configuration: linkedAccount.configuration as Record<string, any>,
        metadata: linkedAccount.metadata as Metadata,
        created_at: linkedAccount.created_at,
        updated_at: linkedAccount.updated_at,
      };

      res.status(200).send(linkedAccountObject);
    } catch (err) {
      await errorService.reportError(err);

      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  public async updateLinkedAccount(req: Request, res: Response) {
    try {
      const linkedAccountId = req.params['linked_account_id'];
      if (!linkedAccountId) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: 'Linked account ID missing',
        });
      }

      const parsedBody = UpdateLinkedAccountRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return errorService.errorResponse(res, {
          code: ErrorCode.BadRequest,
          message: zodError(parsedBody.error),
        });
      }

      const linkedAccount = await linkedAccountService.updateLinkedAccount(linkedAccountId, {
        metadata: parsedBody.data.metadata,
      });

      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const linkedAccountObject: LinkedAccountObject = {
        object: 'linked_account',
        id: linkedAccount.id,
        integration: linkedAccount.integration_key,
        configuration: linkedAccount.configuration as Record<string, any>,
        metadata: linkedAccount.metadata as Metadata,
        created_at: linkedAccount.created_at,
        updated_at: linkedAccount.updated_at,
      };

      res.status(200).send(linkedAccountObject);
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
          message: 'Linked account ID missing',
        });
      }

      const linkedAccount = await linkedAccountService.deleteLinkedAccount(linkedAccountId);
      if (!linkedAccount) {
        return errorService.errorResponse(res, {
          code: ErrorCode.InternalServerError,
          message: DEFAULT_ERROR_MESSAGE,
        });
      }

      const linkedAccountDeletedObject: LinkedAccountDeletedObject = {
        object: 'linked_account.deleted',
        id: linkedAccount.id,
        deleted: true,
      };

      res.status(200).json(linkedAccountDeletedObject);
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
