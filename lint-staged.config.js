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

      // Use fast tests only (exclude [perf] tagged integration tests)
      // Pattern excludes tests with [perf] in describe/it names
      const testPattern = '--testNamePattern="^(?:(?!perf).)*$"';

      if (hasSharedFiles) commands.push(`yarn workspace @misc-poc/shared test ${testPattern}`);
      if (hasDomainFiles) commands.push(`yarn workspace @misc-poc/domain test ${testPattern}`);
      if (hasApplicationFiles) commands.push(`yarn workspace @misc-poc/application test ${testPattern}`);
      if (hasInfrastructureFiles) {
        commands.push(`yarn workspace @misc-poc/infrastructure-cache test ${testPattern}`);
        commands.push(`yarn workspace @misc-poc/infrastructure-localstorage test ${testPattern}`);
        commands.push(`yarn workspace @misc-poc/infrastructure-postgresql test ${testPattern}`);
      }
      if (hasBackendFiles) commands.push(`yarn workspace @misc-poc/backend test ${testPattern}`);
      if (hasWebFiles) commands.push(`yarn workspace @misc-poc/presentation-web test ${testPattern}`);

      return commands;
    }
  ],
  '*.{json,md}': ['prettier --write']
};