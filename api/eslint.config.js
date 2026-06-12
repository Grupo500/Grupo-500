const security = require('eslint-plugin-security')

module.exports = [
  security.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'security/detect-object-injection':        'warn',
      'security/detect-non-literal-regexp':      'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-child-process':           'error',
      'security/detect-eval-with-expression':    'error',
    },
  },
]
