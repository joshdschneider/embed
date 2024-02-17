import { ProxyOptions } from '@kit/node';
import { AxiosResponse } from 'axios';

class ProxyService {
  public async proxy<T = any>(options: ProxyOptions): Promise<AxiosResponse<T>> {
    return {} as AxiosResponse<T>;
  }
}

export default new ProxyService();
