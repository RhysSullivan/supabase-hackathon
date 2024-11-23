import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { env } from './env';

config({
  path: '.env.local',
});

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // biome-ignore lint: Forbidden non-null assertion.
    url: env.DATABASE_URL!,
  },
});
