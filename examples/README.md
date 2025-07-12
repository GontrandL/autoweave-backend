# AutoWeave Backend Examples

This directory contains practical examples and tutorials for using AutoWeave Backend.

## Examples Overview

### Quick Start Examples
- [Basic Setup](./01-quick-start/) - Get started in 5 minutes
- [Authentication](./02-authentication/) - JWT and API key usage
- [Service Management](./03-service-management/) - Register and manage services

### Integration Examples
- [REST API Integration](./04-rest-api-integration/) - Connect external REST APIs
- [Database Integration](./05-database-integration/) - Work with multiple databases
- [Event-Driven Architecture](./06-event-driven/) - Pub/sub patterns

### Advanced Examples
- [Data Pipeline](./07-data-pipeline/) - Build processing pipelines
- [Analytics Integration](./08-analytics/) - Track and analyze events
- [Monitoring Setup](./09-monitoring/) - Complete monitoring stack

### Real-World Use Cases
- [E-commerce Backend](./10-ecommerce-backend/) - Complete e-commerce solution
- [IoT Data Processing](./11-iot-processing/) - Handle IoT device data
- [Social Media Analytics](./12-social-analytics/) - Social media data pipeline

## Getting Started

Each example directory contains:
- `README.md` - Detailed instructions
- `example.js` - Runnable code
- `package.json` - Dependencies (if needed)
- `test.js` - Test cases
- `docker-compose.yml` - Infrastructure (if needed)

## Prerequisites

- Node.js 18.0.0+
- Docker and Docker Compose
- AutoWeave Backend running

## Running Examples

1. Navigate to an example directory:
   ```bash
   cd examples/01-quick-start
   ```

2. Follow the README instructions in that directory

3. Most examples can be run with:
   ```bash
   npm install
   npm start
   ```

## Example Template

Use this template for creating new examples:

```
examples/
├── XX-example-name/
│   ├── README.md
│   ├── example.js
│   ├── package.json
│   ├── test.js
│   └── docker-compose.yml (optional)
```

## Contributing

To add a new example:

1. Create a new directory with a descriptive name
2. Follow the template structure above
3. Include comprehensive documentation
4. Add working code with error handling
5. Include tests
6. Update this README

## Support

For help with examples:
- Check the individual README files
- Review the main documentation
- Open an issue on GitHub