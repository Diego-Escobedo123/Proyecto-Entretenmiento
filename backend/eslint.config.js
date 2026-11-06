import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Reglas recomendadas de JS y TypeScript. Los tipos los revisa `bun run typecheck`.
export default defineConfig(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // En las pruebas se simulan respuestas de la base y de la API: ahí `any` es aceptable.
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
