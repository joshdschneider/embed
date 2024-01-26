import { Request, Response } from 'express';

class OAuthController {
  public async authorize(req: Request, res: Response) {
    const token = req.params['token'];
    res.status(200).send('OK');
  }

  public async callback(req: Request, res: Response) {
    //..
  }
}

export default new OAuthController();
