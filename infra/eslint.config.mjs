import appsync from "@aws-appsync/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

// Resolver code runs in AppSync's APPSYNC_JS runtime, which supports only a
// subset of JavaScript (no regex, try/throw, Set, sort comparators, ...).
// Lint the resolver sources and the shared builders they bundle.
export default [
  {
    files: ["graphql/resolvers/src/**/*.ts"],
    ignores: ["graphql/resolvers/src/**/*.test.ts"],
    plugins: appsync.configs.recommended.plugins,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./graphql/resolvers/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...appsync.configs.recommended.rules,
      // Not covered by the plugin but rejected by APPSYNC_JS as well.
      "no-restricted-syntax": [
        "error",
        { selector: "ThrowStatement", message: "throw is not supported in APPSYNC_JS; use util.error()" },
        { selector: "NewExpression[callee.name=/^(Set|Map|WeakMap|WeakSet|RegExp|Date|Error|Promise)$/]", message: "This constructor is not supported in APPSYNC_JS" },
        // Documented gaps the plugin's deny-list does not cover.
        { selector: "CallExpression[callee.property.name='sort'][arguments.length>0]", message: "Array.prototype.sort() takes no arguments in APPSYNC_JS" },
        { selector: "MemberExpression[object.name='Math'][property.name!=/^(random|min|max|round|floor|ceil)$/]", message: "Only Math.random/min/max/round/floor/ceil are supported in APPSYNC_JS" },
        { selector: "MemberExpression[object.name='Number'][property.name!=/^(isFinite|isNaN)$/]", message: "Only Number.isFinite/isNaN are supported in APPSYNC_JS" },
        { selector: "CallExpression[callee.property.name='includes']", message: "includes() is not in the documented APPSYNC_JS API; use indexOf()" },
      ],
    },
  },
];
