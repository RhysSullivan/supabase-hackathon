import { Redis } from '@upstash/redis'
import { env } from '~/env'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: env.UPSTASH_REDIS_URL,
    token: env.UPSTASH_REDIS_TOKEN,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
