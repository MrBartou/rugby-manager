# 2. Game Design Document (GDD)

> Statut : 🟡 En cours
> Document **vivant**, mis à jour à chaque décision prise.

---

## A. MVP — la plus petite version jouable et fun

**Question fondatrice :** quelle est la version minimale qui prouve les deux moteurs de retour (match + histoire humaine) ?

### Périmètre du MVP — choix : **Étroit**

- [x] **Compétitions incluses** : Top 14 uniquement (saison régulière + phases finales)
- [x] **Nombre de clubs jouables** : 1 club au choix parmi les 14
- [x] **Nombre de saisons jouables d'affilée** : 1 saison complète
- [x] **Système humain v0** : 5-6 traits combinés, mood basique, 5-10 events émergents
- [x] **Système de match v0** : 2D top-down stylisé (Motorsport Manager-like)
- [x] **Transferts** : ❌ pas en v1 (ou simulés en arrière-plan, pas jouables)
- [x] **Centre de formation** : ❌ pas en v1
- [x] **Sélections internationales** : ❌ pas en v1 (joueurs partent en trêve, on subit)
- [x] **Stratégie noms** : Licence officielle Top 14 *(⚠️ à reconfirmer — voir decisions.md)*

### Critère de validation du MVP

> Le MVP est réussi si un testeur peut répondre à la question *"pourquoi tu joues encore une heure de plus ?"* par une phrase concrète mentionnant un match, un joueur, ou les deux.

---

## B. Boucle hebdomadaire (la semaine type du joueur)

**Décision :** **5 jours actifs** + 2 jours auto-gérés.

**Objectif :** alterner moments de préparation (qui tissent les fils humains) et moments de paiement (le match qui les résout ou les ravive). C'est le rythme respiratoire du jeu.

### Calendrier proposé (à valider)

| Jour | Statut | Activité principale | Activité humaine | Décisions du joueur |
|------|--------|---------------------|------------------|---------------------|
| **Lundi** | 🎮 actif | Récupération + briefing tactique | Débrief vidéo collectif, sanctions/compliments individuels | Lecture du débrief, premières discussions individuelles |
| **Mardi** | 🎮 actif | Entraînement principal (volume) | Gestion charge / fatigue, premières alertes mood | Choix du type de session (physique / technique / mixte), gestion des cadres |
| **Mercredi** | 🎮 actif | Presse + vie humaine | Conférence de presse, interactions individuelles, événements émergents | Réponses presse, choix discussions individuelles (M10 Hades-style) |
| **Jeudi** | 🎮 actif | Entraînement spécifique | Travail set-pieces + lancements, dynamique du pack | Choix lancements de jeu, focus tactique du week-end |
| **Vendredi** | 💤 auto | Mise au vert + voyage | (Géré automatiquement) | Annonce composition, briefing dernier carat |
| **Samedi** | ⭐ MATCH | Match (5-15 live moments) | Performances individuelles | Composition finale, plan de jeu, live moments |
| **Dimanche** | 💤 auto | Récup + presse résumé | Réactions vestiaire au résultat | Lecture du résumé, autres résultats du Top 14 |

### Règles de design

- Au moins **un événement humain significatif par semaine** (discussion individuelle, presse, incident vestiaire, demande personnelle, mentor/élève) — concentré sur Lundi-Mercredi
- **Pas de "semaine vide"** entre deux matchs où il ne se passe rien d'humain
- Le joueur peut **dérouler une saison rapidement** en mode "auto" sur les jours actifs s'il n'a pas de fil ouvert qui l'intéresse — mais le design doit faire qu'il en a presque toujours
- **Variation anti-répétition** : sur 26 journées + coupes, les 5 jours actifs doivent éviter de devenir mécaniques. Mécanismes de variation : événements émergents aléatoires, presse contextuelle (avant un derby vs match de routine), incidents vestiaire imprévus

### Cas spéciaux à designer

- **Semaine sans match** (trêves internationales, vacances) : remplir avec récupération longue, scouting interne, événements humains plus longs
- **Semaine double** (Top 14 + Coupe d'Europe) : compresser le calendrier, gestion fatigue critique, choix turnover
- **Semaine de finale** : événements scriptés ou amplifiés, pression accrue sur les joueurs fragiles mentalement

---

## C. Boucle saisonnière

```
Pré-saison → Phase régulière → Trêve internationale → Phase régulière → Phases finales → Inter-saison (mercato + vacances)
```

**Décision : calendrier réel Top 14** (authentique pour les fans, structure les fils humains).

### Phases détaillées

- **Pré-saison** (juillet-août) : 4-6 semaines, matchs amicaux, montée en charge, jeunes intégrés. Faible enjeu sportif → moments narratifs forts pour installer les fils.
- **Phase régulière** (septembre-mai) : **26 journées** de Top 14 + matchs de Coupe d'Europe (mais Coupe d'Europe HORS-SCOPE en MVP — joueurs partent jouer en arrière-plan).
- **Trêves internationales** :
  - Novembre (test-match d'automne) : 3-4 cadres absents 3-4 semaines
  - Février-mars (Tournoi des 6 Nations) : 4-6 cadres absents 6-8 semaines
  - Effet : drame "le pack reconstruit avec des jeunes pendant que les Bleus jouent"
- **Phases finales** (mai-juin) : barrages (5e vs 6e, 4e vs 7e... selon format actuel), demi-finales, finale au Stade de France.
- **Inter-saison** (juin-juillet) : mercato (HORS-SCOPE en MVP — résolu en arrière-plan) + vacances (auto-géré).

### Implications design

- Notification spéciale pré-trêve : "qui pars avec les Bleus ?" → tension narrative
- Les semaines avec plusieurs cadres absents ont un mood collectif particulier
- Les barrages et finale ont un calibrage live moments différent (10-15 vs 5-7)

---

## D. Boucle carrière (objectifs long-terme du joueur)

### Objectifs court terme (saison 1) — **Adapté au club choisi**

L'objectif sportif est paramétré selon le club choisi en début de partie :

| Tier club | Exemple clubs | Objectif | Échec | Triomphe |
|-----------|--------------|----------|-------|----------|
| **Petit budget** | Castres, Pau, Brive, Vannes, Aurillac (D2) | Maintien | Relégation / barrage relégation | Top 6 (qualif phases finales) |
| **Budget moyen** | Bordeaux, Lyon, Clermont, La Rochelle | Top 6 | 9e ou inférieur | Demi-finale ou mieux |
| **Gros budget** | Toulouse, Stade Français, Racing 92, Toulon | Demi-finale | Hors top 6 | Bouclier de Brennus |

**Implications design :**
- Le président (NPC, voix) communique l'objectif en pré-saison
- Les attentes (et la pression) modulent les événements humains (mood président, presse)
- Échec = risque de licenciement en fin de saison ; triomphe = nouvelle confiance, négociations renforcées

### Objectifs moyen terme (saisons 2-5)

- *à définir*

### Objectifs long terme (saisons 5+)

- Construire une dynastie reconnue (référence le pilier OOTP : "records historiques tracés")
- Devenir sélectionneur national ?
- Faire monter un club de Pro D2 en Top 14 et le maintenir
- Transformer un club moyen en référence formatrice

---

## E. Modes de jeu

**Décision MVP : carrière classique seule.** Les autres modes sont reportés post-v1.

- [x] **Carrière classique** ✅ MVP : prendre un club du Top 14 et faire la saison
- [ ] **Mode défi** : scénarios pré-définis — post-v1
- [ ] **Bac à sable** : post-v1
- [ ] **Mode rapide** : auto-simulation des matchs — post-v1

---

## F. Win conditions

Quels sont les états où le joueur "a gagné" ou "a réussi" ?

- **Titres** : Bouclier de Brennus, Champions Cup, Challenge Cup
- **Reconnaissance** : meilleur entraîneur de l'année, sélectionneur national
- **Longévité** : carrière de 20+ saisons dans le même club
- **Records** : *à définir*
- **Récit personnel** : "j'ai pris Aurillac et je l'ai amené en finale du Top 14"

---

## G. Système de progression méta (entre parties)

> Stockage persistant entre les parties, à la FM career.

- **Réputation manager** : ce que les autres clubs pensent de toi (influence les offres, les négociations)
- **Badges** : *à définir si on en met*
- **Déblocages** : *à définir si on en met*

> ⚠️ Risque : ne pas tomber dans le travers gacha. La progression méta doit servir le récit long, pas être une carotte F2P.

---

## H. Test "pourquoi tu joues encore une heure ?"

À chaque sprint de design, on revalide cette question. Si on ne peut pas répondre par une phrase concrète mentionnant un match ou un joueur, on a un problème.

Réponses-types attendues :

- *"Je veux voir si Dupont va craquer face à Toulouse samedi."*
- *"Je dois finir cette saison avant que mon capitaine annonce sa retraite."*
- *"Le jeune que j'ai promu doit faire ses preuves au prochain match."*
- *"J'ai un choix à faire entre mes deux ouvreurs avant la finale."*
