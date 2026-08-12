# 8. Stack technique

> Statut : ✅ Toutes les décisions principales appliquées sauf Tauri (V0.9).

## 📋 État V0.5

- ✅ TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) — `tsconfig.json`
- ✅ React 19 + Vite 6 — `vite.config.ts`, `index.html`
- ✅ Bundler Vite, build prod 336 kB / 104 kB gzip
- ✅ Zustand mentionné mais pas encore utilisé (V0.4 reste en useState — Zustand quand l'état grossit)
- ✅ SVG pour le rendu match (PixiJS gardé pour V0.6+ quand on aura besoin de centaines de sprites)
- ✅ Vitest + fast-check (fast-check pas encore activé — V0.6)
- ✅ ESLint avec règles archi custom (engine pur, no Math.random / new Date)
- ✅ Format save : JSON portable + localStorage (le `schema.sql` documente la cible SQLite)
- ⬜ Tauri 2 (V0.9 — quand on attaquera le binaire desktop)
- ⬜ SQLite via `@tauri-apps/plugin-sql` ou `sql.js` (V0.9, pour migrer du localStorage)
- ⬜ Auto-updater Tauri (V1.0)

---

## Décision principale

**TypeScript + React + Tauri + SQLite**

### Choix justifié

- **Tauri** (Rust embedded) : binaire léger (~10-20 MB vs ~150 MB Electron), perf native, bonne intégration Steam/Itch
- **TypeScript + React** : écosystème UI riche, productif pour un solo dev avec background web
- **SQLite** : sauvegardes simples (un fichier `.save` = un fichier `.sqlite`), requêtes flexibles, pas de serveur
- **Rust côté Tauri** : option pour porter du code critique perf (moteur de match) plus tard si besoin

### Alternatives écartées

- **Electron** : trop lourd, perf inférieure en 2026
- **Rust core + frontend web** : valable mais double la charge dev pour un solo
- **Godot 4** : excellent pour le rendu 2D match, mais l'UI management (tableaux, fiches, navigation) est pénible vs React

---

## Détails à préciser

### Versions et frameworks
- [ ] Tauri version (v2.x à privilégier)
- [ ] React version (19+)
- [ ] TypeScript strict mode : oui par défaut
- [ ] Bundler : Vite

### Rendu 2D du match (pilier 1)
- [ ] **PixiJS** (recommandé pour 2D top-down avec animations)
- [ ] Canvas 2D natif (suffisant pour une viz épurée)
- [ ] SVG (lisible, mais limites de perf si beaucoup d'éléments)

### Base de données
- [ ] SQLite via `tauri-plugin-sql` (Rust côté backend) ou `sql.js` (JS pur)
- [ ] ORM : Drizzle ou Prisma (TS) ou écriture directe en SQL si schéma stable
- [ ] Migrations : système maison ou outil tiers

### Format des sauvegardes
- [ ] Un fichier `.save` = un fichier SQLite + métadonnées JSON
- [ ] Compression à l'export (gzip)
- [ ] Versioning du schéma de save → migration auto à l'ouverture

### State management
- [ ] **Zustand** ou **Jotai** (recommandés, simples, no boilerplate)
- [ ] Redux : trop verbeux pour un solo dev
- [ ] Context API React : OK pour petit état, insuffisant pour un manager

### Tests
- [ ] **Vitest** pour le moteur (unitaires + intégration)
- [ ] **Playwright** ou **WebdriverIO** pour les e2e UI plus tard
- [ ] CI : GitHub Actions, run de 10 000 matchs simulés à chaque PR

### Outillage
- [ ] **Git + GitHub** (versioning + Actions)
- [ ] **ESLint + Prettier** (TS)
- [ ] **rustfmt + clippy** (côté Tauri)
- [ ] IDE : VSCode (cible solo dev)

---

## Distribution (anticipation section 15)

- **Steam** : cible principale (audience fan de FM/manager)
- **Itch.io** : cible secondaire, pas de cut Steam, communauté indé
- **Tauri auto-updater** pour les patchs (sans passer par Steam pour les early access)

---

## Stack v2 (online mode — anticipation)

> Activée par les disciplines architecturales v1 (voir section 9).

### Backend
- **Node.js + TypeScript** (réutilise le moteur v1 directement) **OU** **Rust** (perf max, port du moteur)
- Recommandation : commencer en Node TS pour vitesse, porter en Rust si goulot CPU

### Base de données
- **PostgreSQL** (managed sur Neon, Supabase, ou Railway)
- Migration depuis SQLite local : event log v1 → import dans Postgres

### API
- **REST** ou **GraphQL** (préférence personnelle)
- WebSockets uniquement si vraiment temps réel (pas le cas du mode async)

### Hébergement
- **Fly.io / Railway / Render** : simple, pas-cher pour solo dev
- Coût estimé : 30-100€/mois en early access, jusqu'à 200€+ selon trafic
- Backup DB quotidien obligatoire

### Authentification
- **OAuth Discord** privilégié (communauté gamer, pas de password à gérer)
- Sinon Auth.js / Lucia / Supabase Auth pour email+password
