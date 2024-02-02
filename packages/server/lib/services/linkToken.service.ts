import { LinkToken } from '@prisma/client';
import { prisma } from '../utils/prisma';
import errorService from './error.service';

class LinkTokenService {
  public async createLinkToken(linkToken: LinkToken): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.create({
        data: {
          ...linkToken,
          metadata: linkToken.metadata || undefined,
          configuration: linkToken.configuration || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async listLinkTokens(environmentId: string): Promise<LinkToken[] | null> {
    try {
      return await prisma.linkToken.findMany({
        where: { environment_id: environmentId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async getLinkTokenById(linkTokenId: string): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.findUnique({
        where: { id: linkTokenId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async updateLinkToken(
    linkTokenId: string,
    data: Partial<LinkToken>
  ): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.update({
        where: { id: linkTokenId },
        data: {
          ...data,
          metadata: data.metadata || undefined,
          configuration: data.configuration || undefined,
        },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }

  public async deleteLinkToken(linkTokenId: string): Promise<LinkToken | null> {
    try {
      return await prisma.linkToken.delete({
        where: { id: linkTokenId },
      });
    } catch (err) {
      await errorService.reportError(err);
      return null;
    }
  }
}

export default new LinkTokenService();
