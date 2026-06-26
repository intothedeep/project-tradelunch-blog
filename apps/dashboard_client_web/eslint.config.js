import { defineConfig, globalIgnores } from 'eslint/config';
import { nextJsConfig } from '@repo/eslint-config/next-js';

const eslintConfig = defineConfig([
    ...nextJsConfig,
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
