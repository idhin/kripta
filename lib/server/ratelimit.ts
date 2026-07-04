import "server-only";
import { RateLimiterMemory } from "rate-limiter-flexible";

/**
 * Rate limiter in-memory (cukup untuk single instance self-hosted).
 * Untuk skala multi-instance, ganti ke RateLimiterPostgres/Redis.
 */
const limiters = {
  login: new RateLimiterMemory({ points: 10, duration: 900, blockDuration: 900 }),
  install: new RateLimiterMemory({ points: 5, duration: 3600 }),
  invite: new RateLimiterMemory({ points: 30, duration: 3600 }),
  recovery: new RateLimiterMemory({ points: 8, duration: 900, blockDuration: 900 }),
  mutate: new RateLimiterMemory({ points: 120, duration: 60 }),
};

export type LimiterName = keyof typeof limiters;

/** Mengembalikan true bila diizinkan, false bila melebihi batas. */
export async function consumeRate(name: LimiterName, key: string): Promise<boolean> {
  try {
    await limiters[name].consume(key);
    return true;
  } catch {
    return false;
  }
}
