# 9. Architecture logicielle

> Statut : ✅ Disciplines respectées en V0.1+. Event sourcing partiel (V2 online finalisera).

> ⚠️ **Cette section est CRITIQUE.** Elle définit les disciplines de v1 qui permettent l'ajout du mode online en v2 sans refactor.

## 📋 État V0.5

- ✅ **Discipline 1** : moteur match = fonction pure (`simulateMatch(input, seed) → MatchResult`)
- ✅ **Discipline 1bis** : MatchSession stateful pour mode interactif (déterministe)
- ✅ **Discipline 2** : repository pattern — `MatchSaveRepository`, `SeasonSaveRepository`, implémentations localStorage
- ✅ **Discipline 5** : UI = consommation pure (zéro accès direct à la persistance depuis les composants)
- ✅ **Discipline 6** : déterminisme via seeds explicites — `Math.random` et `new Date()` bloqués par ESLint dans `engine/`
- ⬜ **Discipline 3** : event sourcing complet — partiellement implémenté (DecisionLog des matchs sauvegardés). V2 online demandera un event log complet.
- ⬜ **Discipline 4** : save JSON portable — fait pour les matchs. Saves de saison utilisent localStorage avec snapshot, pas event log.

---

## A. Disciplines obligatoires (v1 → v2 enablement)

### 1. Moteur de match = fonction pure

```ts
// Signature obligatoire
function simulateMatch(
  state: MatchInputState,
  decisions: ManagerDecisions[],
  seed: RngSeed
): MatchResult
```

- **Aucun side effect** (pas d'appel DB, pas d'écriture fichier, pas de console.log persistant)
- **Aucune dépendance globale** (pas de singletons, pas de modules stateful)
- **Déterministe** : même entrée + même seed = même résultat exact
- **Testable** : peut tourner en isolation (Vitest), 10 000 matchs en CI sans monter de DB

**v2 enabler** : la fonction peut s'exécuter côté serveur Node/Rust autoritativement.

### 2. Repository pattern (couche données)

```ts
interface GameRepository {
  loadGame(saveId: string): Promise<GameState>
  saveGame(state: GameState): Promise<void>
  recordEvent(event: GameEvent): Promise<void>
  // ... autres méthodes
}

// v1
class LocalSQLiteRepository implements GameRepository { ... }

// v2 (à implémenter sans toucher au reste du code)
class RemoteAPIRepository implements GameRepository { ... }
```

- **Aucun appel SQLite direct** dans la logique métier
- **Toute persistence passe par l'interface** `GameRepository`
- **L'injection de la repo se fait à un seul endroit** (root du store / app)

**v2 enabler** : on swap l'implémentation, pas le reste.

### 3. Event sourcing pour l'état du jeu

L'état du jeu n'est pas mutaté directement. Il dérive d'une séquence d'événements typés :

```ts
type GameEvent =
  | { type: "SeasonStarted", season: number, club: ClubId }
  | { type: "MatchScheduled", matchId, home, away, date }
  | { type: "MatchPhasePlayed", matchId, phaseIndex, outcome }
  | { type: "PlayerInjured", playerId, injuryType, weeks }
  | { type: "TraitRevealed", playerId, trait }
  | { type: "RelationshipChanged", playerA, playerB, delta, reason }
  | { type: "TraitChanged", playerId, trait, action: "added" | "removed" }
  | { type: "ManagerDecisionTaken", decisionId, choice }
  // ... etc
```

```ts
// Reducer pur
function applyEvent(state: GameState, event: GameEvent): GameState
```

**Bénéfices v1 :**
- Debugging : on peut rejouer la séquence d'events depuis le début
- Save/load = sérialisation de la liste d'events
- Tests : on construit l'état en injectant des events précis

**v2 enabler :** le serveur reçoit les events des clients, les valide, les rejoue. Les clients font de même au reload.

### 4. Format save = JSON portable

Le `.save` est sérialisable en JSON pur (pas de binaire propriétaire) :

```json
{
  "version": "1.0.0",
  "seed": "...",
  "events": [ ... ],
  "metadata": { "club": "...", "season": ..., "savedAt": "..." }
}
```

- Compression à l'export (gzip → `.save.gz`)
- Versioning du schéma (migration auto à l'ouverture)

**v2 enabler :** upload/download direct vers/depuis le serveur. Les saves de v1 sont importables comme "saison solo archivée".

### 5. UI = consommation pure

```
React/UI ─── (lit) ──→ Store (Zustand/Jotai)
React/UI ─── (émet intent) ──→ Dispatcher
                                   ↓
                                 Engine (pure)
                                   ↓
                                 Event(s)
                                   ↓
                                 Reducer → new State
                                   ↓
                                 Repository (persist)
```

- L'UI **n'appelle jamais** SQLite ou la fonction de simulation
- L'UI **n'émet que des intents** (`{ type: "ScheduleTrainingSession", ... }`)
- Le dispatcher transforme intent en events validés

**v2 enabler :** intents peuvent être envoyés à un serveur au lieu d'un dispatcher local.

### 6. Determinisme via seeds explicites

```ts
// JAMAIS
Math.random()
new Date()

// TOUJOURS
seed.next()
gameState.simulationClock
```

- Tous les RNG passent par un objet seed sérialisable
- Toutes les "dates" passent par l'horloge du jeu (pas l'horloge système)

**v2 enabler :** le serveur peut rejouer un match côté serveur et obtenir le même résultat.

---

## B. Structure des modules

```
src/
├── engine/                  ← MOTEUR PUR (zéro dépendance externe)
│   ├── types.ts             ← types domaine (Player, Match, Event…)
│   ├── match/               ← simulation match
│   │   ├── scrum.ts
│   │   ├── lineout.ts
│   │   ├── openplay.ts
│   │   ├── kicking.ts
│   │   └── simulate.ts
│   ├── season/              ← progression saisonnière
│   ├── human/               ← système humain (traits, mood, relations, events)
│   └── reducer.ts           ← applyEvent(state, event)
│
├── data/                    ← couche persistance (abstraction + impl)
│   ├── repository.ts        ← interface GameRepository
│   ├── local-sqlite.ts      ← v1 impl
│   └── remote-api.ts        ← v2 impl (placeholder)
│
├── intents/                 ← traduction intent → events
│   └── dispatcher.ts
│
├── ui/                      ← React (pure consumption)
│   ├── screens/
│   │   ├── DashboardScreen.tsx
│   │   ├── MatchScreen.tsx
│   │   ├── PlayerScreen.tsx
│   │   └── CompositionScreen.tsx
│   ├── components/
│   └── hooks/
│
├── store/                   ← state management (Zustand)
│   └── gameStore.ts
│
└── tauri/                   ← intégration Tauri (commands, IPC)
```

### Règle d'or

> `engine/` ne dépend JAMAIS de `data/`, `ui/`, ou `tauri/`.
> `engine/` ne fait que des calculs. Tout effet de bord est ailleurs.

---

## C. Tests strategy

- **Unit** (Vitest) : tous les fichiers de `engine/`. Coverage cible 80%+.
- **Property-based testing** (fast-check) : invariants du moteur (somme des scores cohérente, pas d'événements impossibles, etc.)
- **Simulation tests** : 10 000 matchs simulés en CI, vérification distributions (4-6 essais/match, etc.)
- **Integration** (Vitest) : flow end-to-end avec `LocalSQLiteRepository` mockée
- **E2E UI** (Playwright) : plus tard, sur le slice complet

---

## D. Décision modding

> Référence : Football Manager (M14 — architecture moddable)

- **Format de données externes** : les joueurs initiaux, les clubs, les calendriers sont en CSV/JSON dans `/data/`
- **Outil d'édition communautaire** : un éditeur simple permet de modifier les fichiers CSV pour créer des "packs de noms réels"
- **Compatibilité** : le moteur ne doit pas casser si un mod ajoute des joueurs ou modifie des stats
- **Online v2 + mods** : la ligue serveur impose un set de données canonique, mais le client peut afficher localement les noms du mod (cosmétique only)

---

## E. Anti-patterns à éviter absolument

❌ Appeler SQLite directement depuis un composant React
❌ Stocker l'état du jeu dans le state React global (perd le moteur pur)
❌ Faire du `Math.random()` ou `new Date()` n'importe où
❌ Mélanger UI logic et game logic dans les hooks
❌ Coupler le moteur à Tauri (le moteur doit pouvoir tourner en pure Node pour les CI)
❌ Utiliser des migrations DB sans versioning de save
