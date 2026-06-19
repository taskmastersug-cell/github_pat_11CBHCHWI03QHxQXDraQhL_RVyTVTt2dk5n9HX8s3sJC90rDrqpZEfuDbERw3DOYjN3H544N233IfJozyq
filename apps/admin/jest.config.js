module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@roundpay/shared$': '<rootDir>/../../packages/shared/dist/index.js',
  },
};
