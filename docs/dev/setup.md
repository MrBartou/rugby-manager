# Guide développeur

> Pour la documentation produit, voir [docs/README.md](../README.md).
> Pour l'état d'implémentation, voir [docs/STATUS.md](../STATUS.md).

## Setup initial

```bash
git clone <repo>
cd "Rugby Manager"
npm install
npm run test       # 71/71 tests doivent passer
npm run dev        # http://localhost:5173
```

## Structure du code (V0.5)

```
src/
├── engine/                          ← MOTEUR PUR (aucune dépendance vers data/ ui/ tauri/)
│   ├── types.ts                     ← types domaine (Player, Club, GameEvent…)
│   ├── events.ts                    ← types d'événements game
│   ├── rng.ts                       ← RNG déterministe (seed)
│   ├── reducer.ts                   ← applyEvent(state, event) [partiel V0.5]
│   ├── match/
│   │   ├── types.ts                 ← MatchInput, PhaseOutcome, etc.
│   │   ├── session.ts               ← MatchSession stateful interactif
│   │   ├── simulate.ts              ← simulateMatch (thin wrapper sur session)
│   │   ├── scrum.ts                 ← V0.2 duel technique + dominance
│   │   ├── lineout.ts               ← V0.1 simplifié
│   │   ├── ruck.ts                  ← V0.1 simplifié
│   │   ├── openplay.ts              ← V0.1 + attribution finisheur
│   │   ├── kicking.ts               ← place + tactique
│   │   ├── live-moments.ts          ← 5 moments hardcodés
│   │   ├── narrative.ts             ← V0.5 récit enrichi 4 paragraphes
│   │   └── week-plan.ts             ← entraînement → modifiers
│   ├── season/
│   │   ├── calendar.ts              ← round-robin double + alternance H/A
│   │   └── standings.ts             ← classement Top 14 (V/N/D + bonus)
│   ├── game/
│   │   └── season-session.ts        ← orchestrateur saison
│   ├── club/
│   │   └── staff.ts                 ← V0.4 8 staff voix par club
│   └── human/                       ← V0.4 système humain
│       ├── traits.ts                ← 30 traits avec exclusivités
│       ├── trait-generator.ts       ← génération déterministe
│       ├── mood.ts                  ← 7 sources
│       ├── relationships.ts         ← graphe -100..+100
│       ├── events.ts                ← 5 events humains
│       ├── event-detector.ts        ← détection avec anti-spam
│       └── threads.ts               ← V0.5 fils dashboard
│
├── data/                            ← persistance (Repository pattern)
│   ├── seed.ts                      ← parsing CSV → SeedData (pure)
│   ├── seed-browser.ts              ← imports CSV via Vite ?raw
│   ├── repository.ts                ← interface GameRepository (V2 placeholder)
│   ├── match-save-repository.ts     ← saves de match (localStorage)
│   ├── season-save-repository.ts    ← saves de saison (localStorage)
│   └── schema.sql                   ← cible SQLite documentée
│
└── ui/                              ← React (consommation pure)
    ├── App.tsx                      ← routing + season ref
    ├── screens/
    │   ├── SeasonSetupScreen.tsx
    │   ├── SetupScreen.tsx          ← match isolé V0.2
    │   ├── PreMatchScreen.tsx       ← compo + entraînement
    │   ├── MatchScreen.tsx
    │   ├── DashboardScreen.tsx      ← V0.5 + fils humains
    │   ├── SquadScreen.tsx
    │   └── PlayerScreen.tsx
    └── components/
        ├── Scoreboard.tsx
        ├── PhaseTimeline.tsx
        ├── PitchView.tsx            ← terrain SVG
        ├── MatchSummary.tsx
        ├── LiveMomentModal.tsx
        ├── HumanEventModal.tsx
        ├── HumanThreads.tsx         ← V0.5
        ├── AttributeBar.tsx
        └── TraitChip.tsx

data/                                ← seed CSV (commit dans git, modable)
├── clubs.csv                        ← 14 clubs Top 14
└── players.csv                      ← ~250 joueurs nominatifs

tests/engine/                        ← 71/71 tests verts
├── scrum.test.ts                    ← 7
├── scrum-dominance.test.ts          ← 11
├── simulation.test.ts               ← 11
├── season.test.ts                   ← 14
├── season-flow.test.ts              ← 2 (régression)
├── human.test.ts                    ← 13
├── relationships.test.ts            ← 9
└── threads.test.ts                  ← 4

tools/                               ← CLI dev
├── play-match.ts                    ← npm run play
├── seed-stats.ts                    ← npm run play:stats
├── calibrate.ts                     ← npm run calibrate
└── seed-loader.ts                   ← Node-side CSV loader

docs/                                ← cette documentation
├── README.md                        ← index
├── STATUS.md                        ← tableau de bord
├── CHANGELOG.md
├── design/                          ← 14 docs produit + decisions.md
└── dev/setup.md                     ← ce fichier
```

## Disciplines architecturales (à NE PAS contourner)

> Voir [09-architecture-logicielle.md](../design/09-architecture-logicielle.md) pour le détail.

1. **`engine/` est pur** — aucune dépendance vers `data/`, `ui/`, `store/`, `intents/`, `sqlite`, ou `tauri`. Le linter le vérifie.
2. **Pas de `Math.random()`** dans `engine/` — utiliser `rng.next()` avec seed explicite. Bloqué par ESLint.
3. **Pas de `new Date()`** dans `engine/` — utiliser `gameState.simulationClock`. Bloqué par ESLint.
4. **Toute persistance passe par un Repository** — pas d'appel `localStorage` direct depuis l'UI.
5. **Sessions stateful pour l'interactif** — `MatchSession` (matchs) et `SeasonSession` (saisons) encapsulent l'état.
6. **CSV seed = source de vérité** — modable, commit git, expansion → Player au load.

Si tu sens le besoin de contourner une de ces règles, c'est probablement que tu mélanges des couches. Lis [09-architecture-logicielle.md](../design/09-architecture-logicielle.md) et reviens.

## Commandes utiles

```bash
# Dev
npm run dev                 # serveur Vite (http://localhost:5173)
npm run build               # build prod (336 kB / 104 kB gzip)
npm run preview             # preview du build

# Qualité
npm run typecheck           # tsc --noEmit (strict)
npm run lint                # ESLint + règles archi
npm run test                # 71 tests Vitest
npm run test:watch          # mode watch

# CLI dev
npm run play                # match aléatoire
npm run play -- list        # liste les 14 clubs
npm run play -- 42 toulouse usap         # match précis (seed 42)
npm run play -- 42 toulouse usap -v      # mode verbeux (toutes les phases)
npm run play -- 42 -n 75 50              # mode synthétique par niveau

npm run play:stats -- toulouse usap 500  # 500 matchs simulés agrégés

npm run calibrate           # 1000 matchs vs cibles V1, 2 scénarios
```

## Drapeaux rouges à régler avant V0.9

1. ⚠️ **Décision finale licence Top 14** (chemin A/B/C — voir [12-juridique.md](../design/12-juridique.md))
2. ⚠️ **Init Tauri** quand on attaquera le binaire desktop
3. ⚠️ **Migration localStorage → SQLite** quand le volume des saves grossira

## Stack actuelle (V0.5)

- ✅ **TypeScript** strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)
- ✅ **React 19** + **Vite 6**
- ✅ **SVG** pour le rendu 2D du match (PixiJS gardé pour V0.6+ quand sprites nombreux)
- ✅ **Vitest** pour les tests
- ✅ **ESLint** avec règles archi custom
- ✅ **localStorage** pour les saves (cible SQLite documentée dans `src/data/schema.sql`)
- ⬜ **Tauri 2** (V0.9)
- ⬜ **Zustand** (state UI à React.useState pour l'instant — Zustand quand l'état grossit)
- ⬜ **fast-check** property-based testing (V0.6)

## Roadmap actuelle

Tu es à **V0.5**. Toutes les mécaniques de fond sont en place. Voir [STATUS.md](../STATUS.md) pour l'état détaillé et la suite (V0.9 bêta privée, V1.0 release).
