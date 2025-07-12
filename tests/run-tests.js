#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function runTests() {
  console.log(`${colors.blue}=== AutoWeave Backend Test Suite ===${colors.reset}\n`);

  // Run Jest with coverage
  const jest = spawn('npm', ['run', 'test:coverage', '--', '--verbose'], {
    stdio: 'inherit',
    shell: true
  });

  jest.on('close', async (code) => {
    if (code === 0) {
      console.log(`\n${colors.green}✅ All tests passed!${colors.reset}`);
      
      // Display coverage summary
      try {
        const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
        const coverageData = JSON.parse(await readFile(coveragePath, 'utf8'));
        
        console.log(`\n${colors.blue}📊 Coverage Summary:${colors.reset}`);
        console.log('─'.repeat(50));
        
        for (const [metric, data] of Object.entries(coverageData.total)) {
          if (metric !== 'linesCovered') {
            const percentage = data.pct;
            const color = percentage >= 80 ? colors.green : 
                         percentage >= 60 ? colors.yellow : colors.red;
            console.log(`${metric.padEnd(15)} ${color}${percentage.toFixed(1)}%${colors.reset}`);
          }
        }
        console.log('─'.repeat(50));
      } catch (error) {
        console.log(`${colors.yellow}Coverage report not available${colors.reset}`);
      }
    } else {
      console.log(`\n${colors.red}❌ Tests failed with code ${code}${colors.reset}`);
      process.exit(code);
    }
  });

  jest.on('error', (error) => {
    console.error(`${colors.red}Failed to run tests:${colors.reset}`, error);
    process.exit(1);
  });
}

// Run specific test suites
async function runTestSuite(suite) {
  const suites = {
    unit: 'tests/unit/**/*.test.js',
    integration: 'tests/integration/**/*.test.js',
    core: 'tests/unit/core/**/*.test.js',
    services: 'tests/unit/services/**/*.test.js',
    connectors: 'tests/unit/connectors/**/*.test.js'
  };

  if (!suites[suite]) {
    console.error(`${colors.red}Unknown test suite: ${suite}${colors.reset}`);
    console.log(`Available suites: ${Object.keys(suites).join(', ')}`);
    process.exit(1);
  }

  console.log(`${colors.blue}Running ${suite} tests...${colors.reset}\n`);

  const jest = spawn('npm', ['test', '--', suites[suite]], {
    stdio: 'inherit',
    shell: true
  });

  jest.on('close', (code) => {
    process.exit(code);
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== 'all') {
  runTestSuite(args[0]);
} else {
  runTests();
}