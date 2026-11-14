import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker written into public/ by next-pwa on every build; it is
    // git-ignored too. public/custom-sw.js is ours and is still linted.
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
    "public/workbox-*.js.map",
    "public/swe-worker-*.js",
    "public/swe-worker-*.js.map",
    // Jest's coverage report, when one has been generated. Git-ignored.
    "coverage/**",
  ]),
  // These three are CommonJS on purpose: Jest loads its config and setup
  // with require(), and the icon script is run directly by node.
  {
    files: ["jest.config.js", "jest.api.setup.js", "scripts/generate-pwa-icons.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
