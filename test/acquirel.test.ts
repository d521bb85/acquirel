import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AcquiredLock, Acquirel, type AcquisitionFailure } from "../src";

describe("Acquirel", () => {
  let container: StartedRedisContainer;
  let client: Redis;
  let acquirel: Acquirel;

  beforeAll(async () => {
    container = await new RedisContainer("redis:8.2.1-alpine").start();
    client = new Redis({ port: container.getMappedPort(6379) });
    acquirel = new Acquirel(client);
  }, 60 * 1000);

  afterAll(async () => {
    await client.quit();
    await container.stop();

    client.set;
  });

  it("can acquire and release a lock", async () => {
    const lock = await acquirel.acquire("resource1", { ttl: 1000 });
    expect(lock.isAcquired()).toBe(true);
    expect(await (lock as AcquiredLock).release()).toBe(true);
  });

  it("can hold several locks for different keys at the same time", async () => {
    const lock1 = await acquirel.acquire("resource1", { ttl: 1000 });
    const lock2 = await acquirel.acquire("resource2", { ttl: 1000 });

    expect(lock1.isAcquired()).toBe(true);
    expect(lock2.isAcquired()).toBe(true);

    expect(await (lock1 as AcquiredLock).release()).toBe(true);
    expect(await (lock2 as AcquiredLock).release()).toBe(true);
  });

  it("cannot hold multiple locks for the same key at once", async () => {
    const lock1 = await acquirel.acquire("resource1", { ttl: 1000 });
    const lock1Challenger = await acquirel.acquire("resource1", { ttl: 1000 });

    expect(lock1.isAcquired()).toBe(true);
    expect(lock1Challenger.isAcquired()).toBe(false);

    expect(await (lock1 as AcquiredLock).release()).toBe(true);
  });

  it("a lock is being released automatically after its TTL expires", async () => {
    const lock = await acquirel.acquire("resource1", { ttl: 1000 });
    expect(lock.isAcquired()).toBe(true);

    await wait(1000);
    expect(await (lock as AcquiredLock).release()).toBe(false);
  });

  it("a new lock can be acquired once the existing one is released", async () => {
    const lock1 = await acquirel.acquire("resource1", { ttl: 1000 });
    let lock1Challenger = await acquirel.acquire("resource1", { ttl: 1000 });

    expect(lock1.isAcquired()).toBe(true);
    expect(lock1Challenger.isAcquired()).toBe(false);

    expect(await (lock1 as AcquiredLock).release()).toBe(true);

    lock1Challenger = await (lock1Challenger as AcquisitionFailure).retry();
    expect(lock1Challenger.isAcquired()).toBe(true);
    expect(await (lock1Challenger as AcquiredLock).release()).toBe(true);
  });

  it("an obsolete lock release attempt does not affect an actual lock", async () => {
    const lock1 = await acquirel.acquire("resource1", { ttl: 1000 });
    expect(lock1.isAcquired()).toBe(true);
    expect(await (lock1 as AcquiredLock).release()).toBe(true);

    const lock1Successor = await acquirel.acquire("resource1", { ttl: 1000 });
    expect(lock1Successor.isAcquired()).toBe(true);

    expect(await (lock1 as AcquiredLock).release()).toBe(false);
    expect(await (lock1Successor as AcquiredLock).release()).toBe(true);
  });
});

function wait(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
