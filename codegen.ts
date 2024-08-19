import type { CodegenConfig } from '@graphql-codegen/cli'
 
const config: CodegenConfig = {
   schema: 'https://api.studio.thegraph.com/query/63193/daochat-marketplace/version/latest',
   documents: ['src/lib/daochat-marketplace/schema.graphql'],
   generates: {
      'src/lib/daochat-marketplace/documents.generated.ts': {
        preset: 'client',
      },
    },
}
export default config