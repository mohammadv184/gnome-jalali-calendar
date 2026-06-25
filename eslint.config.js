import globals from 'globals';

export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.es2021,
        log: 'readonly',
        logError: 'readonly',
        print: 'readonly',
        printerr: 'readonly',
        global: 'readonly',
        imports: 'readonly',
        ARGV: 'readonly',
        St: 'readonly',
        Clutter: 'readonly',
        Gio: 'readonly',
        GLib: 'readonly',
        GObject: 'readonly',
        Shell: 'readonly',
        Cogl: 'readonly',
        Pango: 'readonly',
        Meta: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { 'avoidEscape': true }]
    }
  }
];
