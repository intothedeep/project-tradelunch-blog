import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import json from '@rollup/plugin-json';

import pkg from './package.json' with { type: 'json' };

export default [
    {
        input: 'src/index.ts',
        external: [
            ...Object.keys(pkg.peerDependencies || {}),
            // 필요시 추가 external (예: react, lodash 등)
        ],
        plugins: [
            json(),
            peerDepsExternal(),
            nodeResolve(),
            commonjs(),
            typescript({ tsconfig: './tsconfig.json', sourceMap: true }),
        ],
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true,
            },
            {
                file: pkg.module,
                format: 'esm',
                sourcemap: true,
            },
        ],
    },
    {
        input: 'src/types/index.ts',
        external: [...Object.keys(pkg.peerDependencies || {})],
        plugins: [
            json(),
            peerDepsExternal(),
            nodeResolve(),
            commonjs(),
            typescript({ tsconfig: './tsconfig.json', sourceMap: true }),
        ],
        output: [
            {
                file: 'dist/types.cjs',
                format: 'cjs',
                sourcemap: true,
            },
            {
                file: 'dist/types.mjs',
                format: 'esm',
                sourcemap: true,
            },
        ],
    },
];
