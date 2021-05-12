// Copyright (c) 2020 WiseTime. All rights reserved.

export type RetryPolicy = {
  shouldRetry: (response: Response) => boolean,
  maxRetries: number,
  willRetry: () => Promise<void>,
  onGiveUp: () => void,
  maxDelay: number,
}

const noop = () => {/* Do nothing */}

/**
 * Retry calls that fail with a HTTP Response with non-OK status code (not 2xx).
 * Note that calls that fail for other reasons (e.g. network failure) will not be retried.
 *
 * @param shouldRetry - Whether the call should be retried.
 * @param maxRetries  - Maximum number of retries before giving up.
 * @param willRetry   - The call will be retried when the returned promise resolves.
 * @param onGiveUp    - Callback that is called when the number of retries have been exhausted.
 * @param maxDelay    - Calls will be retried with exponential backoff. `maxDelay` caps the time
 *                      between retries to a set number of milliseconds.
 */
export const responseNotOk = (
  shouldRetry: (response: Response) => boolean,
  maxRetries = 2,
  willRetry: () => Promise<void> = () => Promise.resolve(),
  onGiveUp: () => void = noop,
  maxDelay = 1000 * 60 * 60,  // Defaults to 1 hour.
): RetryPolicy => ({
  shouldRetry,
  maxRetries,
  willRetry,
  onGiveUp,
  maxDelay,
} as const)

// Never retry calls.
export const never: RetryPolicy = {
  shouldRetry: (_: Response) => false,
  maxRetries: 0,
  willRetry: () => Promise.reject("Unexpected retry attempt for retry policy never"),
  onGiveUp: noop,
  maxDelay: 0,
} as const

