import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const supabaseOnlyInApiMessage =
  "Supabase is only accessed inside src/api/ (CLAUDE.md principle 3). Import a function from src/api/ instead.";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Guardrail: the Supabase client and SDK never leave the data layer.
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@supabase/*"], message: supabaseOnlyInApiMessage },
            {
              group: ["@/api/client", "**/api/client"],
              message: supabaseOnlyInApiMessage,
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
