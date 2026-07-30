/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // 允许 console（Electron 主进程日志常用）
    'no-console': 'off',
    // 允许未使用 vars 以 warn 级别提醒（不阻断构建）
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // 关闭 require-await（与项目异步风格冲突）
    '@typescript-eslint/require-await': 'off',
    // 允许显式 any（项目中有大量与第三方 API 交互的代码）
    '@typescript-eslint/no-explicit-any': 'off',
    // 关闭 React display-name（函数组件不需要）
    'react/display-name': 'off',
    // 关闭 React prop-types（TS 已处理类型检查）
    'react/prop-types': 'off',
  },
  ignorePatterns: [
    'out/',
    'dist/',
    'release/',
    'node_modules/',
    '*.config.js',
    '*.config.ts',
  ],
}
