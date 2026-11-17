import nextPlugin from '@next/eslint-plugin-next';
import { react } from '@musicverse/shared-config/eslint';

export default [
  ...react,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  { ignores: ['.next/**', 'playwright-report/**', 'test-results/**'] },
];
