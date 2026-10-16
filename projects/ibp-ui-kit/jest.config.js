module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  roots: ['<rootDir>/src'],
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(.*\.mjs)|@sber-ibp/core)'],
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lodash-es$': 'lodash',
    '^uuid$': 'uuid',
    '.+\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/jest.mocks.js',
  },
  transform: {
    '\\.[jt]sx?$': ['ts-jest', { tsconfig: './tsconfig.jest.json' }],
  },
  verbose: true,
};
