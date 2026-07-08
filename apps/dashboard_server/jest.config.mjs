// jest.config.mjs
// Purpose: run the dashboard_server test suite with ts-jest.
// Scope: pure unit logic under __tests__/ (DB-dependent suites self-skip when
//        no Postgres is reachable). isolatedModules => transpile-only, so the
//        suite does not require @types/jest wired into tsconfig.
export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/*.test.ts'],
    // x_ = soft-deleted (repo "rm -rf" convention); never collect x_ specs.
    testPathIgnorePatterns: ['/node_modules/', '/x_'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
    },
};
