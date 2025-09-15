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
      if (hasWebFiles) commands.push('yarn workspace @misc-poc/presentation-web test --run');
      if (hasDomainFiles) commands.push('yarn workspace @misc-poc/domain test --run');
      if (hasApplicationFiles) commands.push('yarn workspace @misc-poc/application test --run');
      if (hasInfrastructureFiles) commands.push('yarn workspace @misc-poc/infrastructure test --run');
      if (hasSharedFiles) commands.push('yarn workspace @misc-poc/shared test --run');

      return commands;
    }
  ],
  '*.{json,md}': ['prettier --write']
};