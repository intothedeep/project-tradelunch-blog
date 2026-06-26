import { config as baseConfig } from '@repo/jest-config/base';
import pkg from './package.json' with { type: 'json' };

export const jestConfig = {
    ...baseConfig,
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    displayName: pkg.name,
    rootDir: '.',
};
