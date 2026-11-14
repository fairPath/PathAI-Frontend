import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
// import { dirname } from "path";
// import { fileURLToPath } from "url";
import prettier from 'eslint-config-prettier';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-e2e/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      // Playwright output
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
    ],
  },
];

export default eslintConfig;
