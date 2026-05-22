import { defineConfig } from '@prisma/config'
import { config as loadEnv } from 'dotenv'

// Prisma 7 doesn't auto-load `.env` for prisma.config.ts the way the schema
// loader does, so we explicitly pull DATABASE_URL + DIRECT_URL in here.
loadEnv()
loadEnv({ path: '.env.local', override: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    // Prefer DIRECT_URL (session pooler, port 5432) so `prisma migrate deploy`
    // can run DDL. Falls back to DATABASE_URL for `prisma generate` and the
    // runtime client. Vercel and the Next.js runtime read DATABASE_URL directly.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
})
