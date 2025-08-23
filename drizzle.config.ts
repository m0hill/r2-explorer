import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  dbCredentials: {
    url: process.env.DRIZZLE_DATABASE_URL,
  },
})
