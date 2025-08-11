#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * Provides a convenient interface for running different types of tests
 * with proper environment setup and reporting.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testTypes = {
      unit: "jest --testPathPattern='src/.*\\.test\\.(ts|tsx)$'",
      integration: "jest --testPathPattern='src/.*\\.integration\\.test\\.(ts|tsx)$'",
      component: "jest --testPathPattern='src/components/.*\\.test\\.(ts|tsx)$'",
      hooks: "jest --testPathPattern='src/hooks/.*\\.test\\.(ts|tsx)$'",
      stores: "jest --testPathPattern='src/stores/.*\\.test\\.(ts|tsx)$'",
      performance: "jest --testPathPattern='src/.*\\.perf\\.test\\.(ts|tsx)$'",
      all: 'jest'
    };
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;
      
      case 'setup':
        await this.setupTestEnvironment();
        break;
      
      case 'clean':
        await this.cleanTestArtifacts();
        break;
      
      case 'watch':
        await this.runTestsInWatchMode(args[1] || 'all');
        break;
      
      case 'coverage':
        await this.runCoverageTests();
        break;
      
      default:
        if (this.testTypes[command]) {
          await this.runTests(command, args.slice(1));
        } else {
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
        }
    }
  }

  showHelp() {
    console.log(`
🧪 Test Runner - Conversation Testing Platform

Usage: node scripts/test-runner.js <command> [options]

Commands:
  help                 Show this help message
  setup               Setup test environment
  clean               Clean test artifacts and cache
  watch [type]        Run tests in watch mode
  coverage            Run tests with coverage report
  
Test Types:
  unit                Run unit tests only
  integration         Run integration tests only
  component           Run component tests only
  hooks               Run hook tests only
  stores              Run store tests only
  performance         Run performance tests only
  all                 Run all tests (default)

Examples:
  node scripts/test-runner.js unit
  node scripts/test-runner.js watch integration
  node scripts/test-runner.js coverage
  node scripts/test-runner.js setup

Options:
  --verbose           Enable verbose output
  --silent            Suppress non-essential output
  --updateSnapshot    Update test snapshots
  --maxWorkers=4      Set maximum number of worker processes
    `);
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Ensure test directories exist
      const testDirs = [
        'src/__tests__/setup',
        'src/__tests__/utils',
        'src/__tests__/integration',
        'coverage',
        'test-results'
      ];

      testDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✅ Created directory: ${dir}`);
        }
      });

      // Check for required test dependencies
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = [
        '@testing-library/jest-dom',
        '@testing-library/react',
        '@testing-library/user-event',
        'jest',
        'fake-indexeddb'
      ];

      const missingDeps = requiredDeps.filter(dep => 
        !packageJson.devDependencies[dep] && !packageJson.dependencies[dep]
      );

      if (missingDeps.length > 0) {
        console.log('⚠️  Missing test dependencies:', missingDeps.join(', '));
        console.log('Run: npm install --save-dev', missingDeps.join(' '));
      }

      console.log('✅ Test environment setup complete');
      
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error.message);
      process.exit(1);
    }
  }

  async cleanTestArtifacts() {
    console.log('🧹 Cleaning test artifacts...');
    
    const pathsToClean = [
      'coverage',
      'test-results',
      'node_modules/.cache/jest',
      '.jest-cache'
    ];

    pathsToClean.forEach(pathToClean => {
      if (fs.existsSync(pathToClean)) {
        fs.rmSync(pathToClean, { recursive: true, force: true });
        console.log(`✅ Cleaned: ${pathToClean}`);
      }
    });

    console.log('✅ Test artifacts cleaned');
  }

  async runTests(testType, additionalArgs = []) {
    console.log(`🧪 Running ${testType} tests...`);
    
    const command = this.testTypes[testType];
    const args = command.split(' ').slice(1); // Remove 'jest' from the command
    
    // Add additional arguments
    args.push(...additionalArgs);

    // Add common Jest options
    if (process.env.CI) {
      args.push('--ci', '--watchAll=false', '--coverage');
    }

    if (additionalArgs.includes('--verbose') || process.env.VERBOSE) {
      args.push('--verbose');
    }

    return this.executeJest(args);
  }

  async runTestsInWatchMode(testType) {
    console.log(`👀 Running ${testType} tests in watch mode...`);
    
    const command = this.testTypes[testType] || this.testTypes.all;
    const args = command.split(' ').slice(1);
    args.push('--watch');

    return this.executeJest(args);
  }

  async runCoverageTests() {
    console.log('📊 Running tests with coverage...');
    
    const args = ['--coverage', '--watchAll=false'];
    
    if (process.env.CI) {
      args.push('--ci');
    }

    const result = await this.executeJest(args);
    
    if (result === 0) {
      console.log('📈 Generating coverage report...');
      await this.executeCommand('node', ['scripts/coverage-report.js']);
    }

    return result;
  }

  async executeJest(args) {
    return this.executeCommand('npx', ['jest', ...args]);
  }

  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// Script execution
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = TestRunner;