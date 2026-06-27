// vitest.config.ts
// Purpose: minimal vitest runner for dashboard_client_web unit/hook tests.
// Environment: jsdom (browser-like DOM for RTL renderHook).
// Aliases mirror tsconfig paths so @/* resolves to the app root.
// Not wired into turbo or CI — standalone via `pnpm test`.

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['**/*.test.{ts,tsx}'],
        exclude: ['node_modules', '__backup__', 'dist'],
    },
    resolve: {
        alias: [
            // Map @/* to app root — must use regex so @repo/* is NOT matched.
            { find: /^@\//, replacement: resolve(__dirname, '') + '/' },
        ],
    },
})
