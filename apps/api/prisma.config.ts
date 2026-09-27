import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` needs no connection, so a placeholder lets CI generate the client without a database.
    // Migrations need a direct (non-pooled) connection; serverless hosts run the app through the
    // pooled one, so they give the direct URL separately.
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://placeholder@localhost:5432/placeholder',
  },
})
