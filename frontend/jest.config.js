const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^rehype-raw$': '<rootDir>/__mocks__/rehypeRaw.js',
    '^rehype-sanitize$': '<rootDir>/__mocks__/rehypeSanitize.js',
    '^remark-gfm$': '<rootDir>/__mocks__/rehypeRaw.js',
    '^react-markdown$': '<rootDir>/__mocks__/reactMarkdown.js',
    '^react-is$': require.resolve('react-is'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(rehype-raw|rehype-sanitize|hast-util-sanitize|hast-util-parse-selector|property-information|unist-util-position|unist-util-visit|unist-util-is)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.test.ts',
    '**/*.test.tsx',
    '**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/__tests__/e2e/',
    'app/admin/__tests__/',
    // These directories hold node:test files, run by `npm run test:node`.
    'lib/__tests__/',
    'components/chat/__tests__/',
    'components/property-detail/__tests__/',
    'components/__tests__/data-integrity.test.ts',
    'components/__tests__/DiscoveryCompare.test.ts',
  ],

})
