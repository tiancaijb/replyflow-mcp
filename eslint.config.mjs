// @ts-check

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["dist/", "node_modules/", "docs/"],
  },

  // Base recommended config
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript files — overrides and additions
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "vitest.config.ts"],
    rules: {
      // TypeScript handles this better
      "no-undef": "off",
      // Allow require() — project uses CJS interop
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Non-TS files — disable TS-specific rules
  {
    files: ["**/*.mjs", "**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Type-aware checks for project source + tests
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "tsconfig.lint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/prefer-optional-chain": "warn",
    },
  },

  // Node.js environment for .mjs scripts
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },

);
