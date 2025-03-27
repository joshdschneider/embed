import { ErrorCode, errorService, providerService } from '@embed/shared';
import type { Request, Response } from 'express';

class ProviderController {
  public async listProviders(req: Request, res: Response): Promise<void> {
    const providers = await providerService.listProviders();
    if (!providers) {
      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: 'Something went wrong',
      });
    }

    const providerObjects = providers.map((provider) => {
      const { unique_key, ...rest } = provider;
      return {
        object: 'provider',
        unique_key,
        schema: { ...rest },
      };
    });

    res.status(200).send({ object: 'list', data: providerObjects });
  }

  public async retrieveProvider(req: Request, res: Response): Promise<void> {
    const { unique_key: slug } = req.params;

    if (!slug) {
      return errorService.errorResponse(res, {
        code: ErrorCode.BadRequest,
        message: 'Missing provider slug',
      });
    }

    const providerSpec = await providerService.getProviderSpec(slug);
    if (!providerSpec) {
      return errorService.errorResponse(res, {
        code: ErrorCode.NotFound,
        message: 'Provider specification not found',
      });
    }

    const { unique_key, ...rest } = providerSpec;

    res.status(200).send({
      object: 'provider',
      unique_key,
      schema: { ...rest },
    });
  }
}

export default new ProviderController();
