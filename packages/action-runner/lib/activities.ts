import { errorService } from '@embed/shared';
import { CancelledFailure } from '@temporalio/activity';
import { TerminatedFailure, TimeoutFailure } from '@temporalio/workflow';
import { ActionArgs, ActionFailureArgs } from './types';

export async function triggerAction(args: ActionArgs): Promise<void> {
  // trigger action
}

export async function reportFailure(args: ActionFailureArgs): Promise<void> {
  await errorService.reportError(args.err);

  let message: string = 'Action failed';
  if (
    args.err instanceof CancelledFailure ||
    args.err.cause instanceof TerminatedFailure ||
    args.err.cause?.name === 'TerminatedFailure'
  ) {
    message += ` due to cancellation`;
  } else if (
    args.err.cause instanceof TimeoutFailure ||
    args.err.cause?.name === 'TimeoutFailure'
  ) {
    if (args.err.cause.timeoutType === 3) {
      message += `, timeout exceeded ${args.defaultTimeout}`;
    } else {
      message += `, max attempts of ${args.maxAttempts} exceeded`;
    }
  }

  // handle action failure
}
