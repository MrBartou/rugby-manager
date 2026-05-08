# 13. Gestion de projet

> Statut : 🟡 Approche dev définie, roadmap à détailler

---

## Approche : **Vertical slice prioritaire**

> Le piège du dev qui se lance dans le jeu : architecturer proprement avant d'avoir validé que c'est *fun*. On évite ça.

### Séquence

```
1. Proto Excel du moteur de match (calibrage avant code)
   ↓
2. Vertical slice : 1 match jouable bout en bout
   (données → moteur → UI → résultat narratif)
   ↓
3. Validation du fun (testeurs proches, 10-20 matchs joués)
   ↓
4. Extension horizontale :
     a. Boucle hebdomadaire (5 jours actifs)
     b. Système humain v0 (traits + mood + relations + events)
     c. Saison complète (26 journées + finales)
     d. Modes dérivés (composition équipe-type, tactique)
   ↓
5. Polish (UI moderne, son, narrative output)
   ↓
6. Bêta privée → bêta publique → release v1
```

### Pourquoi cette approche

- **Prouver le fun avant l'archi** : si le match n'est pas fun, on a perdu 3 semaines, pas 6 mois
- **Découvrir 80% des problèmes d'archi sur le slice** : la vraie connaissance du domaine émerge en codant
- **Livraison testable très tôt** : le slice peut être joué par des proches dès le mois 2-3

---

## Roadmap (à affiner)

### V0.1 — Proto moteur match (~mois 1-2)
- [ ] Modèle Excel du moteur (calibrage 1000 matchs simulés)
- [ ] Validation distributions vs réalité Top 14 (essais, pénalités, phases)
- [ ] Décision GO/NO-GO sur le calibrage avant de coder

### V0.2 — Vertical slice "1 match jouable" (~mois 2-4)
- [ ] Schéma DB minimal (joueurs, équipe, match)
- [ ] Moteur match TS (porté du modèle Excel)
- [ ] UI 2D top-down basique (PixiJS ou Canvas)
- [ ] Live moments (5-7 hardcodés pour le slice)
- [ ] Génération de résumé narratif simple
- [ ] **Critère succès** : un testeur peut jouer 5 matchs et raconter chacun avec une anecdote

### V0.3 — Boucle hebdomadaire (~mois 4-6)
- [ ] 5 jours actifs implémentés
- [ ] Entraînement basique (charge, focus)
- [ ] Composition équipe-type
- [ ] Saison complète déroulable (26 journées + finales)

### V0.4 — Système humain v0 (~mois 6-9)
- [ ] Modèle joueur complet (3 catégories attributs + traits + mood)
- [ ] Graphe de relations (échelle continue + types)
- [ ] Events humains (5-10 types : décisions managériales + vestiaire)
- [ ] Staff voix (M12)

### V0.5 — Polish + UI (~mois 9-11)
- [ ] Wireframes finalisés
- [ ] Charte graphique
- [ ] Dashboard d'accueil avec 3-5 fils humains
- [ ] Narrative output amélioré (résumés de match)

### V0.9 — Bêta privée (~mois 11-13)
- [ ] 5-10 testeurs proches, fans de rugby
- [ ] Itération rapide selon feedback
- [ ] Critères de validation MVP : testeurs jouent 1 saison complète et reviennent demander la v1

### V1.0 — Release (~mois 13-15)
- [ ] Bêta publique élargie (~50-200 testeurs)
- [ ] Patch ciblé
- [ ] Lancement Steam + Itch

### V2.0 — Mode ligue online (mois 18-24+)

> Activé par les disciplines architecturales de la v1 (voir section 9).

- [ ] Backend Node ou Rust + PostgreSQL hébergé
- [ ] Authentification (email/password ou OAuth Discord)
- [ ] Mode "Ligue mixte humain + IA" : 1-3 humains + 11-13 IA dans un Top 14
- [ ] Serveur autoritaire pour la simulation des matchs (anti-cheat naturel)
- [ ] Système de matchs async humain vs humain (48h de préparation)
- [ ] Cloud save : upload/download des saisons solo
- [ ] Coût ops estimé : 50-200€/mois selon trafic
- [ ] Communication marketing v1 : "online à venir en v2" — promesse soft

---

## Estimation temps

> "Multiplie par 2-3 ton estimation initiale en solo" — doc fondateur. Pour un premier jeu : **multiplie par 4**.

- Estimation naïve : 8-10 mois
- Estimation réaliste : **15-18 mois solo à temps plein**, ou **24-36 mois à mi-temps**

---

## Outillage

- **Suivi tâches** : GitHub Projects (intégré au repo)
- **Versioning** : Git + GitHub
- **Documentation** : Markdown versionné dans `/design/` (ce dossier)
- **Decisions log** : `decisions.md` (ADR-style)

---

## Rythme de travail soutenable

À définir selon la situation perso :

- [ ] Heures/semaine cible :
- [ ] Jour OFF dédié :
- [ ] Quand on s'arrête (signal d'épuisement) :

> Faire un jeu solo c'est un marathon. Mieux vaut 12h/semaine pendant 24 mois que 30h/semaine pendant 4 mois.
