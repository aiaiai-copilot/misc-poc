module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    (filenames) => {
      const hasWebFiles = filenames.some(f => f.includes('packages/presentation/web'));
      const hasDomainFiles = filenames.some(f => f.includes('packages/domain'));
      const hasApplicationFiles = filenames.some(f => f.includes('packages/application'));
      const hasInfrastructureFiles = filenames.some(f => f.includes('packages/infrastructure'));
      const hasSharedFiles = filenames.some(f => f.includes('packages/shared'));

      const commands = [];
      // Add timeout wrapper for test commands (3 minutes)
      if (hasWebFiles) commands.push('timeout 180 yarn workspace @misc-poc/presentation-web test');
      if (hasDomainFiles) commands.push('timeout 180 yarn workspace @misc-poc/domain test');
      if (hasApplicationFiles) commands.push('timeout 180 yarn workspace @misc-poc/application test');
      if (hasInfrastructureFiles) commands.push('timeout 180 yarn workspace @misc-poc/infrastructure-localstorage test');
      if (hasSharedFiles) commands.push('timeout 180 yarn workspace @misc-poc/shared test');

      return commands;
    }
  ],
  '*.{json,md}': ['prettier --write']
};