import { PrismaClient } from '@prisma/client'
import { validateEnv } from './env'

// Validate environment at startup
validateEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['warn', 'error']
      : ['query', 'warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db