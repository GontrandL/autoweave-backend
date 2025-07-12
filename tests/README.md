# AutoWeave Backend Tests

Comprehensive test suite for the AutoWeave Backend architecture.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── core/               # Core component tests
│   │   ├── service-manager.test.js
│   │   └── event-bus.test.js
│   ├── services/           # Service tests
│   │   ├── analytics-engine.test.js
│   │   ├── data-pipeline.test.js
│   │   └── integration-hub.test.js
│   └── connectors/         # Connector tests
│       └── autoweave-core-connector.test.js
├── integration/            # Integration tests
│   └── core-connection.test.js
├── setup.js               # Global test setup
├── run-tests.js          # Test runner script
└── README.md             # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Specific Test Suites
```bash
# Run only unit tests
node tests/run-tests.js unit

# Run only core tests
node tests/run-tests.js core

# Run only service tests
node tests/run-tests.js services

# Run integration tests
npm run test:integration
```

## Test Coverage

We aim for at least 80% code coverage across all components:

- **Core Components**: Service Manager, Event Bus
- **Services**: Analytics Engine, Data Pipeline, Integration Hub
- **Connectors**: AutoWeave Core Connector
- **Utilities**: Logging, validation, error handling

## Writing Tests

### Unit Test Example

```javascript
describe('ComponentName', () => {
  let component;
  let mockDependencies;

  beforeEach(() => {
    // Setup mocks and component
    mockDependencies = {
      logger: global.testUtils.createMockLogger()
    };
    component = new Component(mockDependencies);
  });

  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = { data: 'test' };
      
      // Act
      const result = await component.methodName(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
      expect(mockDependencies.logger.info).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Test error scenarios
      await expect(component.methodName(null))
        .rejects.toThrow('Expected error');
    });
  });
});
```

### Integration Test Example

```javascript
describe('Integration: Feature Name', () => {
  let serviceA;
  let serviceB;

  beforeEach(async () => {
    // Setup real services
    serviceA = await createServiceA();
    serviceB = await createServiceB();
  });

  afterEach(async () => {
    // Cleanup
    await serviceA.shutdown();
    await serviceB.shutdown();
  });

  it('should integrate services correctly', async () => {
    // Test real integration
    const result = await serviceA.callServiceB();
    expect(result).toBeDefined();
  });
});
```

## Test Utilities

The global `testUtils` object provides helper functions:

- `createMockLogger()`: Creates a mock logger with all methods
- `createMockEventBus()`: Creates a mock event bus
- `waitFor(condition, timeout)`: Waits for a condition to be true

## Mocking

### External Services

External services are mocked by default:
- Redis → ioredis-mock
- HTTP requests → node-fetch mock
- WebSocket → ws mock

### Environment

Tests use `.env.test` for configuration, isolating them from development/production.

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies
3. **Assertions**: Test both success and failure cases
4. **Async**: Always handle async operations properly
5. **Cleanup**: Clean up resources in afterEach

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

### CI Configuration

```yaml
test:
  script:
    - npm install
    - npm run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
```

## Debugging Tests

### Run Single Test File
```bash
npm test -- tests/unit/core/service-manager.test.js
```

### Run Tests in Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output
```bash
npm test -- --verbose
```

## Test Data

Test fixtures and mock data are located in:
- `tests/fixtures/`: Static test data
- `tests/mocks/`: Mock implementations

## Performance Testing

For performance-critical components:

```javascript
it('should handle high load', async () => {
  const iterations = 1000;
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    await component.process({ id: i });
  }
  
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000); // Less than 1 second
});
```

## Common Issues

### Module Resolution
If you encounter module resolution errors, ensure:
- `type: "module"` is set in package.json
- Jest config handles ES modules correctly
- Babel is configured for the current Node version

### Async Timeouts
For long-running tests:
```javascript
it('should complete eventually', async () => {
  // Increase timeout for this test
  jest.setTimeout(30000);
  
  const result = await longRunningOperation();
  expect(result).toBeDefined();
});
```

### Memory Leaks
Use Jest's leak detection:
```bash
npm test -- --detectLeaks
```

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this documentation