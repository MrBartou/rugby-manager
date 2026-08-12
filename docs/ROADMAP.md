# Roadmap — de V0.60 à la V1.0 et au-delà

> Établie le 2026-08-12 à partir d'un audit complet du code (V0.58, 1172 tests verts).
> Décalée d'un cran le 2026-08-12 : la V0.59 a été prise par « La mémoire longue »
> (registre de carrière, banc du XV de France), livrée hors roadmap. Les fondations
> décrites ici deviennent donc la V0.60, et tout le reste suit.
>
> Trois familles de chantiers : **fondations** (bugs qui cassent la carrière longue),
> **rattrapage FM** (les systèmes attendus d'un manager), **différenciation**
> (ce que ni FM ni personne n'a). Chaque version a un thème, comme depuis V0.13.

## Vue d'ensemble

| Version | Thème | Famille | Taille estimée |
|---|---|---|---|
| V0.60 | Fondations — le monde tient 20 saisons | Fondations | L |
| V0.61 | La donnée parle — notes, classements, stats | Rattrapage | M |
| V0.62 | Réglages, accessibilité, délégation | Expérience | S/M |
| V0.63 | Le monde s'élargit — Europe persistante | Rattrapage | L |
| V0.64 | Le mercato mûrit — clauses, primes, agents | Rattrapage | L |
| V0.65 | Le playbook — la touche se dessine | Différenciation | L |
| V0.66 | Le duel d'entraîneurs | Différenciation | L |
| V0.67 | La transmission — moments de carrière | Différenciation | M |
| V0.68 | Le corps du joueur — infirmerie et usure | Différenciation | M |
| V0.69 | Le son et le rythme — ambiance réactive | Expérience | M |
| V0.70 | Le Musée du club — mémoire et fierté | Expérience | M |
| V0.71 | Scénarios et défis | Expérience / Commercial | S |
| V0.72 | Le match respire — TMO, vent, banc stratégique | Différenciation | M |
| V0.73 | Le public et la ville — supporters, ancrage régional | Différenciation | M |
| V0.74 | Les médias vivants — journalistes, rumeurs | Rattrapage / Différenciation | M |
| V0.75 | Le manager grandit — diplômes, style, réseau | Différenciation | M |
| V0.76 | La vie du groupe — 3e mi-temps, objectifs perso | Différenciation | M |
| V0.77 | Reconversion et héritage — les anciens restent | Différenciation | S/M |
| V0.78 | Confort de jeu — palette, presets, skip intelligent | Expérience | S |
| V0.79 | Modes de jeu — Ironman, Dynastie, difficulté | Expérience / Commercial | S/M |
| V0.80 | La pré-saison et les aléas du calendrier | Rattrapage / Différenciation | M |
| V0.81 | La discipline au complet — citations, appels | Différenciation | S/M |
| V0.8x | Éditeur de données et support des mods | Commercial | M |
| V0.9 | Bêta privée | Jalon | — |
| V1.0 | Release Steam / Itch | Jalon | — |
| Post-V1 | Stress du manager, Coupe du monde, tournées… | Différenciation | — |

---

## V0.60 — Fondations : le monde tient 20 saisons

**Objectif : une carrière de 20 saisons sans que le monde se dégrade.** Trois bugs
identifiés à l'audit + la dette d'architecture qui les a produits.

- [ ] **Extraire l'intersaison de `App.tsx` vers le moteur** (`season/rollover.ts` testé).
      ~400 lignes de règles métier (rollover, promo de jeunes, mercato IA,
      montées/descentes, sanctions, chantiers) vivent dans un composant React de
      4455 lignes, en violation de la frontière moteur/UI (`09-architecture-logicielle.md`).
- [ ] **La division non jouée ne se vide plus** : `generateYouthIntake()` et
      `runAiMarket()` tournent sur les deux divisions (bug : `App.tsx:1371` et `:1548`
      itèrent sur la seule division du manager, alors que vieillissement et retraites
      s'appliquent à tout le monde). Retirer le garde-fou `return 50` de `strengthOf()`
      une fois la cause corrigée.
- [ ] **Le temps de jeu réel alimente le moral** : remplacer le ratio factice de
      `playRatioByPlayerForPlayerClub()` (`App.tsx:3418`, 0.85/0.45/0.1 codés en dur)
      par les vraies minutes de `seasonState.seasonPlayerStats`. Impacte : mood,
      verdicts de hiérarchie, pronostics de conversation, agenda, candidats au prêt.
- [ ] **Finances Pro D2 justes** : `REGULAR_ROUNDS = 26` en dur dans `finances.ts`
      alors que la Pro D2 joue 30 journées (4 journées de salaires jamais facturées).
- [ ] **Nettoyage des doublons de vérité** :
  - `StaffMember` défini deux fois (`engine/types.ts` vs `club/staff.ts`) — unifier ;
  - `season/internationals.ts` (V0.8) vs `season/national-team.ts` (V0.58) — purger le premier ;
  - champs morts : `Contract.releaseClause` / `performanceBonus` (réutilisés en V0.64
    ou supprimés), `PreMatchTacticalPlan.targetingStrategy` ;
  - en-tête de `divisions.ts` désynchronisé (décrit encore la Pro D2 à 14 clubs) ;
  - l'écran titre et le header affichent « Alpha V0.10 » — brancher sur la vraie version.
- [ ] **Unifier les deux modèles de billetterie** : le club du joueur utilise
      `matchdayRevenue()` (V0.45) mais les clubs IA restent sur `computeMatchRevenue()`
      (V0.6, billet à 30 € en dur). Deux économies parallèles qui divergent.

### Audit n°2 — classement et phases finales

- [ ] 🔴 **Retrait de points : le classement restauré doit être complet.** Au rollover,
      `App.tsx:1765` ne transmet que les clubs sanctionnés, et `season-session.ts:638`
      remplace alors le classement entier par cette liste partielle → tous les matchs
      de la saison suivante sont ignorés (`applyMatchToStandings` sort si un club
      manque), puis **crash « top 6 incomplet »** à la J27 (`calendar.ts:291`).
      Déclenchable dès qu'un club écope d'un `RETRAIT_POINTS`.
- [ ] **Recharger en phases finales détruit la phase finale** : `playoffMatches` /
      `semifinalMatches` / `finalMatch` sont des closures jamais persistées et non
      reconstruites (`season-session.ts:1541`) → au chargement d'une sauvegarde en
      demies, statut « éliminé », aucun champion. Tout est reconstructible depuis
      `history` (sauvegardé) — régénérer en cascade.
- [ ] **Fin de saison sans champion = saison sans bilan** : tout le verdict (objectif,
      réputation, limogeage, archives) est dans `if (state.champion)` (`App.tsx:1225`).
      Et la finale auto-simulée n'a pas de tie-break (`skipRound`,
      `season-session.ts:1863`) — aucune prolongation nulle part dans le moteur.
- [ ] **Récidive DNCG trop sensible** : `repeatOffender` armé par n'importe quel
      verdict, y compris un simple avertissement JIFF (`App.tsx:1546`) — c'est
      l'accélérateur du bug de retrait de points ci-dessus.

### Audit n°2 — règles contournables

- [ ] **L'auto-simulation ignore trêves internationales et prêts** :
      `MatchSeedOptions` n'a pas de champ `unavailable` (`seed.ts:522`) — simuler la
      journée de trêve aligne vos internationaux partis en sélection. Exploit direct.
- [ ] **Le joker médical ne propose jamais personne** : `season-session.ts:2172`
      filtre `p.freeAgent` sur une liste (`listRoster`) qui exclut déjà les agents
      libres (`seed-browser.ts:80`) — liste toujours vide, fonctionnalité morte.
- [ ] **L'interdiction de recruter ne bloque que les agents libres** : ni les offres
      payantes (`onSubmitBid`), ni le joker médical, ni les prêts ne la testent.
- [ ] **Les prêts sont décoratifs financièrement** : `loanCost`/`wageShare` ne servent
      qu'à l'affichage (`loans.ts:152`), le club paie toujours 100 % du salaire ;
      `loansRef` est vidé (`App.tsx:1395`) avant d'être lu (`App.tsx:1833`) donc
      `onLoan` n'est jamais posé au CareerBook ; et `sendOnLoan` ignore les fenêtres
      de mercato (prêter pendant les barrages est possible).
- [ ] **La compo de secours aligne des blessés/suspendus/retraités** : les replis de
      `pickStartingFifteen` puisent dans la liste brute au lieu de la liste filtrée
      (`seed.ts:344`) ; et l'auto-sim pose **deux brassards** en ignorant votre
      capitaine (`seed.ts:376`).
- [ ] **La proposition du XV de France est quasi inatteignable** : le bloc
      `federationApproaches` est emprisonné dans deux `if` imbriqués (sabbatique +
      limogeage + offre reçue le même jour) (`App.tsx:3398`).

### Audit n°2 — sauvegarde et robustesse

- [ ] 🔴 **Une sauvegarde corrompue efface toutes les parties, définitivement** :
      `readStorage()` avale tout dans un `catch { return { saves: {} } }` puis la
      prochaine écriture réécrit le tout (`season-save-repository.ts:266`). Lecture
      défensive par entrée, erreurs typées affichées, copie de secours avant écrasement.
- [ ] **`QuotaExceededError` non géré à l'écriture** (contrairement à
      `match-save-repository.ts`) — « Échec de la sauvegarde » sans cause ni remède.
- [ ] **`schemaVersion` figé à `0.5.0`** alors que le format a évolué jusqu'en V0.58 :
      la migration ne peut plus rien discriminer, et une sauvegarde d'une version
      future est chargée puis re-tamponnée sans contrôle.
- [ ] **La sauvegarde grossit sans borne** : `playerOverrides` embarque toute la base
      joueurs, retraités conservés à vie compris (`rollover.ts:112`), et `careerBook`
      n'est jamais élagué — le tout sous une seule clé localStorage (~5 Mo de quota).
      Mesurer sur 20 saisons, élaguer/compresser. (`news` et `mailbox` sont, eux,
      correctement plafonnés.)
- [ ] **Aucun ErrorBoundary React** (`main.tsx`) : la moindre exception de rendu est
      une page blanche définitive, sans message ni possibilité de sauvegarder.
- [ ] **État perdu au rechargement** : retouches du groupe France (`nationalPicksRef`,
      absent de la sauvegarde), événements humains en attente de décision, indicateur
      de retrait de points, bancs vacants.

### Audit n°2 — cohérences mineures

- [ ] Phases finales européennes programmées J18/20/22/24 alors que le commentaire
      les annonce « après le championnat » (`european-cup.ts:129`) — trancher.
- [ ] Fenêtres de mercato en journées absolues (J1-J3, J13-J16) : fausses en Pro D2
      à 30 journées (`transfer-window.ts:36`).
- [ ] Barrage d'accession : score clampé après comparaison (« 0-0, maintien »
      possible, `divisions.ts:274`) — et le barrage du club dirigé est résolu par
      tirage, jamais joué (→ V0.80).
- [ ] Promesses sans `catch` : `loadSeason` au clic (`App.tsx:4126`) et la liste des
      sauvegardes du titre (`TitleScreen.tsx:27`).
- [ ] Vérifier que `MAX_PHASES = 250` (`session.ts:157`) couvre toujours 80 minutes.
- [ ] **Dépendances mortes** : `pixi.js` et `zustand` déclarés dans `package.json`,
      jamais importés — retirer (ou décider d'adopter Pixi pour le rendu match).

---

## V0.61 — La donnée parle

**Objectif : montrer la profondeur déjà calculée.** `IndividualMatchStats` capture
13 métriques riches (mètres, franchissements, défenseurs battus, grattages, plaquages
manqués…) exploitées uniquement en agrégats textuels. Le meilleur ratio effort/impact
du rattrapage FM : la donnée existe, il manque l'agrégation et l'UI.

- [ ] **Notes de match par joueur** (sur 10, dérivées des stats individuelles) +
      **homme du match** dans `MatchSummary`
- [ ] **Stats de saison par joueur** : tableau triable (essais, mètres, plaquages,
      minutes…) dans l'effectif et sur la fiche joueur
- [ ] **Classements du championnat** : meilleur marqueur, meilleur réalisateur,
      meilleures notes — onglet dans Compétition
- [ ] **Comparateur de joueurs** (2-3 côte à côte, fourchettes de scouting respectées)
- [ ] **Tout devient cliquable** : noms de joueurs/clubs dans les Actus, lignes du
      classement (→ fiche club : effectif, forme, historique H2H), top salaires des
      Finances (→ fiche joueur)
- [ ] **Fiche club adverse** (nouvel écran léger : palmarès, H2H, effectif visible
      selon scouting)
- [ ] **Shortlist / liste de suivi** distincte des créneaux de scouting, avec alertes
      fin de contrat

---

## V0.62 — Réglages, accessibilité, délégation

**Objectif : le socle expérience joueur.** Aucun écran de réglages n'existe.
Requis pour la bêta de toute façon — et la délégation est le pilier 3 du GDD
(« déléguer à son staff ce qu'on ne veut pas gérer ») jamais implémenté.

- [ ] **Écran Réglages** : vitesse de match par défaut, fréquence d'autosave,
      confirmations, volumes (préparé pour V0.69)
- [ ] **Accessibilité** : `prefers-reduced-motion` (les 32 keyframes + confettis
      tournent pour tout le monde aujourd'hui), taille de texte, palette daltonisme
      (les liserés d'aptitude vert/orange/rouge de la compo sont illisibles pour ~8 %
      des hommes), option thème clair
- [ ] **Délégation au staff** (cases à cocher) : l'adjoint gère les remplacements /
      choisit les focus d'entraînement / répond aux offres mineures / propose la compo.
      Donne une utilité *choisie* au staff, rend le jeu jouable par le casual de la cible
- [ ] **Encyclopédie in-game** : glossaire contextuel (JIFF, salary cap, bonus
      offensif, joker médical, fenêtres) accessible d'un clic depuis chaque écran —
      le pilier 3 (« accessible comme un bon livre ») pour le fan de rugby qui n'a
      jamais joué à un manager

---

## V0.63 — Le monde s'élargit

**Objectif : le monde ne s'arrête plus aux frontières.** 30 clubs, une nation,
zéro transfert international aujourd'hui. Fidèle au choix juridique (pas de licence) :
tout reste procédural mais devient **persistant**.

- [ ] **Clubs européens persistants** : les adversaires de Champions/Challenge Cup
      gardent effectifs, forme et historique d'une saison à l'autre (aujourd'hui
      régénérés, `strength` 40-85)
- [ ] **Marché international fictif** : acheter/vendre vers un pool anglo-celte et
      hémisphère sud procédural — recrues non-JIFF qui rendent le quota JIFF
      réellement structurant
- [ ] **Matchs internationaux simulés par le vrai moteur** (aujourd'hui : score estimé)
      — un international a enfin de vraies performances en sélection, des capes
      racontables, des blessures en bleu qui font mal
- [ ] **Palmarès européen historisé** (vainqueurs par saison)

---

## V0.64 — Le mercato mûrit

**Objectif : la profondeur de négociation d'un FM.** La structure de contrat est
plate (salaire + durée) et l'« agent » n'est qu'un expéditeur de mail.

- [ ] **Clauses réelles** : brancher `releaseClause` (clause libératoire) et
      `performanceBonus` (déclarés dans `Contract`, jamais lus) + primes de match /
      d'essai / de sélection, salaire progressif, option d'année supplémentaire
- [ ] **Pourcentage à la revente** et **paiement échelonné** dans les négociations
      entre clubs
- [ ] **Agents comme acteurs** : commission, relation avec le manager, agent qui
      bloque un deal ou propose un joueur (les « sollicitations d'agents » notées
      non faites depuis V0.43)
- [ ] **Renégociation en cours de contrat** à l'initiative du manager (prolongation,
      revalorisation — reliquat V0.43)
- [ ] **Surenchère concurrentielle** : un club IA peut se positionner sur votre cible
      (hors périmètre depuis V0.6)
- [ ] Pré-contrats à 6 mois de la fin (esprit Bosman), résiliation à l'amiable
- [ ] **Prêt avec option d'achat** (obligatoire ou non), et rappel anticipé d'un
      prêté en cas de crise de blessures

---

## V0.65 — Le playbook : la touche se dessine

**Objectif : différenciation pilier 1 — le fantasme du fan de rugby qu'aucun jeu
n'a servi.** Aujourd'hui les phases arrêtées sont un bonus global, pas un playbook.

- [ ] **Éditeur de combinaisons de touche** : 4-5 combinaisons dessinées et nommées
      par le joueur — alignement (5/7/réduit), sauteur désigné, option (maul / vers
      l'ouvreur / peel)
- [ ] **Les combinaisons se scoutent** : une combinaison surjouée finit lue et
      contrée ; le dossier d'avant-match adverse signale « ils connaissent votre
      fond de touche ». Crée une méta par saison, donne un usage offensif au scouting
- [ ] **Instructions individuelles** au-delà des 19 rôles : marquage d'un joueur
      adverse, consignes au pied (« tape derrière leur ailier monté »)
- [ ] **Plan modifiable en cours de match** hors live moments (occupation / ligne
      défensive / cibles, à tout moment depuis le bord de touche)
- [ ] **Plans sauvegardés A/B** réutilisables d'un match à l'autre (aujourd'hui la
      tactique n'existe que dans le tunnel d'avant-match)

---

## V0.66 — Le duel d'entraîneurs

**Objectif : l'adversaire n'est plus une boîte noire.** S'appuie sur l'existant :
15 entraîneurs IA nommés avec style et carrière (V0.53), plans IA déduits de
l'identité du club, `RivalManager[]` persisté. Dépend du plan modifiable en match (V0.65).

- [ ] **L'IA ajuste son plan en cours de match** (menée à la 50e, elle change) et le
      commentaire le signale — à vous de lire et de contrer
- [ ] **Le débriefing raconte le duel** (« il vous a attendus au sol, vous n'avez
      jamais ajusté »)
- [ ] **Mémoire tactique des confrères** : sur plusieurs saisons, chaque entraîneur
      apprend vos habitudes ; rivalités de banc alimentées par les confrontations
- [ ] **Conférence de presse d'avant/après-match** (3-4 questions, effets moral /
      board / relation avec le confrère) — la presse sort du simple mail
- [ ] **Staff approfondi** : contrats à durée, licenciement, progression, un adjoint
      ambitieux qui peut viser votre banc

---

## V0.67 — La transmission : moments de carrière

**Objectif : différenciation pilier 2 — les histoires que les joueurs racontent.**
Toutes les briques sont payées : mentorat (`MENTOR_PROPOSE`), graphe de relations,
traits, `CareerBook` ligne par saison, suivi nominatif des promos du centre.

- [ ] **Moments de carrière détectés** : première titularisation, 100e match, 50e
      essai, l'élève qui dépasse le mentor, le brassard qui se transmet, les adieux
      d'une légende — chacun produit un event humain et s'inscrit au `CareerBook`
- [ ] **Filiation visible sur la fiche** : « formé au club, mentoré par X, capitaine
      depuis 2029 »
- [ ] **Arcs de vestiaire** multi-saisons : le jeune ambitieux qui pousse le cadre
      vieillissant, la reconstruction après le départ d'un taulier
- [ ] **Réactions du vestiaire aux conversations** avec un coéquipier (reliquat V0.48)

---

## V0.68 — Le corps du joueur

**Objectif : la gestion physique longue durée, sujet réel du rugby moderne, traité
par personne.** S'appuie sur : fatigue individuelle, 6 types de blessures avec
séquelles, repos hebdomadaire (V0.55).

- [ ] **Écran Infirmerie** : blessés, durées, rééducation, choix de retour anticipé
      avec risque de rechute chiffré par le médecin (sa qualité compte)
- [ ] **Historique corporel par joueur** : commotions cumulées (protocole HIA),
      articulations usées, compteur de minutes saison
- [ ] **Arbitrages de calendrier** : plafond de minutes conseillé, le pilier de 34 ans
      qu'on économise pour les phases finales, les doublons qui se paient en avril
- [ ] **Préparation d'intersaison** (reprise, pic de forme visé)

---

## V0.69 — Le son et le rythme

**Objectif : le plus gros saut d'immersion disponible.** Zéro audio dans le code
aujourd'hui — et le moteur calcule déjà tout ce qui doit piloter un son *réactif* :
`crowd.ts`, `homeFans`, momentum, rivalités, célébrations typées.

- [ ] **La foule comme instrument** : lit sonore dont l'intensité suit le remplissage
      et le momentum — on *entend* son momentum avant de lire la barre. Un stade aux
      trois quarts vide en Pro D2 sonne vide
- [ ] **Stingers** : sifflet, impacts sur duels gagnés, clameur montante pendant la
      course d'élan du buteur, sirène
- [ ] **Sons d'UI** : tics d'action, signature de contrat, jingle de victoire
- [ ] **Musique** : un thème de menu + un thème d'intersaison (pas plus en V1)
- [ ] **Juice du match** : ralenti automatique ×0.5 sur les moments chauds (le moteur
      sait qu'un essai arrive) puis reprise ; bandeaux d'incrustation TV (« Essai —
      3e de la saison », stat de conquête ponctuelle) ; vibration d'écran 2-3 px sur
      gros impacts — le tout coupé par reduced-motion (V0.62)
- [ ] Couche `audio/` pilotée par les mêmes événements que les animations ;
      banque de ~20-30 sons

---

## V0.70 — Le Musée du club

**Objectif : gamification premium — de la mémoire et de la fierté, pas du FOMO.**
Presque uniquement de l'UI sur des données déjà persistées (`CareerBook`,
`SeasonHonours`, `HeadToHead`, `PastSeasonFinances`).

- [ ] **Onglet Musée** : trophées en étagère, records du club (plus gros score, série
      de victoires, capes), légendes (200 matchs sous vos ordres), frise des saisons
- [ ] **Records absolus persistés** : le classement complet des saisons passées est
      conservé (aujourd'hui `SeasonRecord` ne garde que champion + rang du joueur),
      cumuls all-time du championnat (meilleur réalisateur historique…)
- [ ] **L'album de la saison** : rétrospective auto-générée de 5-6 moments (le match
      référence, l'éclosion du jeune, la remontada) rejouables via l'écran de temps forts
- [ ] **Succès Steam** (« Invaincu à domicile », « Champion avec un promu », « 10 JIFF
      titulaires »…) — requis pour la page Steam, détectables avec les données actuelles

---

## V0.71 — Scénarios et défis

**Objectif : contenu communautaire à coût quasi nul.** Le moteur est déterministe et
seedé, la sauvegarde d'état et le replay des temps forts existent — atout sous-exploité.

- [ ] **Mode Scénarios** : un club + une situation + une seed (« La Rochelle, 13e à
      la J18, sauvez-les », « finale, 68e, menés de 4, banc vide »)
- [ ] **Défi de la semaine** : tout le monde joue la même seed, comparaison de
      résultats — contenu pour streamers, onboarding parfait des casuals
- [ ] **Partage de replay** par seed (un match mémorable se rejoue chez un ami)

---

## V0.72 — Le match respire (profondeur de match II)

**Objectif : les moments de vérité du rugby moderne, ceux qui font crier devant la
télé.** S'appuie sur : météo par journée et par stade (V0.51), 12 arbitres profilés
(V0.52), banc actif à 8 (V0.13), buteur explicite avec fatigue.

- [ ] **Le TMO** : essais litigieux vérifiés en vidéo — temps d'attente, ralenti
      rejoué sur le terrain SVG, décision annoncée. Le suspense comme mécanique,
      corrélé au profil de l'arbitre
- [ ] **Le vent** : 3e composante météo (la pluie existe déjà) — pèse sur le jeu au
      pied, les touches longues et les pénalités lointaines ; **le toss** en début de
      match : choix du camp, jouer avec ou contre le vent par mi-temps
- [ ] **Banc 6-2 ou 5-3** : la répartition avants/arrières du banc devient un choix
      stratégique explicite d'avant-match, avec ses risques (blessure d'un arrière
      sans couverture)
- [ ] **La confiance du buteur** : jauge alimentée par ses réussites/échecs récents —
      un buteur en crise se manque, changer de buteur en cours de match devient une
      vraie décision (données déjà là : `kicking.ts`, sang-froid)
- [ ] **Stats live à la mi-temps** : possession, territoire, conquête affichées au
      vestiaire pour éclairer le choix de causerie (aujourd'hui on choisit le ton à
      l'aveugle)
- [ ] **Blessure à chaud** : le médecin donne un avis en direct — sortir le joueur ou
      le laisser finir la mi-temps, avec risque d'aggravation (préfigure V0.68)
- [ ] **Fin de match dramatisée** : sirène, jeu qui continue tant que le ballon vit,
      pénalité de la gagne après la sirène — le moteur les produit déjà, les mettre
      en scène

---

## V0.73 — Le public et la ville

**Objectif : le pilier 4 du GDD (ancrage régional) devient une mécanique, pas un
décor.** S'appuie sur : affluence dynamique et `homeFans` branchés (V0.58),
rivalités (V0.48), politique tarifaire (V0.45).

- [ ] **La confiance des supporters**, distincte de celle du board : elle se gagne
      par le jeu produit et les joueurs du cru alignés, se perd sur les prix premium
      et les ventes de chouchous — et module l'affluence et l'ambiance (`crowd.ts`)
- [ ] **Groupes de supporters nommés** : tifos sur les grands matchs, banderole
      hostile après une série noire, boycott possible — visibles dans le fil d'actus
      et entendus au stade (lien V0.69)
- [ ] **Le joueur chouchou** : le public adopte un joueur (formé au club, style
      spectaculaire) — le vendre coûte cher en confiance des supporters
- [ ] **Filière régionale** : partenariats avec des clubs amateurs du cru — coût
      annuel, meilleur vivier de jeunes JIFF, exclusivité sur les pépites locales
- [ ] **Identité régionale des jeunes générés** : le GDD le promet (« un ailier
      toulousain n'est pas le même profil qu'un ailier rochelais ») — biaiser la
      génération du centre selon l'identité de jeu du club (`identity-fit.ts` existe)
- [ ] **Météo saisonnière régionale** : hiver breton, chaleur de juin dans le sud —
      la météo par stade gagne une saisonnalité

---

## V0.74 — Les médias vivants

**Objectif : la presse devient des personnages, pas un expéditeur de mail.**
Même recette que les 12 arbitres nommés (V0.52) et les 15 confrères (V0.53) :
des personnes récurrentes avec profil et mémoire.

- [ ] **Journalistes nommés** (6-8) : le local bienveillant, le national à polémiques,
      le spécialiste mêlée — chacun avec un angle, une mémoire de vos réponses et une
      audience
- [ ] **Rumeurs de mercato dans le fil d'actus** : vraies (fuites des négociations IA
      réellement en cours) et fausses — le lecteur ne sait pas les distinguer, votre
      scout si
- [ ] **Le dérapage sur les réseaux** : event humain — un joueur poste ce qu'il ne
      fallait pas ; gérer en interne ou en public, avec le vestiaire qui regarde
      (s'ajoute aux 10 types de `HumanEventModal`)
- [ ] **La une d'après-journée** : un hebdo éditorialisé qui met en scène le fait
      marquant du week-end (utilise les données de `news.ts` + honours)
- [ ] **Cote de popularité du manager** dans les médias, distincte de la réputation
      sportive — alimente les questions de conférence de presse (V0.66) et les offres
      de clubs

---

## V0.75 — Le manager grandit

**Objectif : le manager devient un personnage qui progresse — le grand absent de
tous les jeux du genre.** S'appuie sur : réputation, stature, `ManagerSeasonRecord[]`,
négociation de contrat (V0.43).

- [ ] **Diplômes d'entraîneur** : formations en intersaison (coût + temps) qui
      débloquent des bonus concrets — lecture de match affinée, causeries plus sûres,
      marges de négociation
- [ ] **Style de management forgé par les décisions** : développeur de jeunes /
      gagneur / bâtisseur d'institution — le jeu vous étiquette d'après vos actes,
      l'étiquette attire des joueurs et des clubs compatibles et colore les dialogues
- [ ] **L'entretien d'embauche joué** : répondre aux questions du board avant de
      signer — les promesses de projet faites en entretien deviennent opposables
      (même mécanique que les promesses aux joueurs, V0.48)
- [ ] **Le réseau personnel** : anciens joueurs et collègues deviennent des contacts —
      un tuyau mercato, une info de vestiaire adverse, une recommandation qui ouvre
      un banc (se nourrit de V0.77)
- [ ] **Spécialisation du regard** : sans scout, vos propres évaluations de joueurs
      sont plus ou moins fiables selon votre parcours (un ancien pilier lit mieux les
      premières lignes)

---

## V0.76 — La vie du groupe

**Objectif : le vestiaire hors du terrain — la partie du pilier 2 qui manque
encore.** S'appuie sur : graphe de relations (435 paires), mood à 7 sources,
`hidden.adaptabilite`, événements humains.

- [ ] **La troisième mi-temps** : après-match à trancher (libérer le groupe / rentrer
      sagement / imposer la récup') — cohésion contre fatigue et risque de frasque,
      amplifié après un derby gagné. La mécanique la plus rugby du jeu
- [ ] **Événements de cohésion** : mise au vert, repas de groupe, journée famille,
      stage de pré-saison à choisir (montagne = physique, bord de mer = cohésion)
- [ ] **Cliques et intégration** : les recrues étrangères s'agrègent entre elles
      (`adaptabilite` existe) — détecter le joueur isolé, nommer un parrain, ou
      laisser une clique se former et peser sur les compos
- [ ] **Objectifs personnels des joueurs** : « je veux le brassard », « je veux le
      10 », « je veux finir ma carrière ici » — visibles sur la fiche, négociables en
      conversation, et qui structurent le mood bien plus que la météo du moment
- [ ] **Événements de vie** (façon RimWorld, cité dans le GDD) : naissance, coup dur
      familial, rappel au pays — le joueur demande un aménagement, le groupe juge
      votre réponse
- [ ] **La prime collective** : négocier avec les cadres la prime de phases finales /
      de maintien — très rugby français ; un accord au rabais se paie en engagement,
      un accord généreux en masse salariale

---

## V0.77 — Reconversion et héritage

**Objectif : les visages ne disparaissent plus — le monde se peuple d'anciens.**
S'appuie sur : `CareerBook`, retraites (V0.6-V0.12), marché des techniciens (V0.44),
entraîneurs IA nommés (V0.53).

- [ ] **La reconversion dans votre staff** : un cadre qui raccroche peut se voir
      offrir un poste d'adjoint — il arrive avec sa mémoire du vestiaire et ses
      relations intactes (l'ancien capitaine qui devient votre bras droit)
- [ ] **Les anciens deviennent entraîneurs IA** : les joueurs marquants de la ligue
      réapparaissent sur les bancs du championnat au fil des saisons — un jour, votre
      ancien ouvreur vous bat en finale
- [ ] **Le jubilé** : match de gala pour une légende du club (billetterie, émotion,
      event humain) — s'inscrit au Musée (V0.70)
- [ ] **Statut de légende** : seuils (matchs, essais, trophées sous vos ordres) qui
      classent un joueur au Musée et pèsent sur la confiance des supporters quand il
      part
- [ ] **Le successeur désigné** : préparer sa propre succession en formant un adjoint —
      quand vous partez, le club continue « votre » projet ou le renie (lecture de fin
      de carrière du manager)

---

## V0.78 — Confort de jeu (power users)

**Objectif : la friction en moins pour ceux qui enchaînent les saisons.**

- [ ] **Palette de commandes** (Ctrl/Cmd+K) : recherche globale joueur / club /
      écran / action (« prolonger Dupont », « classement Pro D2 »)
- [ ] **Raccourcis clavier** : navigation entre onglets, avancer la semaine,
      vitesses de match au pavé numérique
- [ ] **Presets de composition** : XV de gala, équipe de rotation Coupe d'Europe,
      XV des doublons — sauvegardés, appliqués en un clic, avec repli automatique si
      un titulaire est indisponible
- [ ] **Skip intelligent** : « continuer jusqu'au prochain événement important »
      (blessure d'un cadre, offre reçue, mail du board) — simule plusieurs semaines
      sans clic par semaine
- [ ] **Slots de sauvegarde multiples** + export/import de sauvegarde en fichier
      (préparation Tauri V0.9, et partage de parties)
- [ ] **Notes personnelles** : bloc-notes libre épinglable sur un joueur, un club,
      un match — pour les plans à trois saisons
- [ ] **Comparaison avant/après** : le bilan d'intersaison et le rapport
      d'entraînement montrent les deltas d'attributs en un écran
- [ ] **Mode streamer** : masquer la seed et les infos spoilantes, overlay-friendly

---

## V0.79 — Modes de jeu

**Objectif : plusieurs façons d'aimer le même jeu.** Quasi tout est de la
configuration au-dessus de systèmes existants.

- [ ] **Mode Ironman** : sauvegarde unique auto, pas de retour arrière — le mode
      « on assume tout », badge dédié au Musée et sur les succès
- [ ] **Mode Dynastie** : objectifs longue durée générés (3 Boucliers en 10 ans,
      remonter un club de Pro D2 au titre européen) avec suivi dédié
- [ ] **Difficulté réglable** : budgets, patience du board, brouillard de scouting,
      sévérité de la commission — presets « Décontracté / Classique / Impitoyable »
- [ ] **Options de nouvelle partie** : monde randomisé (effectifs mélangés — rejouable
      à l'infini), budget personnalisé, démarrage en cours de saison (reprendre un
      club en crise, pont avec les Scénarios V0.71)
- [ ] **Le récap de saison** (« Wrapped ») : rétrospective chiffrée et partageable en
      fin de saison — vos records, votre moment fort, votre XV de l'année (s'appuie
      sur l'album V0.70)

---

## V0.80 — La pré-saison et les aléas du calendrier

**Objectif : le calendrier cesse d'être un métronome.** Constat d'audit : il n'existe
**aucun match amical** dans le code, et aucun système d'abonnements — deux basiques
du genre.

- [ ] **Matchs amicaux d'avant-saison** : 2-3 rencontres à programmer — choix de
      l'adversaire (petit club = recette locale et rodage sans risque, gros club =
      billetterie pleine mais blessures possibles), montée en forme progressive,
      banc d'essai des combinaisons (V0.65) et des jeunes
- [ ] **Match de gala** : un adversaire européen prestigieux en tournée — grosse
      recette, fatigue, vitrine pour les supporters (V0.73)
- [ ] **Campagne d'abonnements** : revenu garanti d'avant-saison contre billetterie
      unitaire plus faible — un curseur de plus dans la politique commerciale (V0.45)
- [ ] **Match reporté** : terrain gelé, tempête — rencontre recasée en semaine,
      embouteillage de calendrier avec les doublons (lien V0.68, gestion des minutes)
- [ ] **Le huis clos** rejoint l'arsenal de sanctions de la commission (lien V0.73 :
      un match sans public, ça s'entend — V0.69)
- [ ] **Le barrage se joue** : accession/relégation du club dirigé disputée avec le
      vrai moteur (aujourd'hui résolue par un tirage gaussien, même pour vous —
      `divisions.ts`) ; le match le plus important de la saison mérite d'être joué

---

## V0.81 — La discipline au complet

**Objectif : le circuit disciplinaire du rugby pro, au-delà du carton en direct.**
S'appuie sur : cartons vécus et suspensions (V0.52), commission (V0.45-V0.47),
arbitres profilés.

- [ ] **Citations post-match** : un geste dangereux passé inaperçu en direct peut
      être cité par la commission dans la semaine — le moteur trace déjà les duels
      et la discipline individuelle
- [ ] **L'audience** : défendre son joueur devant la commission (plaider, produire
      la vidéo, exprimer des regrets) — réduction ou aggravation de la sanction,
      réputation du manager en jeu
- [ ] **L'appel** : contester une suspension, avec risque d'alourdissement
- [ ] **Sursis et récidive individuelle** : l'échelle de sanctions suit le casier du
      joueur (aujourd'hui la récidive n'existe que pour les clubs)
- [ ] **Barème par type de faute** : plaquage haut, brutalité, contestation — lisible
      par le joueur, cohérent avec le profil de l'arbitre du soir
- [ ] **La presse s'en mêle** (lien V0.74) : une citation médiatisée met la pression
      sur la commission et sur votre vestiaire

---

## V0.8x — Éditeur de données et mods

**Objectif : condition du succès commercial d'un jeu de sport sans licence.**
Décision GDD (M14, « mods de noms réels à la FM ») jamais construite. À livrer
**avant** la bêta V0.9 pour que les testeurs jouent « avec les vrais noms ».

- [ ] **Format de données ouvert et documenté** (les clubs sont déjà en CSV)
- [ ] **Éditeur in-game basique** : renommer clubs/joueurs/staff, ajuster stats,
      logos/couleurs
- [ ] **Chargement de packs communautaires** (dossier de mods, validation, ordre de
      priorité)

---

## V0.9 — Bêta privée *(jalon existant, enrichi)*

- [ ] Init Tauri (binaire desktop)
- [ ] EULA + politique de confidentialité
- [ ] Décision juridique licence Top 14 (chemins A/B/C — `12-juridique.md`)
- [ ] 5-10 testeurs proches + sondage hebdo « qu'est-ce qui t'a fait revenir ? »
- [ ] Éditeur de mods livré (V0.8x) pour tester avec les vrais noms
- [ ] Itération polish selon feedback

## V1.0 — Release *(jalon existant)*

- [ ] Page Steam (capsules, screenshots, trailer 30 s + 1 min) + succès (V0.70)
- [ ] Page Itch.io
- [ ] Build Steam soumis + validé
- [ ] Discord public
- [ ] Plan de support post-launch

---

## Post-V1 — le vivier

Idées validées mais volontairement repoussées :

- **Le stress du manager** (M7 du GDD, emprunté à CK3, jamais implémenté) : jauge
  alimentée par défaites, promesses à contrecœur, conflits — qui déborde en décisions
  altérées et se purge (sabbatique, contrat serein). Donne un corps au manager.
- **Coupe du monde** (année sur 4, gèle le championnat), **tournées d'été**, **U20 /
  équipes réserves**, **Nationale** (3e division).
- **Banqueroute et administration** : le solde peut être négatif sans conséquence ;
  prêts bancaires, actionnaires, rachat de club, droits TV négociés.
- **Multijoueur asynchrone** (même ligue, tours par seed) et **hot-seat** (deux
  managers sur la même machine, un match direct l'un contre l'autre).
- **Traduction anglaise** : le narratif est massif (récits, causeries, mails, actus) —
  chantier lourd, mais condition d'un marché au-delà de la francophonie
  (UK/Irlande = les plus gros marchés rugby manager).
- **Le rugby à 7 / Supersevens** : format court, moteur adapté (7 joueurs, 14 min) —
  tournoi d'intersaison qui expose les jeunes, et un mode arcade naturel.
- **Championnat féminin** (Élite 1) : seconde carrière possible, monde partageant
  le moteur — différenciation forte, aucun concurrent ne l'a.
- **Steam Workshop** pour les mods (au-delà du chargement local V0.8x) :
  tactiques, scénarios et packs de données partagés en un clic.
- **Coupe de France** (format coupe à élimination directe, petits contre gros).
- **Finir sélectionneur** : le XV de France comme sommet de carrière — un poste
  proposé aux managers les plus titrés, avec ses propres règles (pas de mercato,
  gérer les clubs qui rechignent à libérer leurs joueurs).
- **Musique originale complète**, présentation 3D : explicitement écartées — cher,
  et pas ce qui fait revenir le joueur selon la vision (`01-vision-concept.md`).

## Chantiers techniques transverses

Hors features, à faire vivre en continu :

- [ ] **CI : ajouter l'étape `build`** — `ci.yml` fait lint + typecheck + tests, mais
      un build Vite cassé passerait la CI
- [ ] **Tests E2E** (Playwright) : les 1172 tests sont unitaires/moteur — aucun test
      ne traverse l'UI (créer une carrière, jouer un match, recharger). Les bugs de
      l'audit n°2 (§ phases finales, § sauvegarde) auraient été attrapés par 3-4
      parcours E2E
- [ ] **Test de longévité automatisé** : simuler 20 saisons en CI (effectifs des deux
      divisions, taille de sauvegarde, aucun crash) — le garde-fou du bug « le monde
      se vide »
- [ ] **Migration SQLite/Tauri** : `schema.sql` est documenté depuis V0.2, le stockage
      réel est localStorage — trancher au moment du passage Tauri (V0.9), avec
      migration des sauvegardes existantes
- [ ] **Versionner le format de sauvegarde à chaque release** (lié à l'audit n°2) et
      tester le chargement des sauvegardes des 2-3 versions précédentes

## Principes de séquencement

1. **Fondations avant tout** (V0.60) : chaque feature en aval suppose un monde qui
   tient 20 saisons et un moral branché sur le réel.
2. **Rentabiliser l'existant avant de construire** (V0.61, V0.70, V0.71 : surtout de
   l'UI sur des données déjà calculées).
3. **Rattrapage FM là où ça se voit** (données, mercato, monde), **différenciation là
   où FM ne peut pas suivre** (touche, duel de coachs, transmission, corps).
4. **L'ordre V0.65 → V0.66 est une dépendance dure** (le duel d'entraîneurs suppose
   le plan modifiable en match). Le reste peut se réordonner selon l'envie.
5. **V0.72 à V0.79 sont un backlog, pas un calendrier** : la numérotation classe par
   thème, pas par ordre d'exécution. Rien n'oblige à tout faire avant la bêta — le
   jalon V0.9 peut s'intercaler dès que le cœur (V0.60-V0.64 + V0.62 + V0.8x) est
   solide, et le reste devient du contenu de mises à jour post-launch (bon argument
   de suivi pour la page Steam).
