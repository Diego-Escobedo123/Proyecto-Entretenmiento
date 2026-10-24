import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Reglas recomendadas de JS, TypeScript y Vue. Los tipos los revisa vue-tsc
// en el build; acá sólo errores de código y de plantillas (sin reglas de formato).
export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      // TypeScript ya avisa de lo no definido, y no-undef no ve los tipos
      // globales de src/types/*.d.ts (p. ej. GoogleCredentialResponse).
      'no-undef': 'off',
    },
  },
  {
    // Las pantallas se llaman como su ruta (home.vue, login.vue...).
    files: ['src/Screens/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
)
