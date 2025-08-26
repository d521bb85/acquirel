import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, it } from "vitest";

describe("Lock", () => {
  let container: StartedRedisContainer;
  let client: Redis;

  beforeAll(async () => {
    container = await new RedisContainer("redis:8.2.1-alpine").start();
    client = new Redis({ port: container.getMappedPort(6379) });
  }, 60 * 1000);

  afterAll(async () => {
    await client.quit();
    await container.stop();

    client.set;
  });

  it("connects to Redis", async () => {
    await client.ping();
  });
});
