import usageService from '../services/usage.service';
import { UsageType } from '../utils/enums';
import { BaseContext, BaseContextOptions } from './base.context';

export type ActionContextOptions = BaseContextOptions & {
  providerKey: string;
  actionKey: string;
  actionRunId: string;
  input: Record<string, any>;
};

export class ActionContext extends BaseContext {
  public providerKey: string;
  public actionKey: string;
  public actionRunId: string;
  public input: Record<string, any>;
  public output: Record<string, any> | null;
  public status: number | null;

  constructor(options: ActionContextOptions) {
    super(options);
    this.providerKey = options.providerKey;
    this.actionKey = options.actionKey;
    this.actionRunId = options.actionRunId;
    this.activityId = options.activityId;
    this.input = options.input;
    this.output = null;
    this.status = null;
  }

  public async saveOutput({ status, output }: { status: number; output: Record<string, any> }) {
    this.output = output;
    this.status = status;
  }

  public async reportResults(): Promise<{
    status: number | null;
    output: Record<string, any> | null;
  }> {
    usageService.reportUsage({
      usageType: UsageType.Action,
      environmentId: this.environmentId,
      integrationId: this.integrationId,
      connectionId: this.connectionId,
      actionRunId: this.actionRunId,
    });

    return { status: this.status, output: this.output };
  }
}
