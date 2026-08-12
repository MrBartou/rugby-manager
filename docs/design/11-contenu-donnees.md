# 11. Contenu et données

> Statut : ✅ Saisie manuelle hybride (chemin 3) en cours pour V0.5. ~250 joueurs nominatifs.

## 📋 État V0.5

- ✅ **14 clubs Top 14** dans [data/clubs.csv](../../data/clubs.csv) avec tier, identité tactique, budget, réputation
- ✅ **~250 joueurs nominatifs** dans [data/players.csv](../../data/players.csv)
  - Format compact : `clubId, firstName, lastName, position, birthYear, niveau, isJiff`
  - Stars réelles : Dupont, Penaud, Alldritt, Ollivon, Etzebeth, Jalibert, Niniashvili…
- ✅ **Expansion automatique** : niveau global → tous les attributs cohérents par poste — `src/data/seed.ts`
- ✅ **Génération de traits** déterministe à partir des stats — `src/engine/human/trait-generator.ts`
- ✅ Format CSV éditable, modable (commit dans git, diff lisible)
- ⬜ Décision finale licence Top 14 (chemin A/B/C) avant V0.9 — voir [12-juridique.md](./12-juridique.md)
- ⬜ Outil d'édition communautaire intégré (M14) — V1.0+
- ⬜ Génération procédurale de jeunes (post-MVP)
- ⬜ Données historiques (palmarès, records) — post-V1

---

## A. Stratégie de sourcing : Scraping initial + génération procédurale

> ⚠️ Voir section 12 (Juridique) — le scraping est juridiquement gris. Plan B obligatoire.

### Phase dev (interne)
- **Scraping** : rugby-club.fr, Wikipedia, sites stats (cf. section 12 pour caveats)
- Usage : constituer une base de données initiale pour calibrer le moteur et tester l'UI
- **Non-distribuée** : reste sur la machine de dev pendant V0.x

### Phase release v1 (3 chemins selon licence)

**Chemin 1 — Licence LNR acquise**
- Données officielles via contrat
- Tous les joueurs réels avec stats officielles ou proches

**Chemin 2 — Licence abandonnée, fictifs + mods**
- Joueurs fictifs proches (ex : "Antoine Du**a**ut" au lieu de "Antoine Dupont")
- Outil d'édition communautaire intégré (M14)
- Les fans publient des "packs noms réels" — stratégie FM validée 20 ans

**Chemin 3 — Hybride manuel + procédural**
- Saisie manuelle des noms réels + clubs + postes + âges (~1-2 semaines)
- Stats générées procéduralement avec calibrage (cohérence morpho-poste, niveau club, âge, expérience)
- Acceptable juridiquement si on argue "stats du jeu, pas données réelles"

---

## B. Volume cible v1 (MVP)

- **14 clubs Top 14** (1 jouable + 13 simulés en arrière-plan)
- **~30 joueurs par club** = 420 joueurs total
- **8 staff par club jouable** = 8 NPCs voix initialement (extensions post-MVP)
- **Calendrier réel Top 14** (26 journées + finales)
- **3-5 fils humains actifs** en permanence (généré dynamiquement)

---

## C. Génération procédurale (jeunes / inconnus)

> Référence : [03-modele-joueur.md](./03-modele-joueur.md) section F.

Pour le **MVP** : pas de génération procédurale en cours de partie (pas de centre de formation, pas de transferts).

Pour **post-v1** :
- Distribution réaliste des potentiels (peu de cracks, beaucoup de moyens, queue longue)
- Cohérence morpho-poste (un pilier ≠ un ailier morphologiquement)
- Identité régionale (un Toulousain ≠ un Rochelais)
- Génération des traits : pondération par âge (jeunes = plus de variabilité)

---

## D. Données historiques (post-v1)

- **Palmarès** : titres remportés par club, finales perdues
- **Records** : meilleur essayeur d'une saison, plus grand nombre d'essais en finale, etc.
- **Grandes équipes du passé** : référence narrative ("le Toulouse de 2003-2005", "Castres 2013")
- **Affichage** : pages "histoire du club" + records dynamiques générés en cours de partie

---

## E. Mods communautaires (M14 — pilier 4)

- Format de fichiers externes (CSV/JSON) éditables
- Outil intégré pour importer/exporter packs
- Hub communautaire (Discord ou subreddit)
- Steam Workshop si Steam disponible
