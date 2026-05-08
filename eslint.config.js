// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/**
 * Architecture discipline enforced by the linter.
 *
 * Reference: 09-architecture-logicielle.md, section "Disciplines obligatoires".
 * Goals:
 *   - engine/* must remain a pure function: no side-effects, no I/O.
 *   - No Math.random() / new Date() — determinism via explicit seed + game clock.
 *   - UI/store/intents/data may import each other freely; engine stays isolated.
 */
export default [
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '*sqlite*',
              '@tauri-apps/*',
              '@/data/*',
              '@/data',
              '@/ui/*',
              '@/ui',
              '@/store/*',
              '@/store',
              '@/intents/*',
              '@/intents',
            ],
            message:
              'engine/* doit rester pur — aucune dépendance vers data/, ui/, store/, intents/, sqlite ou tauri. Voir 09-architecture-logicielle.md.',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        {
          name: 'Date',
          message: 'Utilise gameState.simulationClock — pas l\'horloge système (déterminisme requis).',
        },
      ],
      'no-restricted-syntax': ['error',
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Utilise rng.next() avec un seed explicite — Math.random() casse le déterminisme.',
        },
        {
          selector: 'NewExpression[callee.name="Date"]',
          message: 'Utilise gameState.simulationClock — pas new Date() (déterminisme requis).',
        },
      ],
    },
  },
  // Toutes les autres parties du code peuvent importer librement.
  {
    files: ['src/data/**/*.ts', 'src/ui/**/*.{ts,tsx}', 'src/store/**/*.ts', 'src/intents/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
  },
];
