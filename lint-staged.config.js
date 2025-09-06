module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write', 
    () => 'yarn typecheck',
    () => 'yarn test:strict --coverage=false'
  ],
  '*.{json,md}': ['prettier --write']
};