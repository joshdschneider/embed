import { Request, Response } from 'express';
import errorService, { ErrorCode } from '../services/error.service';
import providerService from '../services/provider.service';

class ProviderController {
  public async listProviders(req: Request, res: Response): Promise<void> {
    const providers = await providerService.listProviders();
    if (!providers) {
      return errorService.errorResponse(res, {
        code: ErrorCode.InternalServerError,
        message: 'Something went wrong',
      });
    }

    res.status(200).send({
      object: 'list',
      data: providers,
    });
  }

  public async retrieveProvider(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;
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

    res.status(200).send({
      object: 'provider',
      ...providerSpec,
    });
  }
}

export default new ProviderController();
