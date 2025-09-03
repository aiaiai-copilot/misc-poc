module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write', 
    () => 'yarn typecheck',
    () => 'yarn test --passWithNoTests --coverage=false'
  ],
  '*.{json,md}': ['prettier --write']
};