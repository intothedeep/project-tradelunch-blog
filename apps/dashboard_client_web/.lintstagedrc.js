export default {
    '**/*.(ts|tsx)': () => 'npx tsc --noEmit',
    '*.{js,tsx,ts}': [
        'echo :::: prettier starts',
        'prettier -w',
        'echo :::: eslint starts',
        'eslint --fix',
    ],
};
