#!/usr/bin/env node

/**
 * Pre-commit validation script to prevent mock-based "integration" tests
 *
 * This script checks for common anti-patterns:
 * 1. Files named *integration.test.ts without @testcontainers imports
 * 2. Testing database operations with mocks instead of real dependencies
 * 3. Missing proper test categorization
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const packagesDir = join(projectRoot, 'packages');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`)
};

/**
 * Find all test files recursively
 */
function findTestFiles(dir, files = []) {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTestFiles(fullPath, files);
    } else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if file contains integration test anti-patterns
 */
function validateTestFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop();
  const issues = [];

  // Check 1: Integration test files must use Testcontainers
  if (fileName.includes('integration') || fileName.includes('contract')) {
    if (!content.includes('@testcontainers') && !content.includes('testcontainers')) {
      issues.push({
        type: 'CRITICAL',
        message: `Integration test "${fileName}" must use Testcontainers, not mocks`
      });
    }
  }

  // Check 2: Database operation testing with mocks
  const hasDatabaseOperations = /\b(QueryRunner|DataSource|createTable|dropTable|migration\.up|migration\.down)\b/.test(content);
  const hasMocks = /jest\.fn\(\)|mockQueryRunner|mockDataSource/.test(content);

  if (hasDatabaseOperations && hasMocks && !content.includes('@testcontainers')) {
    issues.push({
      type: 'CRITICAL',
      message: `File "${fileName}" tests database operations with mocks instead of real database`
    });
  }

  // Check 3: Files with "integration" in describe blocks but using mocks
  const hasIntegrationDescribe = /describe\([^)]*integration[^)]*\)/i.test(content);
  if (hasIntegrationDescribe && hasMocks && !content.includes('@testcontainers')) {
    issues.push({
      type: 'WARNING',
      message: `File "${fileName}" has "integration" in test description but uses mocks`
    });
  }

  // Check 4: Migration testing anti-patterns
  const hasMigrationTesting = /migration\.(up|down)\s*\(/i.test(content);
  const hasMockQueryRunner = /mockQueryRunner|jest\.fn\(\).*QueryRunner/i.test(content);

  if (hasMigrationTesting && hasMockQueryRunner) {
    issues.push({
      type: 'CRITICAL',
      message: `File "${fileName}" tests migrations with mock QueryRunner instead of real database`
    });
  }

  return issues;
}

/**
 * Generate validation report
 */
function generateReport(results) {
  const totalFiles = results.length;
  const filesWithIssues = results.filter(r => r.issues.length > 0);
  const criticalIssues = results.flatMap(r => r.issues.filter(i => i.type === 'CRITICAL'));
  const warnings = results.flatMap(r => r.issues.filter(i => i.type === 'WARNING'));

  console.log(`\n${colors.bold}📊 Test Validation Report${colors.reset}`);
  console.log(`${colors.blue}Total test files: ${totalFiles}${colors.reset}`);
  console.log(`${colors.yellow}Files with issues: ${filesWithIssues.length}${colors.reset}`);
  console.log(`${colors.red}Critical issues: ${criticalIssues.length}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${warnings.length}${colors.reset}\n`);

  if (filesWithIssues.length === 0) {
    log.success('All test files follow proper testing patterns! 🎉');
    return true;
  }

  // Report issues by file
  for (const result of filesWithIssues) {
    console.log(`${colors.bold}📁 ${result.file}${colors.reset}`);
    for (const issue of result.issues) {
      const icon = issue.type === 'CRITICAL' ? '🚨' : '⚠️';
      const color = issue.type === 'CRITICAL' ? colors.red : colors.yellow;
      console.log(`  ${icon} ${color}${issue.message}${colors.reset}`);
    }
    console.log();
  }

  // Recommendations
  if (criticalIssues.length > 0) {
    console.log(`${colors.bold}🔧 Recommended Actions:${colors.reset}`);
    console.log('1. Replace mock-based integration tests with Testcontainers');
    console.log('2. Use real PostgreSQL containers for database testing');
    console.log('3. Keep unit tests with mocks for isolated logic testing');
    console.log('4. Follow the testing guidelines in CLAUDE.md\n');
  }

  return criticalIssues.length === 0;
}

/**
 * Main validation function
 */
function main() {
  console.log(`${colors.bold}🧪 Validating test file patterns...${colors.reset}\n`);

  const testFiles = findTestFiles(packagesDir);
  const results = [];

  for (const file of testFiles) {
    const issues = validateTestFile(file);
    results.push({
      file: file.replace(projectRoot + '/', ''),
      issues
    });
  }

  const isValid = generateReport(results);

  // For now, don't fail on existing issues - just warn about them
  // TODO: Enable strict mode once existing issues are resolved
  const strictMode = process.env.STRICT_TEST_VALIDATION === 'true';

  if (!isValid && strictMode) {
    log.error('Test validation failed! Please fix critical issues before committing.');
    process.exit(1);
  } else if (!isValid) {
    log.warning('Test validation found issues. Future sessions should follow the guidelines in CLAUDE.md');
    log.info('Run with STRICT_TEST_VALIDATION=true to enforce validation');
  } else {
    log.success('Test validation passed!');
  }
}

// Run validation
main();