import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReact from 'eslint-plugin-react';
import globals from 'globals';
import pluginNext from '@next/eslint-plugin-next';
import { config as baseConfig } from './base.js';

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const nextJsConfig = [
    ...baseConfig,
    js.configs.recommended,
    eslintConfigPrettier,
    ...tseslint.configs.recommended,
    {
        ...pluginReact.configs.flat.recommended,
        languageOptions: {
            ...pluginReact.configs.flat.recommended.languageOptions,
            globals: {
                ...globals.serviceworker,
            },
        },
    },
    {
        plugins: {
            '@next/next': pluginNext,
        },
        rules: {
            ...pluginNext.configs.recommended.rules,
            ...pluginNext.configs['core-web-vitals'].rules,
        },
    },
    {
        plugins: {
            'react-hooks': pluginReactHooks,
        },
        settings: { react: { version: 'detect' } },
        rules: {
            ...pluginReactHooks.configs.recommended.rules,
            // React scope no longer necessary with new JSX transform.
            'react/react-in-jsx-scope': 'off',
            // This is a TypeScript codebase: component prop shapes are enforced
            // by tsc via prop interfaces, so the runtime PropTypes check is
            // redundant noise. Disable it project-wide.
            'react/prop-types': 'off',
            // eslint-plugin-react-hooks@7's `recommended` preset bundles the
            // React Compiler ruleset. This codebase is NOT compiled with the
            // React Compiler, and these four rules flag legitimate,
            // hydration-safe patterns (mount guards that setState on mount,
            // refs synced during render, third-party canvas/ref mutation,
            // memoized impure id generators). Enabling them would force risky
            // restructurings of working code. Keep `rules-of-hooks` (error) and
            // `exhaustive-deps` (warn); defer the compiler rules until the
            // React Compiler is actually adopted.
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/immutability': 'off',
            'react-hooks/purity': 'off',
        },
    },
];
