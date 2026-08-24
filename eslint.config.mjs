import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * The layering rules below are the load-bearing part of this config.
 *
 * `core/` holds the domain: pure functions, no framework, no I/O. `ui/` holds
 * presentation: no domain rules, no data fetching. Keeping those two apart is
 * what makes a future visual redesign a change to `ui/` and nothing else — so
 * the boundary is enforced by the linter rather than by good intentions.
 */
const boundary = (message, patterns) => ({
  "no-restricted-imports": ["error", { patterns: patterns.map((group) => ({ ...group, message })) }],
});

export default tseslint.config(
  { ignores: ["legacy/**", "dist/**", "src/web/routeTree.gen.ts"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  {
    files: ["src/core/**"],
    rules: boundary(
      "core/ is the pure domain: it may only import from core/ and zod.",
      [{ group: ["@server/*", "@web/*", "node:*", "react", "react-*", "drizzle-orm*", "hono*"] }],
    ),
  },

  {
    files: ["src/server/**"],
    rules: boundary("The server must never import frontend code.", [{ group: ["@web/*"] }]),
  },

  {
    files: ["src/web/**"],
    ...reactHooks.configs.flat["recommended-latest"],
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@server/*"],
              allowTypeImports: true,
              message:
                "The SPA may only take *types* from the server, never its implementation.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/web/ui/**"],
    rules: boundary(
      "ui/ is presentation only. It must not know about features, domain rules or the API — that is what keeps a redesign cheap.",
      [{ group: ["@web/features/*", "@web/api/*", "@core/timesheet", "@core/policy", "@core/schedule"] }],
    ),
  },

  {
    files: ["**/*.test.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
