export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume: (key: string) => Promise<RateLimitResult>;
}
