export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    (filenames) => {
      const hasWebFiles = filenames.some(f => f.includes('packages/presentation/web'));
      const hasDomainFiles = filenames.some(f => f.includes('packages/domain'));
      const hasApplicationFiles = filenames.some(f => f.includes('packages/application'));
      const hasBackendFiles = filenames.some(f => f.includes('packages/backend'));
      const hasInfrastructureFiles = filenames.some(f => f.includes('packages/infrastructure'));
      const hasSharedFiles = filenames.some(f => f.includes('packages/shared'));

      const commands = [];

      // Type checking for affected packages (in dependency order)
      if (hasSharedFiles) commands.push('yarn workspace @misc-poc/shared typecheck');
      if (hasDomainFiles) commands.push('yarn workspace @misc-poc/domain typecheck');
      if (hasApplicationFiles) commands.push('yarn workspace @misc-poc/application typecheck');
      if (hasInfrastructureFiles) {
        commands.push('yarn workspace @misc-poc/infrastructure-cache typecheck');
        commands.push('yarn workspace @misc-poc/infrastructure-localstorage typecheck');
        commands.push('yarn workspace @misc-poc/infrastructure-postgresql typecheck');
      }
      if (hasBackendFiles) commands.push('yarn workspace @misc-poc/backend typecheck');
      if (hasWebFiles) commands.push('yarn workspace @misc-poc/presentation-web typecheck');

      // Add timeout wrapper for test commands (5 minutes for packages with integration tests)
      if (hasSharedFiles) commands.push('timeout 180 yarn workspace @misc-poc/shared test');
      if (hasDomainFiles) commands.push('timeout 180 yarn workspace @misc-poc/domain test');
      if (hasApplicationFiles) commands.push('timeout 180 yarn workspace @misc-poc/application test');
      if (hasInfrastructureFiles) {
        commands.push('timeout 180 yarn workspace @misc-poc/infrastructure-localstorage test');
        // PostgreSQL package has extensive integration tests that need more time
        commands.push('timeout 300 yarn workspace @misc-poc/infrastructure-postgresql test');
      }
      if (hasBackendFiles) commands.push('timeout 180 yarn workspace @misc-poc/backend test');
      if (hasWebFiles) commands.push('timeout 180 yarn workspace @misc-poc/presentation-web test');

      return commands;
    }
  ],
  '*.{json,md}': ['prettier --write']
};