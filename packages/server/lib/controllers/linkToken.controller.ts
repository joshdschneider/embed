import { Request, Response } from 'express';

class LinkTokenController {
  public async createLinkToken(req: Request, res: Response) {
    console.log('createLinkToken');
  }

  public async getLinkToken(req: Request, res: Response) {
    console.log('getLinkToken');
  }
}

export default new LinkTokenController();
