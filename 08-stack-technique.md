# 8. Stack technique

> Statut : 🟡 Cadrage validé, détails à affiner

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
