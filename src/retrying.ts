import type { AcquisitionResult } from "./acquirel";

export interface WithTimeoutParameters {
  timeout: number;
  interval: number;
}

export async function withTimeout(
  resultOrPromise: AcquisitionResult | Promise<AcquisitionResult>,
  { timeout, interval }: WithTimeoutParameters
): Promise<AcquisitionResult> {
  let lastResult = await resultOrPromise;
  if (lastResult.isAcquired()) {
    return lastResult;
  }

  const startTime = Date.now();

  while (Date.now() - startTime + interval < timeout) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    lastResult = await lastResult.retry();
    if (lastResult.isAcquired()) {
      return lastResult;
    }
  }

  return lastResult;
}

export interface WithMaxRetriesParameters {
  maxRetries: number;
  interval: number;
}

export async function withMaxRetries(
  resultOrPromise: AcquisitionResult | Promise<AcquisitionResult>,
  { maxRetries, interval }: WithMaxRetriesParameters
): Promise<AcquisitionResult> {
  let lastResult = await resultOrPromise;
  if (lastResult.isAcquired()) {
    return lastResult;
  }

  let retriesLeft = maxRetries;

  while (retriesLeft > 0) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    lastResult = await lastResult.retry();
    if (lastResult.isAcquired()) {
      return lastResult;
    }

    retriesLeft -= 1;
  }

  return lastResult;
}
