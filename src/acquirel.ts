import type Redis from "ioredis";

export class Acquirel {
  private releaseScriptHash: string | undefined;

  constructor(private readonly redis: Redis) {}

  async acquire(key: string, { ttl }: AcquireParameters): Promise<AcquisitionResult> {
    const effectiveKey = `acquirel:lock:${key}`;
    const releaseToken = crypto.randomUUID();

    const response = await this.redis.set(effectiveKey, releaseToken, "PX", ttl, "NX");

    if (response !== "OK") {
      const retry = () => this.acquire(key, { ttl });
      return new AcquisitionFailure(retry);
    }

    const release = () => this.release(effectiveKey, releaseToken);
    return new AcquiredLock(release);
  }

  private async release(effectiveKey: string, releaseToken: string): Promise<boolean> {
    if (!this.releaseScriptHash) {
      this.releaseScriptHash = await this.loadReleaseScript();
    }

    const response = await this.redis.evalsha(this.releaseScriptHash, 1, effectiveKey, releaseToken);
    return response !== 0;
  }

  private async loadReleaseScript() {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    // SCRIPT LOAD always returns a SHA1 hash of the script as a string
    // https://redis.io/docs/latest/commands/script-load/#return-information
    return this.redis.script("LOAD", script) as Promise<string>;
  }
}

export interface AcquireParameters {
  ttl: number;
}

export type AcquisitionResult = AcquiredLock | AcquisitionFailure;
export class AcquiredLock {
  constructor(public readonly release: () => Promise<boolean>) {}

  isAcquired(): this is AcquiredLock {
    return true;
  }
}

export class AcquisitionFailure {
  constructor(public readonly retry: () => Promise<AcquisitionResult>) {}

  isAcquired(): this is AcquiredLock {
    return false;
  }
}
