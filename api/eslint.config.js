import security from 'eslint-plugin-security'

export default [
  security.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Detecta uso de eval, setTimeout con strings, regex inseguros, etc.
      'security/detect-object-injection':        'warn',
      'security/detect-non-literal-regexp':      'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-child-process':           'error',
      'security/detect-eval-with-expression':    'error',
    },
  },
]
