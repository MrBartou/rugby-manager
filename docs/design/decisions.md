# Journal des décisions de design

> Format : `[DATE] — [SECTION] — Décision — Raison — Alternatives écartées`
>
> Pourquoi ce journal : dans 6 mois, quand on regardera un choix bizarre dans le code, on doit pouvoir retrouver *pourquoi* on a choisi ça à l'époque. C'est l'équivalent design des ADR (Architecture Decision Records).

---

## 2026-05-08 — Vision et concept — Vision validée

**Décision :** le projet est un manager rugby qui combine deux moteurs de retour (Moteur A = match qui arrive, Moteur B = histoires humaines en cours).

**Raison :** aucun concurrent ne combine les deux. C'est l'espace blanc identifié.

**Alternatives écartées :**
- Faire un PRM-like riche en fonctionnalités survolées → trop de surface, pas assez de profondeur
- Faire un FM-like centré uniquement sur les matchs → moteur B faible chez FM, on ne ferait que reproduire un défaut
- Faire un mobile F2P → opposition stratégique au modèle prédateur

---

## 2026-05-08 — Stratégie — Pas de licence officielle en v1

**Décision :** v1 sans licence Top 14 / Pro D2 ; outils communautaires d'édition de noms à la FM.

**Raison :** coût d'acquisition de licence prohibitif pour une v1 ; les mods communautaires ont prouvé leur efficacité chez FM ; licence à viser pour v2 si succès.

**Alternatives écartées :**
- Licence officielle dès la v1 → trop coûteux, risque financier
- Noms 100% fictifs sans outils mod → frustrant pour les fans

---

## 2026-05-08 — GDD / MVP — MVP étroit (1 club, 1 saison)

**Décision :** la v1 sera étroite — 1 club au choix dans le Top 14, 1 saison jouable, matchs interactifs, système humain v0 (5-6 traits + mood + 5-10 events). Pas de transferts jouables, pas de centre de formation, pas de sélections internationales, pas de Pro D2.

**Raison :** prouver les deux moteurs de retour (match + histoires humaines) sur le périmètre le plus étroit possible. Cohérent avec la stratégie "ne pas viser un PRM-like riche en fonctionnalités survolées". Estimé ~6 mois solo.

**Alternatives écartées :**
- Top 14 complet avec transferts → trop de surface pour une v1 (12 mois +)
- Top 14 + Pro D2 + multi-saisons + formation → ambitieux, scope creep garanti (18-24 mois)

**Implications :**
- La saison du club du joueur est jouable, mais les 13 autres clubs jouent en arrière-plan (simulés). Leurs résultats existent, leurs joueurs aussi.
- Les transferts d'arrière-plan existent (sinon le marché est figé) mais ne sont pas une mécanique jouable côté joueur en v1.
- Le centre de formation peut exister comme "stat de réputation" du club mais pas comme système jouable.

---

## 2026-05-08 — Moteur de match — Visualisation 2D top-down stylisée

**Décision :** le match sera visualisé en 2D vue de dessus, stylisé non-photoréaliste (référence : Motorsport Manager).

**Raison :**
- Cohérent avec le pilier 1 (modélisation rugby-spécifique : on *voit* la conquête, le momentum, le pack qui avance)
- Bon ratio coût/impact (beaucoup moins cher qu'un faux-3D moyen)
- Lisibilité maximale, c'est l'argument anti-FM
- Permet de représenter formations, lignes, fatigue collective

**Alternatives écartées :**
- Texte commenté + stats live (OOTP-style) → aride visuellement, contraire au pilier 3 (UI moderne)
- 2D côté avec animations → trop coûteux, risque faux-3D moyen
- Hybride 2D + zooms textuels narratifs → à reconsidérer post-v1 pour les temps forts

**Implications :**
- Choix d'un moteur de rendu 2D côté frontend (Canvas / SVG / WebGL via PixiJS si Tauri+React)
- Style visuel à définir avec un designer (mood board section 10)
- Animation des phases de jeu (mêlée, ruck, course) à concevoir comme des micro-states visuels lisibles

---

## 2026-05-08 — GDD / Boucle hebdo — 5 jours actifs par semaine

**Décision :** 5 jours interactifs par semaine de jeu (Lun, Mar, Jeu, Ven, Sam) + 2 jours auto-résumés (Mer, Dim).

**Raison :** équilibre entre immersion (5 jours = vrai rythme de pro) et accessibilité (pas tous les jours interactifs, le joueur peut respirer). Suffisant pour générer ≥1 événement humain significatif par semaine.

**Alternatives écartées :**
- 3 jours actifs → trop léger, sentiment de survol
- 7 jours interactifs → épuisant sur 26 journées Top 14, risque burn-out joueur

**Implications :**
- Les jours "auto" (mercredi, dimanche) peuvent quand même générer des notifications passives (récupération joueur, avis staff) sans imposer une action
- 5 points d'entrée hebdomadaires pour le système humain → suffisant pour faire vivre 3-5 fils narratifs en parallèle
- Boucle de 26 journées + finales = 26-30 cycles de 5 jours actifs par saison ≈ 130-150 sessions actives

---

## 2026-05-08 — Moteur de match — 5-15 live moments par match (variable)

**Décision :** entre 5 et 15 live decision moments par match, calibrés selon l'enjeu (5-7 pour un match de routine, 10-15 pour un derby/finale).

**Raison :** référence directe Motorsport Manager (mécanique M1 du doc fondateur). Évite la passivité ET le clic-fest. Récompense l'engagement émotionnel pour les gros matchs.

**Alternatives écartées :**
- 3-5 fixes → trop peu, sentiment de passivité
- 15+ fixes → clic-spam, le moteur de simulation devient secondaire

**Implications :**
- Système de calibrage des moments à concevoir : déclencheurs basés sur le score, le timing, l'état des cadres
- Chaque moment doit être *signifiant* (impact réel sur la suite du match) sinon il devient bruit
- Les types de moments à concevoir : changement, consigne mi-temps, contestation, time-out tactique, focus joueur en difficulté

---

## 2026-05-08 — Moteur de match — Granularité par phase de jeu

**Décision :** la simulation se fait phase par phase (~75 phases par match), pas par minute ni par action individuelle.

**Raison :** cohérent avec la structure rugby (mêlée → lancement → ruck → phase de jeu → conclusion). Permet de modéliser proprement les sous-systèmes (mêlée, touche, ruck, jeu courant, jeu au pied) comme entités distinctes et testables.

**Alternatives écartées :**
- Par minute → ne respecte pas la structure du rugby (les phases ont des durées variables)
- Par action individuelle → overkill, lourd en CPU et en complexité, gain marginal

**Implications architecturales :**
- Le moteur produit une **séquence d'événements typés** (pas un état global qui évolue par tick)
- Chaque événement a une durée variable
- L'UI consomme ce flux pour produire l'animation 2D top-down
- Tests unitaires possibles par sous-système (testabilité ✓)
- Simulation très rapide (~75 events vs 80 ticks vs 1000+ actions) → 10 000 matchs en CI réaliste

---

## 2026-05-08 — Système humain — 5-6 traits combinés par joueur

**Décision :** chaque joueur possède 5-6 traits de personnalité combinés (modèle CK3).

**Raison :** équilibre lisibilité / profondeur. Permet des combinaisons riches ("Ambitieux + Rancunier + Charismatique + Leader naturel + Fragile mentalement") sans noyer le joueur sur un effectif de 30+.

**Alternatives écartées :**
- 3-4 traits → tous les joueurs finissent par se ressembler, insuffisant pour faire émerger des histoires distinctives
- 7-10 traits (CK3-style) → cognitive overload, le joueur ne peut plus suivre

**Implications :**
- Pool de traits à concevoir : ~30-50 traits possibles, dont certains exclusifs entre eux ("Leader naturel" vs "Suiveur")
- Catégorisation : traits *durs* (caractère stable) vs *doux* (peuvent évoluer avec l'expérience)
- Affichage UI : visible mais pas dominant (chips/badges sur la fiche joueur)

---

## 2026-05-08 — Modèle joueur — Échelle hybride affichée

**Décision :** stats stockées en backend sur 0-100 (granulaire) + affichage UI en barres + lettres (S / A / B / C / D).

**Raison :** précision pour le moteur de simulation, lisibilité pour le joueur. C'est la stratégie réelle de FM (échelle 1-20 affichée mais beaucoup plus précise en interne). Cohérent avec le pilier 3 (anti-spreadsheet, "visualisation avant tableaux Excel").

**Alternatives écartées :**
- 1-20 FM-style → familier mais granularité limitée, et très "spreadsheet"
- 0-100 affiché → invite à comparer au pourcent près, piège spreadsheet
- Lettres uniquement → perte de granularité pour le moteur (50 niveaux écrasés en 5)

**Implications :**
- Mapping S/A/B/C/D ≈ 90-100 / 75-89 / 55-74 / 35-54 / 0-34 (à affiner)
- Barres UI utilisent les 0-100 pour la précision visuelle
- Les attributs cachés (potentiel, ambition) suivent la même échelle mais ne sont pas affichés directement → révélés progressivement par le scouting (M3)

---

## 2026-05-08 — Système humain — 3-5 fils narratifs actifs en permanence

**Décision :** le design garantit que le joueur a en permanence 3 à 5 fils humains ouverts (jeune qui monte, cadre qui peut craquer, tension entre deux joueurs, demande de transfert qui couve...).

**Raison :** cible mentionnée dans le doc fondateur. Suffisant pour toujours avoir quelque chose d'ouvert sans noyer le joueur. Garantit le test "pourquoi tu joues encore une heure ?".

**Alternatives écartées :**
- 1-2 fils → vide narratif si un fil ferme
- 6-10 fils → paralysie décisionnelle, sentiment d'être dépassé
- Variable selon état du club → plus réaliste mais difficile à calibrer pour garantir le minimum

**Implications :**
- Système de "fil watchdog" : si le compteur tombe sous 3 fils ouverts, le moteur d'événements doit en générer un nouveau dans les 1-2 semaines de jeu
- Chaque fil a un cycle de vie : ouverture (déclencheur) → développement (interactions) → résolution (positive / négative / suspendue)
- Affichage UI : dashboard d'accueil avec les 3-5 fils actifs en permanence, plus le prochain match

---

## 2026-05-08 — Modèle joueur — 3 catégories d'attributs + spécifiques poste

**Décision :** les attributs sont structurés en 3 grandes catégories (Techniques / Physiques / Mentaux) + sub-stats spécifiques par poste (poussée mêlée pour piliers, qualité de lancer pour talonneurs, etc.).

**Raison :** lisible, complet, et respecte la spécificité rugby-poste centrale au pilier 1 ("la mêlée est un duel technique, pas un coin flip").

**Alternatives écartées :**
- 3 catégories sans spécifiques → perd la spécificité rugby
- 5 catégories (+ identité + réputation) → cognitive overload, identité peut être déduite des traits

**Implications :**
- Une fiche joueur affiche ~10-15 attributs principaux + 3-5 sub-stats spécifiques au poste
- L'attribut "spécifique poste" peut être amené à évoluer si le joueur change de poste (rare mais possible)

---

## 2026-05-08 — Système humain — Mood à 6-8 sources

**Décision :** le mood d'un joueur est calculé en continu à partir de 6-8 sources principales : forme, résultats récents, statut équipe, relations clés, contrat, fatigue, reconnaissance, vie privée.

**Raison :** équilibre profondeur/lisibilité. Le joueur peut comprendre pourquoi un mood baisse (top 3 modificateurs actifs affichés).

**Alternatives écartées :**
- 4-5 sources → tous les joueurs bougent ensemble, perd le côté unique
- 10+ sources RimWorld-style → obscur, dur à débugger pour le joueur
- Trait-driven → reporté post-v0, à considérer pour v1 (les traits modulent l'impact des sources)

**Implications :**
- Système de modificateurs typés avec durée (permanent / temporaire)
- Affichage UI obligatoire : "pourquoi ce joueur va mal" doit être lisible en 1 clic
- Test : un joueur de l'effectif doit avoir un mood "intéressant" en permanence (très haut ou très bas) pour nourrir le pilier 2

---

## 2026-05-08 — Système humain — Événements v0 : Décisions managériales + Vie de vestiaire

**Décision :** les types d'événements humains émergents prioritaires pour la v0 sont les **décisions managériales** (demandes personnelles : titularisation/contrat/transfert + conflits avec staff) et la **vie de vestiaire** (tensions entre joueurs + mentor/élève).

**Raison :** ces deux groupes couvrent le cœur du Moteur B (le manager arbitre les choix humains) et l'arrière-plan vivant du vestiaire (transmission, rivalités). Les autres groupes (vulnérabilité/crises, événements positifs) sont reportés post-v1.

**Alternatives écartées :**
- Tous les groupes inclus → trop ambitieux pour v0
- Décisions seules → vestiaire trop creux, manque le "vrai groupe humain" du pilier 2
- Vie de vestiaire seule → manque le levier décisionnel central pour le manager

**Implications — types d'événements à concevoir (5-10 cibles) :**
1. Demande de titularisation (joueur réserve qui veut une place)
2. Demande de nouveau contrat / prolongation
3. Demande de transfert (plus haute place ou autre projet)
4. Conflit tactique avec le staff (désaccord sur consigne)
5. Conflit de poste avec le staff (joueur veut un autre poste)
6. Tension/rivalité entre deux joueurs (poste / personnalité)
7. Demande de leadership (capitanat, leader d'attaque/défense)
8. Mentor propose de prendre un jeune sous son aile (positif)
9. Mentor refuse de transmettre (négatif, conflit générationnel)
10. Jeune réussi/raté son intégration (suite mentor/élève)

**Reportés post-v1 :** crises de confiance individuelles, incidents externes (presse/réseaux), événements positifs (anniversaires, hommages).

---

## 2026-05-08 — Système humain — Graphe de relations : échelle continue + types

**Décision :** chaque paire de joueurs a un score numérique de -100 à +100 + un type optionnel (mentor / rival / ami / neutre / conflit).

**Raison :** richesse maximale (transitions fines, mémoire des conflits passés à la Frostpunk M11) sans coût CPU significatif. 30 joueurs = 435 paires max, négligeable.

**Alternatives écartées :**
- 5 niveaux fixes → manque de granularité pour les transitions
- Catégories typées seulement → binaire, perd les nuances
- Trait-driven → léger mais perd la persistance des conflits passés

**Implications :**
- Stockage lazy (uniquement paires non-neutres) → ~50-100 paires actives en pratique
- Les scores ne reviennent pas naturellement à 0 (mémoire)
- Génération initiale : rivalité par défaut entre joueurs du même poste, affinité entre anciens du club
- Impact direct sur le mood (source 4) et sur les déclencheurs d'événements

---

## 2026-05-08 — Calendrier saisonnier — Réel Top 14

**Décision :** la v1 reproduit le calendrier réel du Top 14 — 26 journées de phase régulière (septembre-mai) + 4 trêves internationales (novembre + 6 Nations) + barrages + demi-finales + finale.

**Raison :** authenticité pour les fans, structure les fils humains autour des moments clés (drame "qui part avec les Bleus", remontée en charge post-trêve), justifie variations de calibrage live moments selon enjeu.

**Alternatives écartées :**
- Simplifié 22 journées sans trêves → perd le drame des trêves internationales
- Hybride durées ajustées → reporté en v1 si tests utilisateurs montrent un besoin d'accélération

**Implications :**
- Coupe d'Europe HORS-SCOPE MVP (joueurs partent en arrière-plan, on subit)
- Notifications spéciales pré-trêve ("qui part avec les Bleus")
- Calibrage live moments différencié : barrages/finale = 10-15 moments, match de routine = 5-7

---

## 2026-05-08 — Stack technique — TypeScript + React + Tauri + SQLite

**Décision :** stack confirmée — Tauri (binaire Rust léger) + TypeScript/React (UI) + SQLite (sauvegardes).

**Raison :**
- Tauri vs Electron : binaire ~10-20 MB vs 150 MB, perf native, idéal solo dev en 2026
- TS + React : écosystème UI riche, productif sur les écrans management (tableaux, fiches joueurs)
- SQLite : sauvegardes simples (1 fichier), requêtes flexibles
- Permet de porter le moteur en Rust plus tard si besoin de perf

**Alternatives écartées :**
- Electron → trop lourd
- Rust pur + web frontend → double charge dev pour un solo
- Godot → bon pour rendu 2D match mais UI management pénible

**Implications :**
- Rendu 2D match : à arbitrer entre PixiJS (recommandé), Canvas natif, SVG
- State management : Zustand ou Jotai (light, no boilerplate)
- Tests : Vitest pour le moteur, Playwright pour l'UI plus tard
- CI GitHub Actions : run de 10 000 matchs simulés à chaque PR

---

## 2026-05-08 — Win conditions — Objectifs adaptés au club choisi

**Décision :** l'objectif sportif de la saison 1 est paramétré selon le tier du club choisi (petit budget = maintien, moyen = top 6, gros = demi-finale ou bouclier).

**Raison :** réaliste, narratif, donne sens au choix initial. Évite les objectifs uniques absurdes (Toulouse "doit se maintenir" ou Castres "doit gagner le bouclier").

**Alternatives écartées :**
- Maintien unique → peu motivant pour les gros clubs
- Top 6 unique → exigeant pour les petits, banal pour les gros
- Bouclier unique → irréaliste pour 50% des clubs

**Implications :**
- Le président (NPC voix) communique l'objectif en pré-saison
- 3 paliers par club : échec / objectif / triomphe
- Échec = risque de licenciement fin de saison ; triomphe = nouvelle confiance
- Tier du club déterminé en partie par le budget réel + réputation initiale

---

## 2026-05-08 — Staff — Composition riche (7-8 NPCs voix)

**Décision :** 8 staff NPCs avec voix (M12) : entraîneur en chef + adjoint avants + adjoint 3/4 + médecin + préparateur mental + entraîneur skills + scout principal + président.

**Raison :** richesse de perspectives (sport / santé / mental / business). Chaque voix peut avoir un trait propre (Optimiste / Anxieux / Discipliné...) qui module ses prises de position.

**⚠️ Risque identifié :** "voix qui débattent" peut devenir cacophonie. Mitigation : une voix s'exprime *seulement quand pertinent*, pas toutes en même temps. UI à concevoir avec ce contrainte.

**Alternatives écartées :**
- 3 staff (minimum) → perd la spécialisation pilier 1 (mêlée comme duel technique)
- 5 staff (équilibré) → couvre les biais clés mais moins riche

**Implications :**
- 8 personnalités à designer en pré-prod
- Système de "déclencheurs" pour décider quelle voix intervient quand
- Conflits explicites entre voix (médecin vs adjoint avants sur blessé qui veut jouer)

---

## 2026-05-08 — Approche dev — Vertical slice prioritaire

**Décision :** la construction du MVP suit un vertical slice : 1) proto Excel du moteur, 2) 1 match jouable bout en bout (data → moteur → UI), 3) validation fun, 4) extension horizontale (semaine, humain, saison).

**Raison :** prouver le fun avant l'archi. Anti-pattern dev classique = coder une archi propre puis découvrir que le jeu n'est pas fun. Le slice livre une preuve testable très tôt (mois 2-3).

**Alternatives écartées :**
- Bottom-up (data → moteur → UI) → on découvre les problèmes UI tard
- Top-down UI-first → on simule sans moteur trop longtemps
- Itératif par feature → context switch lourd, livraisons partielles peu testables

**Implications :**
- V0.1 = proto Excel (mois 1-2)
- V0.2 = vertical slice "1 match jouable" (mois 2-4)
- V0.3-V0.4-V0.5 = extension horizontale (mois 4-11)
- V1.0 = release après bêta (mois 13-15 estimé)
- Estimation à multiplier par 4 pour premier jeu (vs 2-3 doc fondateur) → **15-18 mois solo temps plein**

---

## 2026-05-08 — Tactique — 3 niveaux (philosophie + plan pré-match + ajustements live)

**Décision :** la tactique en MVP comporte 3 niveaux : philosophie globale du club (jeu d'avants / grand écart / mixte / défense de fer), plan de jeu pré-match (occupation, défense, lancements), ajustements live (via les 5-15 moments).

**Raison :** équilibre profondeur/lisibilité. Cohérent avec pilier 1 (les décisions tactiques pèsent réellement). Permet aux casual de jouer la philosophie + ajustements live, et aux hardcore de plonger dans les lancements.

**Alternatives écartées :**
- Simple (philosophie seule) → pilier 1 devient creux
- Riche (5 niveaux) → trop lourd en MVP, lancements individuels reportés

**Implications :**
- Catalogue de lancements à concevoir (sur mêlée, touche, ballon porté, turnover)
- Identité du club détermine les lancements préférés / interdits
- Changer la philosophie coûte en cohésion (pilier 4)

---

## 2026-05-08 — Moteur match V0.1 — Tous sous-systèmes en parallèle simplifiés

**Décision :** le proto Excel V0.1 modélise tous les sous-systèmes (mêlée, touche, jeu courant, ruck, jeu au pied, fautes) en version simplifiée — probabilités plates, score combiné. Approfondissement progressif post-V0.1.

**⚠️ Risque identifié :** si on reste en V0.1 simplifié, la mêlée finit en coin flip — anti-pilier 1. **Mitigation** : V0.2 = approfondissement de la mêlée en premier (modèle duel technique + gainage + sanctions) avant les autres.

**Raison choisie :** approche end-to-end avant deepening. Permet de valider le pipeline complet (data → moteur → résumé) rapidement, puis d'investir profondeur sur les sous-systèmes critiques.

**Alternatives écartées :**
- Mêlée d'abord → meilleur respect du pilier 1 mais bloque le slice complet
- Jeu courant d'abord → volume mais peu discriminant
- Jeu au pied d'abord → dépend du modèle positionnement

**Implications :**
- Roadmap V0.1 (proto Excel) : 1-2 semaines pour modéliser les 6 sous-systèmes simplifiés
- Roadmap V0.2 : mêlée approfondie (priorité absolue post-slice)
- Critères validation V0.1 : 4-6 essais/match, 60-70% pénalités, ~75 phases

---

## 2026-05-08 — UI/UX — 4 écrans prioritaires pour le vertical slice

**Décision :** les 4 écrans MVP sont tous prioritaires : (1) Écran match live + résumé, (2) Dashboard + Calendrier, (3) Fiche joueur + Vestiaire, (4) Composition + Tactique pré-match.

**Raison :** chacun couvre une dimension essentielle du gameplay :
- (1) cœur du vertical slice (test du fun)
- (2) test "pourquoi tu joues encore" + entrée/sortie de session
- (3) cœur du pilier 2 (vie de vestiaire)
- (4) préparation, lien vers les 3 niveaux tactiques

**Implications :**
- 4 wireframes complets à produire (Figma ou Excalidraw)
- Charge UI pour V0.2-V0.3 plus lourde que prévu initialement
- Possibilité de simplifier la fiche joueur en V0.2 (juste attributs + traits) puis enrichir en V0.4 (mood + relations) si timeline serre

---

## 2026-05-08 — Architecture / Online — Stratégie hybride : v1 solo, v2 online

**Décision :** la v1 reste solo desktop (Tauri + SQLite), mais l'architecture logicielle est conçue dès la v1 pour permettre l'ajout d'un mode online en v2 sans refactor du gameplay.

**Raison :** balance entre risque scope (online v1 = +12 mois solo) et préservation de l'option (online est une vraie valeur ajoutée long terme). Le path FM/OOTP/Motorsport Manager : on prouve d'abord le solo, on ajoute le multi avec les revenus de v1.

**Alternatives écartées :**
- Online natif v1 → +24-30 mois solo, risque trop élevé pour un premier jeu
- Solo v1 sans préparation → refactor douloureux à v2, on jette du code
- Web app v1 + multi → perd le binaire Steam (canal principal fans manager)

**Disciplines architecturales obligatoires en v1 (pour ne pas se bloquer) :**

1. **Moteur de match = fonction pure** : signature `(état, décisions, seed) → état'`. Aucun side-effect, aucune dépendance SQLite. Permet de l'exécuter côté serveur en v2.

2. **Repository pattern** : interface `GameRepository` (abstraction). Implémentation v1 = `LocalSQLiteRepository`. Implémentation v2 = `RemoteAPIRepository`. Aucun appel SQLite direct dans la logique métier.

3. **Event sourcing** : l'état du jeu est dérivé d'une séquence d'événements typés (`SeasonStarted`, `MatchScheduled`, `PlayerInjured`, `MatchPhasePlayed`, etc.). Permet replay, sync serveur, debugging.

4. **Format save = JSON exportable** : le `.save` est sérialisable en JSON pur. Préfigure le cloud sync de v2 (upload/download d'une saison).

5. **Pas de logique métier dans l'UI** : la UI React consomme uniquement des données et émet des intentions. Toute la logique vit dans le moteur (testable, portable).

6. **Determinisme** : tous les RNG passent par un seed explicite. Permet de rejouer une saison côté serveur en v2 et obtenir le même résultat.

**Coût en v1 :** ~10-20% de discipline supplémentaire en code. Compensé par la testabilité (le moteur pur se teste sans monter SQLite).

---

## 2026-05-08 — Mode ligue v2 — Format mixte humain + IA

**Décision :** le mode ligue v2 sera mixte : 1-3 humains dans une ligue de 14, le reste IA. Pas de "ligue full humain" en v2 (reportée v3 si demande).

**Raison :** plus facile à lancer (pas besoin de coordonner 14 potes pour démarrer une ligue). Chaque ligue a son calendrier, ses humains. Le serveur simule les IA et les matchs IA vs humain. Les matchs humain vs humain attendent la préparation des deux managers (async).

**Alternatives écartées :**
- Ligue ferme 8-14 humains async → exige coordination forte, lent à démarrer
- Multivers de ligues parallèles → trop d'ops pour une v2
- Solo + cloud save partageable → pas de vrai drama humain

**Implications :**
- Une "ligue" = une instance d'univers sur le serveur (`league_id`)
- Chaque humain rejoint une ligue avec un slot libre (pendant les inscriptions)
- Le serveur tient l'horloge de la ligue (calendrier avance ensemble)
- Quand 2 humains s'affrontent : 48h pour préparer, sinon défaut au préparateur le plus complet
- Anti-cheat naturel : le serveur simule autoritativement les matchs

---

## 2026-05-08 — Online — Timing v2 (post-release v1)

**Décision :** le mode online est un objectif v2, pas v1. v1 ship en solo pur d'abord.

**Raison :** ne pas faire dépendre le first ship d'une compétence ops/backend. Permet de prouver le marché solo avant d'investir dans le serveur (50-200€/mois récurrent + dev time).

**Implications roadmap :**
- v1.0 (mois 13-15) : solo Tauri+SQLite, archi prête pour online
- v2.0 (mois 18-24+) : ajout backend, mode ligue mixte humain+IA
- Communication marketing v1 : "online à venir en v2" — promesse soft, pas un engagement de date

---

## 2026-05-08 — JIFF — Mécanique complète intégrée

**Décision :** JIFF est une mécanique de gameplay complète : compteur visible en permanence (effectif + feuille de match), pénalités si non-respect (~16 JIFF minimum déclarés en Top 14), impact stratégique sur le recrutement.

**Raison :** cohérent avec pilier 4 (identité française et Top 14 au cœur du jeu). C'est le différenciant central vs FM ("ce que les anglos n'ont jamais fait"). Sacrifier JIFF en MVP = manager NBA sans salary cap.

**Alternatives écartées :**
- Info seulement → perd la pression stratégique réelle
- Hors scope MVP → sacrifie un pilier
- Hybride objectif optionnel → reporté en mode défi post-v1

**Implications :**
- Compteur JIFF en header de chaque écran (effectif, composition, transferts)
- Le statut JIFF d'un joueur = un attribut binaire stocké en DB
- Pénalités modélisées : amendes sportives + interdiction de match si insuffisant
- Impact recrutement : recruter un non-JIFF de talent égal coûte plus cher en mood (président pousse pour JIFF)

---

## 2026-05-08 — Blessures — 5-6 types réalistes

**Décision :** système de blessures avec 5-6 types et durées variables :
- **Musculaire** (déchirure, élongation) : 1-3 semaines, faible séquelle
- **Ligamentaire** (entorse, croisé) : 4-12 semaines, séquelle possible
- **Commotion cérébrale** : 3-6 semaines, protocole retour progressif obligatoire
- **Fracture** (côtes, bras, jambe) : 8-24 semaines, séquelle rare mais possible
- **Coup / hématome** : 1-7 jours, pas de séquelle
- **Chronique / récidive** : indique un "joueur de verre", probabilité accrue de re-blessure

**Raison :** crédibilité pour les fans hardcore. Permet des arbitrages tactiques (commotion = retour progressif délicat, fracture = retour direct mais long).

**Alternatives écartées :**
- Simple "blessé X semaines" → trop pauvre, perd les arbitrages
- 10+ types détaillés → lourd, post-v1

**Implications :**
- Le médecin (NPC voix) intervient différemment selon le type
- Concept "joueur de verre" (trait dur) = susceptibilité aux récidives
- Mood baisse spéciale longue blessure (frustration, peur du retour)
- Calcul probabilité par session entraînement + match (charge x susceptibilité)

---

## 2026-05-08 — Données joueurs initiales — Scraping sources publiques ⚠️ JURIDIQUE

**Décision provisoire :** scraper rugby-club.fr, Wikipedia, et autres sources publiques pour constituer la base initiale des ~400 joueurs Top 14.

**⚠️ Drapeau rouge juridique :** cette stratégie est gris foncé :
- **Terms of service** des sites scrapés (souvent l'interdisent)
- **Droit sui generis sur les bases de données** (UE, directive 96/9/CE) — la donnée *agrégée* peut être protégée même si chaque fait individuel ne l'est pas
- **Droit à l'image et droits voisins** sur les noms/perfs des joueurs
- **Le scraping est OK pour l'usage personnel/recherche**, mais pas évident pour un jeu commercial qui rediffuse les données

**Cohabitation avec la décision licence officielle (déjà flaggée) :**
- Si licence LNR acquise → les données viendront du contrat de licence, pas du scraping. Le scraping n'a alors d'utilité que pour le développement initial avant signature.
- Si licence abandonnée → scraping reste juridiquement risqué, et il faut basculer sur la stratégie hybride (manuel pour clubs/postes/âges + procédural pour les stats).

**Plan B suggéré :**
- v0 développement : scraping pour avoir un dataset de base (usage interne, non-distribué)
- v1 release : soit licence acquise (dataset officiel), soit on régénère les stats procéduralement par-dessus les noms saisis manuellement, soit on utilise un mod communautaire à la FM (le jeu ship avec des noms fictifs proches, les fans publient des packs)

**Alternatives écartées :**
- 100% manuel → 3-6 semaines de travail, subjectif
- 100% procédural → cohérent stratégie fictifs+mods mais incohérent avec la décision licence

**Action obligatoire :** revisiter ce point avec la décision licence (section 12 juridique). Pas de release avec données scrapées non-licensées.

---

## 2026-05-08 — Distribution — Steam + Itch.io

**Décision :** la v1 est distribuée sur Steam (canal principal, audience fans manager) et Itch.io (canal secondaire, communauté indé).

**Raison :**
- Steam = audience où vivent les fans de FM/OOTP/Motorsport Manager. Fonctionnalités utiles (Workshop pour mods communautaires de noms à la FM, Cloud, succès, reviews).
- Itch.io = filet de sécurité (pas de cut, autonomie de pricing, communauté indé) + canal de bêta payante avant Steam.
- Diversification = robustesse (si Steam ban, dépublie, etc.).

**Alternatives écartées :**
- Steam exclusif → dépendance totale + 30% de cut
- Steam + Itch + GOG → GOG sélectif, charge maintenance triplée
- Direct download → marketing 100% à charge, risqué pour un premier jeu

**Implications :**
- Compte développeur Steam (100$ Steam Direct fee) à créer post-V0.5
- Page Steam Coming Soon à monter dès la bêta privée pour collecter des wishlists
- Build Itch.io plus permissif (versions early access plus fréquentes)
- Tauri auto-updater pour les patchs hors Steam (early access Itch)

---

## 2026-05-08 — Critères release v1 — Indéfinis à statuer post-bêta ⚠️ MITIGATION OBLIGATOIRE

**Décision :** les critères "ready to ship v1" ne sont pas figés à l'avance. Ils seront évalués après la bêta privée selon ce qu'on observe.

**⚠️ Risque identifié :** c'est l'option qui mène le plus souvent à ne jamais shipper ("on peut toujours améliorer"). Anti-pattern classique du dev solo perfectionniste. À mitiger absolument.

**Mitigation obligatoire — critères provisoires définis dès maintenant :**

> Ces critères sont une **boussole**, pas un contrat. Ils peuvent être ajustés après bêta, mais ils existent pour ne pas dériver.

1. **MVP fonctionnel** : 1 saison complète jouable bout en bout sans crash bloquant
2. **Test de validation game design** : ≥3 testeurs jouent une saison entière sans abandonner et reviennent demander la suite
3. **Test "pourquoi tu joues encore une heure ?"** : les testeurs peuvent répondre avec une phrase concrète (match ou joueur) en majorité
4. **Stabilité** : 0 bug critique sur les 7 derniers jours de bêta privée
5. **Performance** : 1 saison auto-simulée < 2 minutes sur machine moyenne (i5/16Go)
6. **Coverage moteur** : ≥80% sur `engine/*`
7. **Calibrage moteur** : moyennes 4-6 essais/match, 60-70% pénalités sur 10 000 simulations CI

**Règle d'engagement :** si 6 critères sur 7 sont OK et que la bêta privée est positive sur l'engagement, on ship. On ne court pas après le 7e.

**Alternatives écartées :**
- Critères stricts pré-définis → moins flexible mais plus disciplinant
- Critères laxes → "PRM 2015 effect", non-acceptable
- Critères provisoires + validation collégiale → pas applicable solo

---

## 2026-05-08 — Bêta-test — Privée uniquement, pas d'early access public

**Décision :** bêta privée uniquement (5-10 testeurs proches, gratuit, ~1 mois) puis release direct Steam. Pas de phase early access payante intermédiaire.

**Raison :** plus rapide à shipper. Le user privilégie la vélocité sur la collecte de revenus pré-launch.

**Trade-offs acceptés :**
- ✅ Time-to-release plus court de 1-2 mois
- ❌ Pas de revenus early access pour financer la fin du dev
- ❌ Moins de testeurs externes → plus de risque d'edge cases au launch
- ❌ Pas de "warm-up community" avant le launch

**Mitigation :** la bêta privée doit être **rigoureuse** (≥5 testeurs, ≥1 saison complète chacun, ≥50 matchs joués cumulés). Sinon le risque edge cases au launch est trop élevé.

**Reconsidérer si :** la bêta privée révèle plus de bugs qu'attendu → ouvrir une phase Itch payante avant Steam serait alors une décision sensée à prendre à V0.95.

---

## 2026-05-08 — Tests automatisés — Pyramide complète

**Décision :** stratégie de tests complète :
- **Unit tests** Vitest sur `engine/*` (cible 80%+ coverage)
- **Property-based testing** (fast-check) pour les invariants du moteur
- **Simulation tests** : 10 000 matchs en CI à chaque PR, vérification des distributions
- **Tests d'intégration** : flow `LocalSQLiteRepository` mocké
- **E2E UI** (Playwright) sur les 4 écrans MVP, V0.5+

**Raison :** investment lourd au début (~1-2 semaines de setup), mais payoff massif :
- Refactors sans peur (essentiel pour les disciplines architecturales v1→v2)
- Détection de régression sur les distributions stats
- Confiance dans les saves entre versions

**Alternatives écartées :**
- Unit + simulation seulement → on rate les bugs UI
- Tests minimaux → refactors deviennent impossibles à valider en confiance

**Implications :**
- CI GitHub Actions configurée dès le commit 1 (run unit + 1 000 matchs)
- 10 000 matchs en CI à chaque PR uniquement (CI standard reste rapide)
- Property-based pour : score cohérent, pas de stats négatives, somme essais = bonne, etc.

---

## 2026-05-08 — Stratégie noms — Licence officielle Top 14 ⚠️ À RECONFIRMER

**Décision provisoire :** acquisition de la licence officielle LNR (Top 14 + Pro D2) + droits à l'image joueurs.

**⚠️ Drapeau rouge :** cette décision contredit explicitement la stratégie initiale du doc fondateur ("Ne pas se ruiner en licences en v1 — Licence officielle à viser pour v2 si succès"). À reconfirmer après évaluation du budget réel et des contacts disponibles.

**Implications si maintenu :**
- Coût estimé : 6 chiffres minimum sur 3-5 ans
- Délai de négociation : 6-12 mois — décale la v1 d'autant ou impose un développement spéculatif
- Risque binaire : si la négo échoue, tout le marketing s'effondre — plan B obligatoire
- Précédent à éviter : Pro Rugby Manager 2015 a sorti un produit non fini parce que la licence a mangé le budget de dev

**Plan B suggéré (à valider) :**
- v1 : noms fictifs proches du réel + outils mod communautaires (à la FM)
- Si v1 marche commercialement : négociation licence en position de force pour v1.5 ou v2

**Alternatives à reconsidérer :**
- Fictifs + mods communautaires (stratégie FM/OOTP, validée 20 ans)
- 100% fictifs sans mods (frustrant pour fans)
- Hybride clubs réels + joueurs fictifs (complexe à négocier)

**Action :** revisiter ce point quand le budget v1 sera chiffré (section 13 — Gestion de projet).

---

## 2026-05-08 — Boucle hebdomadaire — 5 jours actifs

**Décision :** la semaine type comporte 5 jours interactifs (Lundi, Mardi, Mercredi, Jeudi, Samedi) et 2 jours auto-gérés (Vendredi, Dimanche).

**Raison :** équilibre entre immersion (le joueur sent le rythme d'une semaine de club pro) et accessibilité (mode auto possible). Concentre les événements humains sur Lundi-Mercredi pour laisser la fin de semaine au focus tactique.

**Alternatives écartées :**
- 3 jours actifs (entraînement x2 + match) → trop léger pour porter le pilier 2 (vie de vestiaire)
- 7 jours interactifs → risque d'épuisement sur 26 journées + coupes

**Risque identifié :** la répétition sur 26+ semaines. Mitigation : événements émergents, presse contextuelle, variations selon importance du match.

---

## 2026-05-08 — Moteur de match — 5-15 live moments par match

**Décision :** entre 5 et 15 décisions live par match, calibrés selon l'importance.

**Raison :** référence directe Motorsport Manager (mécanique M1 du doc fondateur). Évite la passivité ET le clic-fest. Cohérent avec le pilier 1.

**Précisions :**
- Match de routine : 5-7 moments
- Derby / match-clé / finale : 10-15 moments
- Chaque moment doit être signifiant (impact réel sur la suite du match)

**Alternatives écartées :**
- 3-5 moments fixes → risque de passivité entre les moments
- 15+ systématiques → clic-fest, dilue l'impact de chaque décision

---

## 2026-05-08 — Moteur de match — Granularité : par phase de jeu

**Décision :** la simulation se fait phase par phase (mêlée, lancement, ruck, course, pénalité, jeu au pied…), pas par minute ni par action individuelle.

**Raison :**
- Cohérent avec le pilier 1 (la trame du rugby est la phase, pas le tick de temps)
- Permet de modéliser proprement chaque sous-système comme entité distincte et testable en isolation
- Volume cible ~75 phases/match : crédible, gérable en CPU, animable

**Alternatives écartées :**
- Par minute (FM-style, 80 ticks) → ne reflète pas la structure rugby
- Par action individuelle (chaque passe simulée) → overkill pour le MVP, complexité algorithmique élevée

**Implications architecturales :**
- Le moteur produit une séquence d'événements typés
- Chaque événement a une durée variable
- L'UI consomme ce flux pour produire l'animation 2D
- Tests unitaires possibles par sous-système
