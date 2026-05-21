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
    url: process.env.DATABASE_URL!,
  },
})
