/** @type {import('lint-staged').Configuration} */
const config = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{css,md,json}': ['prettier --write'],
};

export default config;
