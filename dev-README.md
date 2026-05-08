# Rugby Manager — README développeur

> Pour la documentation de **design**, voir [`README.md`](./README.md).

## Setup initial

### 1. Scaffold Tauri (côté Rust)

Ce dossier contient déjà le code TypeScript/React et la config. Il manque l'enveloppe Tauri (Rust). Tu as deux options :

**Option A : ajouter Tauri à ce dossier**

```bash
npm install
npm install -D @tauri-apps/cli@latest
npx tauri init
# Réponses suggérées :
#   App name: Rugby Manager
#   Window title: Rugby Manager
#   Web assets: ../dist
#   Dev server URL: http://localhost:5173
#   Frontend dev cmd: npm run dev
#   Frontend build cmd: npm run build
```

Cela crée `src-tauri/` avec le code Rust.

**Option B : créer un nouveau projet Tauri propre puis migrer**

```bash
cd ..
npm create tauri-app@latest rugby-manager-app -- --template react-ts
# Puis copie src/, tests/, eslint.config.js, vitest.config.ts depuis ce dossier vers le nouveau
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Vérifier que tout passe

```bash
npm run lint
npm run typecheck
npm run test
```

À ce stade tu devrais avoir un test bidon qui passe et un projet prêt à coder dedans.

## Structure du code

```
src/
├── engine/          ← MOTEUR PUR (zéro dépendance externe)
│   ├── types.ts
│   ├── events.ts
│   ├── rng.ts
│   ├── reducer.ts
│   └── match/
│       ├── types.ts
│       ├── scrum.ts
│       ├── lineout.ts (à créer)
│       ├── ruck.ts (à créer)
│       ├── openplay.ts (à créer)
│       ├── kicking.ts (à créer)
│       └── simulate.ts
│
├── data/            ← persistance (interface + impl)
│   └── repository.ts
│
├── intents/         ← traduction intent → events (à créer)
├── store/           ← state management Zustand (à créer)
└── ui/              ← React (à créer)
    ├── screens/
    ├── components/
    └── hooks/

tests/
└── engine/
    └── scrum.test.ts
```

## Disciplines architecturales (à NE PAS contourner)

> Voir `09-architecture-logicielle.md` pour le détail.

1. **`engine/` est pur** — aucune dépendance vers `data/`, `ui/`, `store/`, `intents/`, sqlite, ou tauri. Le linter le vérifie.
2. **Pas de `Math.random()`** — utiliser `rng.next()` avec seed explicite.
3. **Pas de `new Date()`** — utiliser `gameState.simulationClock`.
4. **Toute persistance passe par `GameRepository`** — pas d'appel SQLite direct.
5. **L'état du jeu dérive d'événements** — éviter les mutations en place.

Si tu sens le besoin de contourner une de ces règles, c'est probablement que tu mélanges des couches. Lis la section 9 et reviens.

## Commandes utiles

```bash
npm run dev              # Lancer l'app en dev
npm run test             # Tests unit + simulation 1000 matchs
npm run test:watch       # Mode watch
npm run test:simulate    # 10 000 matchs (lourd)
npm run test:coverage    # Avec couverture
npm run lint             # Linter (incl. règles archi)
npm run typecheck        # tsc --noEmit
npm run tauri dev        # Lancer l'app desktop (après init Tauri)
```

## Roadmap actuelle

Voir `13-gestion-projet.md`. Tu es à V0.1 (proto Excel + scaffolding code en parallèle).

Prochain jalon : V0.2 — vertical slice "1 match jouable bout en bout".

## Drapeaux rouges à régler avant V0.5

1. ⚠️ Décision finale licence Top 14 (cf. tâche #23)
2. ⚠️ Plan B sourcing données joueurs (cf. tâche #25)

## Stack utilisée

- **TypeScript** strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **React 19** + **Vite 6**
- **Tauri 2** (binaire Rust desktop)
- **SQLite** via `@tauri-apps/plugin-sql` (à ajouter quand on attaque la persistance)
- **Zustand** pour le state UI
- **PixiJS** pour le rendu 2D du match
- **Vitest** + **fast-check** pour les tests
- **ESLint** avec règles archi custom
