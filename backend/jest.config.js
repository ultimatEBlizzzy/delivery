/** Unit tests: pure business logic, no database required. */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.jest.json' }],
  },
  setupFiles: ['<rootDir>/../test/support/unit-env.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.module.ts',
    '!main.ts',
    '!database/migrations/**',
    '!database/cli/**',
  ],
  coverageDirectory: '../coverage',
};
