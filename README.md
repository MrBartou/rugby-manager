# Rugby Manager — Documentation de design

> Un rugby manager qui prend enfin au sérieux la tactique du sport et la vie du vestiaire.

## Pitch en une phrase

Le FM du rugby français, avec un focus sur la modélisation rugby-spécifique du match et la vie de vestiaire émergente.

## Public cible

Hardcore **et** casual — un fan de rugby qui n'a jamais joué à FM doit s'amuser en 2 heures, mais la maîtrise prend des mois.

## Les deux moteurs de retour

Le joueur revient parce qu'il a deux fils ouverts qu'il veut tirer :

- **Moteur A** — le match qui arrive (ponctuel, programmé)
- **Moteur B** — l'histoire humaine en cours (continu, émergent)

Les deux se nourrissent mutuellement : ce qui se passe humainement influence le match, et le match crée les événements qui font évoluer l'humain.

## Test de validation permanent

À tout moment, le joueur doit pouvoir répondre à *"pourquoi tu joues encore une heure de plus ?"* par une phrase concrète mentionnant soit un match, soit un joueur, soit les deux.

Si la réponse est *"je sais pas, j'avance"*, le système est cassé.

## État du projet

| # | Section | Statut |
|---|---------|--------|
| 1 | Vision et concept | ✅ Validée |
| 2 | Game Design Document (GDD) | 🟡 En cours (MVP + modes décidés) |
| 3 | Modèle joueur | 🟡 Cadrage avancé (échelle, traits, mood, relations) |
| 4 | Modèle équipe et club | 🟡 Staff (8 NPCs voix) |
| 5 | Compétitions | 🟡 Calendrier réel Top 14 |
| 6 | Moteur de match | 🟡 Cadrage (2D, par phase, 5-15 moments) |
| 7 | Tactique et préparation | 🟡 3 niveaux (philo + pré-match + live) |
| 8 | Stack technique | 🟡 Cadré (TS+React+Tauri+SQLite) |
| 9 | Architecture logicielle | 🟡 Patterns définis (event sourcing + repo + pure engine) |
| 10 | UI / UX | 🟡 4 écrans MVP priorisés |
| 11 | Contenu et données | 🟡 Sourcing scraping + procédural |
| 12 | Juridique | ⚠️ Critique — décisions à reconfirmer (licence + scraping) |
| 13 | Gestion de projet | 🟡 Vertical slice + roadmap V0.1→V2.0 |
| 14 | Tests et validation | 🟡 Pyramide complète + bêta privée |
| 15 | Distribution | 🟡 Steam + Itch.io |

## Structure des fichiers

```
Rugby Manager/
├── README.md                      ← ce fichier (index + état du projet)
├── 01-vision-concept.md           ← vision validée, piliers, positionnement
├── 02-gdd.md                      ← boucles de jeu, modes, MVP (en cours)
├── 03-modele-joueur.md            ← attributs, progression, traits
├── 04-modele-equipe-club.md       ← staff, finances, infrastructures
├── 05-competitions.md             ← Top 14, Pro D2, coupes
├── 06-moteur-match.md             ← simulation, mêlée, touche, jeu courant
├── 07-tactique-preparation.md     ← système tactique, entraînement
├── 08-stack-technique.md          ← choix techniques
├── 09-architecture-logicielle.md  ← séparation moteur/UI, modules
├── 10-ui-ux.md                    ← wireframes, charte graphique
├── 11-contenu-donnees.md          ← joueurs, données initiales
├── 12-juridique.md                ← licences, droits
├── 13-gestion-projet.md           ← roadmap, jalons
├── 14-tests-validation.md         ← tests unitaires, plans de bêta
├── 15-distribution.md             ← plateforme, communauté
├── decisions.md                   ← journal des décisions (date + raison)
├── balancing/                     ← fichiers Excel de calibrage
├── wireframes/                    ← maquettes UI
└── data/                          ← données initiales (CSV/JSON)
```

## Méthode de travail

1. **GDD d'abord** — sans ça le reste flotte
2. **Modèle joueur + moteur de match** — la matière du jeu
3. **Stack et architecture** — une fois qu'on sait ce qu'on simule
4. **Le reste** — en parallèle, itérativement

## Erreurs à ne pas reproduire

- Sortir un produit non fini (PRM 2015)
- Empiler les menus sans repenser l'expérience (FM moderne)
- Bâcler le vestiaire (tous les concurrents directs)
- Sacrifier la profondeur sur l'autel de l'accessibilité (Rugby Manager mobile) — ou l'inverse (FM)
- Architecturer proprement avant d'avoir validé que le jeu est *fun*
