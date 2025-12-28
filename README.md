# DocNearMe

A comprehensive healthcare appointment booking platform.

## Recent Changes

This branch includes improvements to the Netlify function handler and server configuration:

- Enhanced body handling with proper string-to-object conversion
- Improved Content-Type and Content-Length header management
- Better UTF-8 and multibyte character support
- Optimized request transformation for Netlify Functions

## Testing

Comprehensive test coverage has been added for all changes in this branch:

- **75 test cases** across 2 test suites
- **1,474 lines** of test code
- Full coverage of edge cases and error scenarios

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test -- --watch

# Generate coverage report
npm run test -- --coverage
```

### Test Files

- `netlify/functions/api.spec.ts` - Tests for Netlify function handler (39 tests)
- `server/index.spec.ts` - Tests for Express server setup (36 tests)

See [TEST_COVERAGE.md](./TEST_COVERAGE.md) for detailed test documentation.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Express, MongoDB
- **Deployment**: Netlify Functions
- **Testing**: Vitest

## Environment Variables

Required environment variables: