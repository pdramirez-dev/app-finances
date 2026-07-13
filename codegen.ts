import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: ["infra/graphql/schema.graphql", "infra/graphql/aws-scalars.codegen.graphql"],
  documents: ["src/lib/appsync/**/*.ts", "!src/lib/appsync/graphql.generated.ts"],
  generates: {
    "src/lib/appsync/graphql.generated.ts": {
      plugins: ["typescript-operations"],
      config: {
        enumsAsTypes: true,
        skipTypename: true,
        scalars: {
          AWSDate: "string",
          AWSDateTime: "string",
          AWSEmail: "string",
          AWSPhone: "string",
          AWSURL: "string",
          AWSJSON: "unknown",
        },
      },
    },
  },
};

export default config;
