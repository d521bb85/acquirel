import type Redis from "ioredis";

export class Acquirel {
  constructor(private readonly redis: Redis) {}

  async attemptAcquire(key: string, { ttl }: AttemptAcquireParameters): Promise<Lock | AcquisitionFailure> {
    const effectiveKey = `acquirel:lock:${key}`;
    const releaseToken = this.getReleaseToken();

    const response = await this.redis.set(effectiveKey, releaseToken, "PX", ttl, "NX");

    if (response !== "OK") {
      const retry = () => this.attemptAcquire(key, { ttl });
      return new AcquisitionFailure(retry);
    }

    const release = () => this.release(effectiveKey, releaseToken);
    return new Lock(release);
  }

  async attemptAcquireWithTimeout(
    key: string,
    { ttl, timeout, interval }: AttemptAcquireWithTimeoutParameters
  ): Promise<Lock | AcquisitionFailure> {
    let lastResult: Lock | AcquisitionFailure;

    const startTime = Date.now();
    while (true) {
      lastResult = await this.attemptAcquire(key, { ttl });
      if (lastResult.isAcquired()) {
        return lastResult;
      }

      const elapsedTime = Date.now() - startTime;
      if (elapsedTime + interval >= timeout) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return lastResult;
  }

  async attemptAcquireWithMaxRetries(
    key: string,
    { ttl, maxRetries, interval }: AttemptAcquireWithMaxRetriesParameters
  ): Promise<Lock | AcquisitionFailure> {
    let lastResult: Lock | AcquisitionFailure;

    let attemptsLeft = maxRetries + 1;
    while (true) {
      lastResult = await this.attemptAcquire(key, { ttl });
      if (lastResult.isAcquired()) {
        return lastResult;
      }

      attemptsLeft -= 1;
      if (attemptsLeft <= 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return lastResult;
  }

  private getReleaseToken(): string {
    return crypto
      .getRandomValues(new Uint8Array(4))
      .reduce((token, byte) => `${token}${byte.toString(16).padStart(2, "0")}`, "");
  }

  private async release(effectiveKey: string, releaseToken: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const response = await this.redis.eval(script, 1, effectiveKey, releaseToken);
    return response !== 0;
  }
}

export interface AttemptAcquireParameters {
  ttl: number;
}

export interface AttemptAcquireWithTimeoutParameters {
  ttl: number;
  timeout: number;
  interval: number;
}

export interface AttemptAcquireWithMaxRetriesParameters {
  ttl: number;
  maxRetries: number;
  interval: number;
}

export interface AcquisitionResult {
  isAcquired(): this is Lock;
}

export class Lock implements AcquisitionResult {
  constructor(public readonly release: () => Promise<boolean>) {}

  isAcquired(): this is Lock {
    return true;
  }
}

export class AcquisitionFailure implements AcquisitionResult {
  constructor(public readonly retry: () => Promise<AcquisitionResult>) {}

  isAcquired(): this is Lock {
    return false;
  }
}
