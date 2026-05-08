# 3. Modèle joueur

> Statut : 🟡 Cadrage en cours (échelle, traits, catégories décidés)

---

## Vue d'ensemble

Un joueur est une entité avec :
- **Attributs** (techniques, physiques, mentaux) — stats numériques
- **Stats spécifiques au poste** (mêlée pour avants, jeu au pied pour ouvreurs…)
- **Traits de personnalité** — modulateurs de comportement
- **État dynamique** — forme, fatigue, mood, blessures
- **Carrière** — contrat, salaire, historique, palmarès
- **Caractéristiques cachées** — potentiel, ambition, déterminisme

---

## A. Attributs

### Échelle choisie : **Hybride affichée**

- **Backend** : 0-100 (granulaire pour le moteur)
- **UI** : barres + lettres **S / A / B / C / D**
- **Mapping cible** : S = 90-100, A = 75-89, B = 55-74, C = 35-54, D = 0-34

> Stratégie FM : précision interne, lisibilité externe. Anti-spreadsheet (pilier 3).

### Découpage choisi : **3 catégories + spécifiques poste**

- **Techniques** : passe, plaquage, jeu au pied, déblayage, prise de balle, vision…
- **Physiques** : vitesse, puissance, endurance, taille/poids dérivés…
- **Mentaux** : décision, leadership, sang-froid, agressivité, professionnalisme…
- **+ Sub-stats par poste** (voir section ci-dessous)

### Stats spécifiques par poste

- **Pilier (1, 3)** : poussée mêlée, gainage, soutien
- **Talonneur (2)** : précision lancer, mêlée, plaquage
- **2e ligne (4, 5)** : saut en touche, lift, mauls
- **3e ligne (6, 7, 8)** : plaquage, ruck, soutien, mobilité
- **Demi de mêlée (9)** : passe rapide, vision, jeu au pied tactique
- **Ouvreur (10)** : jeu au pied, décision, passe longue, transformation
- **Centre (12, 13)** : plaquage, percussion, passe, vision
- **Ailier (11, 14)** : vitesse, finition, prise de balle haute
- **Arrière (15)** : jeu au pied, prise de balle haute, contre-attaque

---

## B. Traits de personnalité

> Inspiration : Crusader Kings 3 (M5 — système de traits combinés)

### Nombre de traits par joueur : **5-6 traits combinés**

- Pool cible : 30-50 traits possibles
- Distinction **durs** (caractère stable) vs **doux** (peuvent évoluer avec l'expérience)
- Certains traits sont exclusifs entre eux ("Leader naturel" vs "Suiveur")
- Affichage UI : chips/badges sur la fiche joueur (visible mais pas dominant)

### Catégories envisagées

- **Leadership** : capitaine naturel, second couteau, suiveur, électron libre
- **Mental fort/faible** : sang-froid, fragile mentalement, hothead, professionnel
- **Ambition** : ambitieux, satisfait, joueur d'argent, attaché au club
- **Relationnel** : charismatique, solitaire, mentor, rancunier, loyal
- **Style de jeu** : aventureux, sécuritaire, créatif, discipliné

### Règle de combinaison

Les traits se combinent : un *Ambitieux + Rancunier + Charismatique* agit différemment d'un *Loyal + Humble + Fragile mentalement*. Le comportement est émergent, pas scripté.

---

## C. État dynamique

### Forme et fatigue
- **Forme** : indicateur 0-100 qui évolue selon temps de jeu, résultats, mood
- **Fatigue** : accumulation à l'entraînement et en match, récupération sur jours off

### Mood (M8 — RimWorld)
> L'humeur calculée en continu à partir de modificateurs.

**Sources cibles : 6-8 sources principales**

1. **Forme physique** (état actuel : top forme / méforme)
2. **Résultats récents** (3-5 derniers matchs collectifs et individuels)
3. **Statut dans l'équipe** (titulaire indiscutable / rotation / réserve)
4. **Relations clés** (conflits ou affinités fortes avec coéquipiers/staff)
5. **Contrat** (proche de fin / récemment signé / sous-payé selon ressenti)
6. **Fatigue accumulée** (charge hebdomadaire + matchs joués)
7. **Reconnaissance staff/presse** (titre du week-end, sélection nationale, critique)
8. **Vie privée** (événements exceptionnels : naissance, deuil, problème personnel)

Exemples de modificateurs :
- "Vient de gagner un match important" : +10 mood, 1 semaine (source 2)
- "N'a pas joué les 3 derniers matchs" : -15 mood (source 3)
- "Conflit avec un coéquipier" : -8 mood, persistant (source 4)
- "Naissance d'un enfant" : +5 mood, 2 semaines (source 8)
- "Approche de fin de contrat" : -5 mood, persistant tant que non résolu (source 5)

**Calcul** : somme pondérée des modificateurs actifs. Mood = base 50 ± modificateurs, clampé [0, 100].

**Lisibilité** : la fiche joueur doit montrer les top 3 modificateurs actifs ("pourquoi il va mal ?") pour ne pas être obscur.

### Blessures
- Granularité : *à définir*
- Types : musculaires, ligamentaires, commotions, fractures…
- Durée variable + risque de séquelles
- Concept "joueur de verre" (susceptibilité aux blessures)

---

## C bis. Relations entre joueurs (M6 — graphe)

### Granularité choisie : **Échelle continue + types**

Chaque paire de joueurs a :
- Un **score numérique de -100 à +100**
- Un **type de relation optionnel** : `mentor`, `rival`, `ami`, `neutre`, `conflit`

### Volumétrie

- 30 joueurs par effectif → 30 × 29 / 2 = **435 paires max**
- Coût mémoire/CPU négligeable
- Lazy : on ne stocke que les paires non-neutres

### Évolution dans le temps

Les scores évoluent selon des événements partagés :
- Gagner un match ensemble (titulaires) : +1-2
- Perdre un match clé : -1 à -3
- Se disputer un poste : -3 à -8
- Défendre quelqu'un en interview : +5
- Mentor → élève qui réussit : +10
- Conflit ouvert (event humain) : -15 à -30

### Persistance et mémoire

> Référence : Frostpunk (M11) — les rancœurs persistent.

- Un joueur humilié il y a 2 saisons s'en souvient (relation reste basse)
- Les scores ne reviennent pas naturellement à 0 sans événements positifs
- Possibilité de "réconciliations" (events spécifiques)

### Impact sur le mood (sources 4 du mood)

- Si plusieurs relations sont à -50 ou pire → mood -10/-15 ("conflit avec coéquipiers")
- Si plusieurs relations sont à +50 ou mieux → mood +5/+10 ("vestiaire soudé")
- Un mentor et un élève dont la relation est à +60 → bonus de progression de l'élève

### Génération initiale (début de partie)

- Pour les couples de joueurs partageant le même poste → -10 à -20 (rivalité par défaut)
- Pour les anciens du club → +5 à +20 entre eux
- Pour les nouveaux arrivants → 0
- Modulation par traits compatibles ou incompatibles (M9 RimWorld)

---

## D. Carrière et contrat

- **Contrat** : durée, salaire annuel, primes (matchs joués, titres, sélections)
- **Clauses** : libération, performance, JIFF, anti-rapt
- **Historique** : matchs joués, essais, titres, blessures cumulées
- **Palmarès** : titres remportés, sélections, distinctions individuelles
- **Affinité club** : un joueur formé au club a un attachement plus fort

---

## E. Caractéristiques cachées

> Inspiration : Football Manager (M3 — attributs cachés + scouting progressif)

- **Potentiel** : niveau maximum atteignable (caché, révélé progressivement par scouting)
- **Ambition** : motivation à progresser, à demander un transfert, à viser un grand club
- **Déterminisme** : capacité à se relever après un échec
- **Adaptabilité** : capacité à changer de poste / culture de club
- **Loyauté** : tendance à rester ou à partir au moindre désaccord

---

## F. Génération procédurale (jeunes / inconnus)

Pour le MVP, les joueurs Top 14 actuels sont saisis manuellement. Les jeunes du centre de formation (post-MVP) seront générés procéduralement.

Algo de génération à concevoir :
- Distribution réaliste des potentiels (peu de cracks, beaucoup de moyens)
- Cohérence morpho-poste (un pilier n'est pas un ailier)
- Identité régionale (un Toulousain n'est pas un Rochelais)
