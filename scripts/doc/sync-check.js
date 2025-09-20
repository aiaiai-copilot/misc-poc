#!/usr/bin/env node

/**
 * Documentation Consistency Check Script
 * 
 * @description Verifies that human-readable documentation aligns with PRD specifications
 * @requirements Ensures no contradictions between PRD and derived documentation
 * @usage node scripts/docs/sync-check.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// Documentation paths
const DOCS_BASE = path.join(__dirname, '../../docs');
const TASKMASTER_BASE = path.join(__dirname, '../../.taskmaster');

const files = {
  prd: path.join(TASKMASTER_BASE, 'docs/prd.txt'),
  overview: path.join(DOCS_BASE, 'development/overview.md'),
  database: path.join(DOCS_BASE, 'architecture/backend/database.md'),
  authentication: path.join(DOCS_BASE, 'architecture/backend/authentication.md'),
  testingStrategy: path.join(DOCS_BASE, 'development/testing-strategy.md'),
  openapi: path.join(DOCS_BASE, 'api/openapi.yaml'),
  gettingStarted: path.join(DOCS_BASE, 'development/getting-started.md'),
  architecture: path.join(DOCS_BASE, 'architecture/README.md'),
  dockerSetup: path.join(DOCS_BASE, 'deployment/docker-setup.md')
};

// Key metrics to validate across documents
const metricsToCheck = {
  performance: {
    authentication: { value: '2s', pattern: /Authentication[:\s]+<\s*(\d+)s/ },
    recordCreation: { value: '100ms', pattern: /Record Creation[:\s]+<\s*(\d+)ms/ },
    search10k: { value: '200ms', pattern: /Search.*10[kK].*[:\s]+<\s*(\d+)ms/ },
    export10k: { value: '5s', pattern: /Export.*10[kK].*[:\s]+<\s*(\d+)s/ }
  },
  coverage: {
    domain: { value: '95%', pattern: /Domain.*[>:]\s*(\d+)%/ },
    application: { value: '90%', pattern: /Application|Use Cases.*[>:]\s*(\d+)%/ },
    apiRoutes: { value: '85%', pattern: /API Routes.*[>:]\s*(\d+)%/ }
  },
  jwt: {
    accessToken: { value: '15 minutes', pattern: /Access Token[:\s]+(\d+\s*minutes?)/ },
    refreshToken: { value: '7 days', pattern: /Refresh Token[:\s]+(\d+\s*days?)/ }
  },
  scaling: {
    concurrentUsers: { value: '100', pattern: /Concurrent Users[:\s]+(\d+)/ },
    requestsPerSecond: { value: '50', pattern: /Requests per Second[:\s]+(\d+)/ }
  }
};

class ConsistencyChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
    this.fileContents = {};
  }

  /**
   * Load all documentation files
   */
  async loadFiles() {
    console.log(`${colors.blue}Loading documentation files...${colors.reset}`);
    
    for (const [key, filepath] of Object.entries(files)) {
      if (!fs.existsSync(filepath)) {
        this.warnings.push(`File not found: ${filepath}`);
        continue;
      }
      
      try {
        this.fileContents[key] = fs.readFileSync(filepath, 'utf8');
        console.log(`${colors.gray}  ✓ Loaded ${key}${colors.reset}`);
      } catch (error) {
        this.issues.push(`Failed to read ${key}: ${error.message}`);
      }
    }
  }

  /**
   * Extract metric value from text using regex pattern
   */
  extractMetric(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Check if a specific metric is consistent across documents
   */
  checkMetric(category, metricName, expectedValue, pattern) {
    const results = {};
    
    // Check PRD first (source of truth)
    if (this.fileContents.prd) {
      const prdValue = this.extractMetric(this.fileContents.prd, pattern);
      if (prdValue && prdValue !== expectedValue) {
        // PRD has different value, update expected
        expectedValue = prdValue;
      }
    }
    
    // Check each document
    for (const [docName, content] of Object.entries(this.fileContents)) {
      if (!content) continue;
      
      const value = this.extractMetric(content, pattern);
      if (value) {
        results[docName] = value;
        
        if (value !== expectedValue) {
          this.issues.push(
            `${category}.${metricName}: Inconsistent value in ${docName} ` +
            `(found: ${value}, expected: ${expectedValue})`
          );
        }
      }
    }
    
    if (Object.keys(results).length > 1) {
      const allSame = Object.values(results).every(v => v === expectedValue);
      if (allSame) {
        this.passed.push(`${category}.${metricName}: Consistent across all documents (${expectedValue})`);
      }
    }
  }

  /**
   * Check database schema consistency
   */
  checkDatabaseSchema() {
    console.log(`\n${colors.blue}Checking database schema...${colors.reset}`);
    
    const schemaElements = [
      { name: 'users table', pattern: /CREATE TABLE users[\s\S]*?(?=CREATE|$)/i },
      { name: 'records table', pattern: /CREATE TABLE records[\s\S]*?(?=CREATE|$)/i },
      { name: 'GIN index', pattern: /CREATE GIN INDEX.*normalized_tags/i },
      { name: 'CASCADE DELETE', pattern: /ON DELETE CASCADE/i }
    ];
    
    for (const element of schemaElements) {
      const inPrd = element.pattern.test(this.fileContents.prd || '');
      const inDatabase = element.pattern.test(this.fileContents.database || '');
      
      if (inPrd && inDatabase) {
        this.passed.push(`Database: ${element.name} present in both PRD and database.md`);
      } else if (inPrd && !inDatabase) {
        this.issues.push(`Database: ${element.name} in PRD but missing in database.md`);
      } else if (!inPrd && inDatabase) {
        this.warnings.push(`Database: ${element.name} in database.md but not in PRD (extension)`);
      }
    }
  }

  /**
   * Check API endpoints consistency
   */
  checkApiEndpoints() {
    console.log(`\n${colors.blue}Checking API endpoints...${colors.reset}`);
    
    const requiredEndpoints = [
      'POST /auth/google',
      'GET /api/records',
      'POST /api/records',
      'PUT /api/records/{id}',
      'DELETE /api/records/{id}',
      'GET /api/tags',
      'GET /api/export',
      'POST /api/import'
    ];
    
    const openApiContent = this.fileContents.openapi || '';
    
    for (const endpoint of requiredEndpoints) {
      const [method, path] = endpoint.split(' ');
      const pathPattern = path.replace(/{.*?}/g, '\\{[^}]+\\}');
      const pattern = new RegExp(`${path.replace(/{.*?}/g, '.*?')}:`, 'i');
      
      if (pattern.test(openApiContent)) {
        this.passed.push(`API: ${endpoint} defined in OpenAPI spec`);
      } else {
        this.issues.push(`API: ${endpoint} missing from OpenAPI spec`);
      }
    }
  }

  /**
   * Check development phases consistency
   */
  checkDevelopmentPhases() {
    console.log(`\n${colors.blue}Checking development phases...${colors.reset}`);
    
    const phases = [
      { name: 'Backend Foundation', weeks: 'Week 1-2' },
      { name: 'Authentication', weeks: 'Week 3' },
      { name: 'Core API', weeks: 'Week 4-5' },
      { name: 'Frontend Integration', weeks: 'Week 6-7' },
      { name: 'Import/Export', weeks: 'Week 8' },
      { name: 'Deployment', weeks: 'Week 9-10' }
    ];
    
    for (const phase of phases) {
      const prdHasPhase = this.fileContents.prd?.includes(phase.name) && 
                         this.fileContents.prd?.includes(phase.weeks);
      const overviewHasPhase = this.fileContents.overview?.includes(phase.name) && 
                              this.fileContents.overview?.includes(phase.weeks);
      
      if (prdHasPhase && overviewHasPhase) {
        this.passed.push(`Phase: ${phase.name} (${phase.weeks}) consistent`);
      } else if (prdHasPhase && !overviewHasPhase) {
        this.issues.push(`Phase: ${phase.name} missing or incorrect in overview`);
      }
    }
  }

  /**
   * Check for forbidden content
   */
  checkForbiddenContent() {
    console.log(`\n${colors.blue}Checking for forbidden content...${colors.reset}`);
    
    const forbiddenPatterns = [
      { pattern: /localhost:\d{4}.*production/i, message: 'localhost URLs in production config' },
      { pattern: /CHANGE_THIS|your-.*-here|xxx+/i, message: 'placeholder values' },
      { pattern: /console\.log\(/i, message: 'console.log in documentation' },
      { pattern: /TODO|FIXME|XXX/i, message: 'TODO/FIXME markers' }
    ];
    
    for (const [docName, content] of Object.entries(this.fileContents)) {
      if (!content || docName === 'prd') continue;
      
      for (const forbidden of forbiddenPatterns) {
        if (forbidden.pattern.test(content)) {
          this.warnings.push(`${docName}: Contains ${forbidden.message}`);
        }
      }
    }
  }

  /**
   * Run all consistency checks
   */
  async runChecks() {
    await this.loadFiles();
    
    // Check metrics
    console.log(`\n${colors.blue}Checking metrics consistency...${colors.reset}`);
    for (const [category, metrics] of Object.entries(metricsToCheck)) {
      for (const [name, config] of Object.entries(metrics)) {
        this.checkMetric(category, name, config.value, config.pattern);
      }
    }
    
    // Check other aspects
    this.checkDatabaseSchema();
    this.checkApiEndpoints();
    this.checkDevelopmentPhases();
    this.checkForbiddenContent();
  }

  /**
   * Generate summary report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.blue}DOCUMENTATION CONSISTENCY CHECK RESULTS${colors.reset}`);
    console.log('='.repeat(60));
    
    // Passed checks
    if (this.passed.length > 0) {
      console.log(`\n${colors.green}✅ PASSED (${this.passed.length})${colors.reset}`);
      this.passed.forEach(item => {
        console.log(`${colors.gray}  ✓ ${item}${colors.reset}`);
      });
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  WARNINGS (${this.warnings.length})${colors.reset}`);
      this.warnings.forEach(warning => {
        console.log(`  ${colors.yellow}⚠ ${warning}${colors.reset}`);
      });
    }
    
    // Issues
    if (this.issues.length > 0) {
      console.log(`\n${colors.red}❌ ISSUES (${this.issues.length})${colors.reset}`);
      this.issues.forEach(issue => {
        console.log(`  ${colors.red}✗ ${issue}${colors.reset}`);
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    const total = this.passed.length + this.warnings.length + this.issues.length;
    const score = ((this.passed.length / total) * 100).toFixed(1);
    
    if (this.issues.length === 0) {
      console.log(`${colors.green}✅ Documentation is consistent with PRD (${score}% passed)${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`${colors.red}❌ Documentation has ${this.issues.length} inconsistencies (${score}% passed)${colors.reset}`);
      console.log(`${colors.gray}   Run 'npm run docs:fix' to see suggested fixes${colors.reset}`);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const checker = new ConsistencyChecker();
  
  try {
    await checker.runChecks();
    checker.generateReport();
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ConsistencyChecker;