// Prisma client singleton. Uses the @prisma/adapter-pg driver to talk to
// Postgres (Supabase) over the standard libpq protocol.
//
// Prisma 7 requires a driver adapter for native database connections. The
// connection string is read from DATABASE_URL in the environment.

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — check .env.local')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
