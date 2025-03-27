import {
  DEFAULT_BRANDING,
  DEFAULT_ERROR_MESSAGE,
  ENVIRONMENT_ID_LOCALS_KEY,
  environmentService,
  errorService,
  getServerUrl,
} from '@embed/shared';
import type { Request, Response } from 'express';
import type { ErrorTemplateData, PreviewTemplateData } from '../utils/types';

class PreviewController {
  public async preview(req: Request, res: Response) {
    const nonce = res.locals['nonce'];
    const environmentId = res.locals[ENVIRONMENT_ID_LOCALS_KEY];
    const prefersDarkMode = req.query['prefers_dark_mode'] === 'true';
    const override = req.query['branding'];
    let branding;

    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.removeHeader('X-Frame-Options');

    try {
      const environment = await environmentService.getEnvironmentById(environmentId);
      if (!environment) {
        throw new Error(`Failed to retrieve environment ${environmentId}`);
      }

      branding = environment.branding;
      if (override && typeof override === 'string') {
        try {
          branding = JSON.parse(override);
        } catch {
          // ignore
        }
      }

      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('SERVER_URL is undefined');
      }

      const data: PreviewTemplateData = {
        server_url: serverUrl,
        integration: {
          name: 'Google',
          logo_url: 'https://embed-integrations.s3.amazonaws.com/google.svg',
          logo_url_dark_mode: undefined,
          help_link: 'https://cloud.google.com/iam/docs/service-account-overview',
        },
        branding,
        prefers_dark_mode: prefersDarkMode,
        nonce,
      };

      res.render('preview', data);
    } catch (err) {
      await errorService.reportError(err);

      const data: ErrorTemplateData = {
        error_message: DEFAULT_ERROR_MESSAGE,
        branding: branding || DEFAULT_BRANDING,
        prefers_dark_mode: prefersDarkMode,
      };

      res.render('error', data);
    }
  }
}

export default new PreviewController();
