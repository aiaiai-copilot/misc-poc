module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'yarn test --run'
  ],
  '*.{json,md}': ['prettier --write']
};