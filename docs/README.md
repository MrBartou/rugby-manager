# Rugby Manager — Documentation

> Le FM du rugby français — focus modélisation match + vie de vestiaire.

## 🚀 État actuel

**Version : V0.5** (toutes les mécaniques de fond en place, prêt pour bêta privée)

| Jalon | Statut |
|---|---|
| V0.1 — Proto moteur match | ✅ |
| V0.2 — Vertical slice "1 match jouable" | ✅ |
| V0.3 — Saison Top 14 + boucle hebdomadaire | ✅ |
| V0.4 — Système humain v0 | ✅ |
| V0.5 — Polish + UI | ✅ |
| V0.9 — Bêta privée | ⬜ |
| V1.0 — Release | ⬜ |

Détails dans [STATUS.md](./STATUS.md) et [CHANGELOG.md](./CHANGELOG.md).

## 📁 Organisation

```
docs/
├── README.md           ← ce fichier
├── STATUS.md           ← tableau de bord global de l'implémentation
├── CHANGELOG.md        ← historique V0.1 → V0.5
├── design/             ← 14 documents de design produit (vision, GDD, archi…)
└── dev/                ← guides développeur
```

## 📚 Documents de design

> Les `XX` correspondent à l'ordre de lecture conseillé pour découvrir le projet.

### Vision et game design
1. [Vision et concept](./design/01-vision-concept.md) — pitch, 5 piliers, mécaniques empruntées
2. [Game Design Document](./design/02-gdd.md) — MVP, boucles (semaine, saison, carrière)
3. [Modèle joueur](./design/03-modele-joueur.md) — attributs, traits, mood, relations
4. [Modèle équipe et club](./design/04-modele-equipe-club.md) — staff voix, finances, identité

### Mécaniques rugby
6. [Moteur de match](./design/06-moteur-match.md) — phases, calibrage, live moments
7. [Tactique et préparation](./design/07-tactique-preparation.md) — 3 niveaux tactiques

### Technique
8. [Stack technique](./design/08-stack-technique.md) — TS + React + Tauri + SQLite
9. [Architecture logicielle](./design/09-architecture-logicielle.md) — disciplines, event sourcing
10. [UI / UX](./design/10-ui-ux.md) — écrans MVP, navigation

### Contenu et opérationnel
11. [Contenu et données](./design/11-contenu-donnees.md) — sourcing, génération procédurale
12. [Juridique](./design/12-juridique.md) — licences Top 14, scraping, EULA
13. [Gestion de projet](./design/13-gestion-projet.md) — roadmap V0.1 → V1.0
14. [Tests et validation](./design/14-tests-validation.md) — pyramide, bêta-test
15. [Distribution](./design/15-distribution.md) — Steam, Itch, pricing

### Journal
- [decisions.md](./design/decisions.md) — log ADR-style des décisions de design

## 🛠️ Documentation développeur

- [Setup et structure du code](./dev/setup.md) — install, conventions, commandes utiles

## ⚡ Commandes essentielles

```bash
npm install                    # première install
npm run dev                    # dev server (Vite, port 5173)
npm run test                   # 71 tests unitaires + intégration
npm run typecheck              # tsc --noEmit (strict)
npm run lint                   # ESLint avec règles archi (engine pur)
npm run build                  # build prod

# Outils CLI
npm run play                   # joue un match en CLI (highlights ou -v verbose)
npm run play -- list           # liste les 14 clubs
npm run play -- 42 toulouse usap
npm run play:stats -- toulouse usap 500
npm run calibrate              # 1000 matchs, distributions vs cibles V1
```
