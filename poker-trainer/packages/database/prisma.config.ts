import { defineConfig } from 'prisma/config'
import { loadWorkspaceEnvironment } from './src/environment'

loadWorkspaceEnvironment()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'mysql://poker:poker@localhost:3306/poker_trainer',
  },
})
