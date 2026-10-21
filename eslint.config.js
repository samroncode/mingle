import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const functionsGlob = "supabase/functions/**/*.ts";

const supabaseOnlyInApiMessage =
  "Supabase is only accessed inside src/api/ (CLAUDE.md principle 3). Import a function from src/api/ instead.";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [functionsGlob],
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
    // Generated shadcn/ui files export variant helpers next to components.
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Edge Functions run on Deno, not in the browser. They aren't part of the
    // app's tsconfig (Deno typechecks them when served), so lint without type
    // information and with Deno's globals.
    files: [functionsGlob],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.denoBuiltin,
    },
  },
  {
    // Guardrail: the Supabase client and SDK never leave the data layer.
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/api/**", functionsGlob],
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
