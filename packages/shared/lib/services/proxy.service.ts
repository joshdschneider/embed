import { ProxyOptions } from '@kit/node';
import { AxiosResponse } from 'axios';
import linkedAccountService from './linkedAccount.service';

class ProxyService {
  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    const linkedAccount = await linkedAccountService.getLinkedAccountById(options.linkedAccountId);
    return {} as AxiosResponse<T>;
  }
}

export default new ProxyService();
