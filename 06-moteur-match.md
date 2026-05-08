# 6. Moteur de match (la grosse pièce)

> Statut : 🟡 Décisions de cadrage prises, spec détaillée à faire

---

## Décisions cadrage prises

### Visualisation : 2D top-down stylisée

Référence : Motorsport Manager. Vue de dessus, formes stylisées, lisible, expressive.

- Animation des phases de jeu (mêlée, ruck, course) comme micro-states visuels lisibles
- Représentation de formations, lignes défensives, momentum, fatigue collective
- Choix technique de rendu : Canvas / SVG / PixiJS (à arbitrer en section 8)

### Granularité : par phase de jeu

Chaque phase = un événement simulé. Volume cible : ~75 phases par match (cohérent avec la réalité Top 14).

Conséquences architecturales :
- Le moteur produit une **séquence d'événements typés** (mêlée, lancement, ruck, passe, plaquage, pénalité, jeu au pied, essai…)
- Chaque événement a une durée variable (mêlée = 30-60s simulés, course = quelques secondes)
- L'UI consomme ce flux d'événements pour produire l'animation 2D
- Permet de tester chaque sous-système (mêlée, touche, ruck) en isolation

### Live decision moments : 5-15 par match

Calibrage :
- Match de routine : ~5-7 moments
- Derby / match-clé / finale : 10-15 moments
- Types de moments : changement de tactique, sortie d'un cadre, contestation arbitrage, consigne mi-temps, time-out tactique, focus sur un joueur en difficulté
- Chaque moment doit être **signifiant** (impact réel sur la suite du match)
- Calibrage critique : trop = clic-spam, pas assez = passivité

---

## À spécifier

### Modèles des sous-systèmes (un par sous-système, isolés et testables)
- [ ] **Mêlée** : poussée, technique, gainage, sanctions
- [ ] **Touche** : saut, lift, contre, qualité du lancer
- [ ] **Jeu courant** : passes, courses, plaquages, offloads, défense rideau
- [ ] **Rucks/mauls** : vitesse de libération, contests, mauls pénétrants
- [ ] **Jeu au pied** : occupation, chandelles, pénalités, drops, transformations
- [ ] **Fautes et arbitrage** : cartons, en-avant, hors-jeu

### Influences environnementales
- [ ] Météo et état du terrain
- [ ] Effets domicile / extérieur, public, ambiance

### Sortie du moteur
- [ ] Stats individuelles générées par match (plaquages, mètres, turnovers, ratios)
- [ ] Génération de résumé de match narratif
- [ ] Performances individuelles marquantes mises en avant

### Interaction live
- [ ] Nombre de live moments par match
- [ ] Types de live moments (changement, consigne mi-temps, contestation, time-out tactique)
- [ ] Consignes mi-temps : déléguer ou interactif ?

---

## Calibrage cible (section 14)

Critères de crédibilité pour valider le moteur :

- 4-6 essais par match en moyenne
- 60-70% de réussite aux pénalités
- ~75 phases de jeu par match
- Domination en mêlée corrélée aux statistiques réelles
- *(à compléter)*

## Plan de travail (proto Excel V0.1)

**Stratégie choisie : tous les sous-systèmes en parallèle, version simplifiée.**

> ⚠️ Risque identifié : si la mêlée reste en version simplifiée (probabilités plates), elle finit en coin flip — anti-pilier 1. **Mitigation** : après V0.1 validé end-to-end, mêlée est le premier sous-système à approfondir en V0.2 (modèle de duel technique + gainage + sanctions).

### V0.1 — Tous simplifiés (1-2 semaines Excel)

1. **Mêlée v0** : score combiné des 8 avants vs 8 avants + bonus tactique → résultat (gain ballon / faute / pénalité)
2. **Touche v0** : score talonneur + 2e ligne + lift → qualité ballon
3. **Jeu courant v0** : score équipe attaque vs équipe défense → gain de mètres / brèche / plaquage
4. **Ruck v0** : ratio attaque/défense → vitesse libération / turnover
5. **Jeu au pied v0** : score buteur vs distance/angle + score occupation territoire
6. **Fautes v0** : taux de pénalités basé sur agressivité défensive

### V0.2 et au-delà — Approfondissement progressif

- Mêlée → modèle de duel technique (poussée + technique + gainage) — discriminant pilier 1
- Touche → modèle saut + lift + qualité du lancer + contre
- Jeu courant → granularité passes/courses/offloads/lignes défensives
- Ruck → vitesse de libération + contests + mauls pénétrants
- Jeu au pied → occupation tactique + chandelles + duels aériens

### Critères de validation V0.1

- 4-6 essais par match en moyenne sur 1000 matchs simulés
- 60-70% de réussite aux pénalités
- ~75 phases par match
- Ratio possession ~50/50 entre équipes équivalentes
- Écart de niveau (gros club vs petit) produit ~70/30 d'avantage

### Plan de travail post-Excel

1. **Implémentation TypeScript du moteur** : portage du modèle Excel validé
2. **Tests unitaires** sur chaque sous-système (Vitest)
3. **Tests d'intégration** : 10 000 matchs en CI à chaque PR, vérification que les distributions restent stables
4. **V0.2** : approfondissement mêlée (premier sous-système discriminant)
