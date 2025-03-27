export interface ActionArgs {
  environmentId: string;
  integrationId: string;
  providerKey: string;
  connectionId: string;
  actionKey: string;
  payload: Record<string, any>;
}

export interface ActionFailureArgs {
  err: any;
  defaultTimeout: string;
  maxAttempts: number;
  args: ActionArgs;
}
