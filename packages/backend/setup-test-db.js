#!/usr/bin/env node

/**
 * Simple test database setup for trying CLI commands
 * This creates a temporary PostgreSQL container just for testing the CLI
 */

import { spawn } from 'child_process';

console.log('🐳 Setting up temporary test database...');

// Run a simple PostgreSQL container
const docker = spawn('docker', [
  'run', '--rm', '-d',
  '--name', 'misc-poc-test-db',
  '-e', 'POSTGRES_DB=misc_poc_dev',
  '-e', 'POSTGRES_USER=postgres',
  '-e', 'POSTGRES_PASSWORD=postgres',
  '-p', '5432:5432',
  'postgres:15'
]);

docker.stdout.on('data', (data) => {
  console.log(`Docker: ${data}`);
});

docker.stderr.on('data', (data) => {
  console.error(`Docker Error: ${data}`);
});

docker.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Test database is starting up...');
    console.log('Wait 10 seconds for database to be ready, then try:');
    console.log('yarn workspace @misc-poc/backend db:run');
  } else {
    console.log(`❌ Failed to start database (exit code ${code})`);
  }
});