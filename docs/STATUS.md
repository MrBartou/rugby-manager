# Statut global : V0.65

> Dernière mise à jour : V0.65 livrée. **1607/1607 tests verts. Calibration rejouée après modification du moteur de touche : 12/12 cibles atteintes (8000 matchs par scénario).**
>
> Ce document a longtemps annoncé V0.5 alors que le code était déjà en V0.10+ : les jalons
> V0.6 à V0.12 (carrière, transferts, finances, JIFF, formation, internationaux, records)
> sont rétablis ci-dessous.

## Roadmap par jalon

### ✅ V0.1 — Proto moteur match
- [x] Modèle de calibrage (1000 matchs simulés)
- [x] Validation distributions vs cibles (9/12 cibles vertes via `npm run calibrate`)
- [x] Décision GO sur le calibrage avant de coder l'UI

### ✅ V0.2 — Vertical slice "1 match jouable"
- [x] Schéma DB minimal (localStorage + schema.sql documenté pour SQLite V0.x+)
- [x] Moteur match TS — 5 sous-systèmes (mêlée, touche, ruck, jeu courant, jeu au pied)
- [x] UI 2D top-down (SVG — terrain + balle animée)
- [x] Live moments (5 moments hardcodés interactifs)
- [x] Génération de résumé narratif (V0.5 enrichi)
- [x] **Critère succès** : un testeur peut jouer 5 matchs et raconter chacun avec une anecdote

### ✅ V0.3 — Saison Top 14 + boucle
- [x] 14 clubs Top 14 saisis (~250 joueurs nominatifs)
- [x] Calendrier round-robin double (26 journées + barrages + demis + finale)
- [x] Classement Top 14 (V=4, N=2, BO ≥4 essais, BD défaite ≤7)
- [x] Composition équipe-type (auto + manuel)
- [x] Préparation de semaine (charge entraînement + focus tactique)
- [x] Saison complète déroulable + phases finales
- [x] Save de partie en cours (snapshot localStorage)

### ✅ V0.4 — Système humain v0
- [x] Modèle joueur complet (3 catégories attributs + 5-6 traits + mood)
- [x] 30 traits hardcodés en 5 catégories (Leadership, Mental, Ambition, Relationnel, Style)
- [x] Génération de traits déterministe selon stats du joueur
- [x] Calcul mood avec 7 sources (forme, résultats, statut, relations, contrat, fatigue, reconnaissance)
- [x] Graphe de relations (435 paires possibles, score -100..+100, 5 types)
- [x] Évolution des relations après chaque match
- [x] 5 events humains (CONFLIT_VESTIAIRE, DEMANDE_INDIVIDUELLE, MENTOR_PROPOSE, STAR_FATIGUEE, PRESSE_NEGATIVE)
- [x] Modal d'event sur Dashboard
- [x] 8 staff voix par club avec biais (médecin / adjoints / président / etc.)
- [x] Voix dans les live moments du match

### ✅ V0.5 — Polish + UI
- [x] Charte graphique cohérente (sombre, mono pour les chiffres, couleurs sémantiques)
- [x] Dashboard avec 3-5 fils humains (PENDING_EVENT, CONFLICT, LOW_MOOD, MENTOR, HOT_FORM)
- [x] Narratif de match en 4 paragraphes (Match / 1re mi-temps / 2e mi-temps / Performances)
- [x] Citations de traits dans le narratif (killer_instinct, créatif, etc.)
- [x] Détection mêlée dominante en narratif
- [ ] Wireframes Figma finalisés (✱ optionnel — la charte vit dans le code)

### ✅ V0.6 à V0.12 — Carrière et vie du club
- [x] Contrats, renouvellements et décisions de fin de contrat
- [x] Finances du club (billetterie, sponsors, masse salariale)
- [x] Marché des transferts (offres entrantes, agents libres)
- [x] Quotas JIFF
- [x] Formation : génération de jeunes issus du centre
- [x] Vieillissement des stats et fins de carrière
- [x] Sélections internationales et trêves
- [x] Records de club, réputation du manager, objectifs du président
- [x] Rollover de saison complet (sauvegarde et reprise)

### ✅ V0.13 — Profondeur du moteur de match
- [x] **Banc actif** : fatigue individuelle, 8 remplacements, règles première ligne, mêlées simulées
- [x] **Défense de ligne** : phase `GOAL_LINE` par attrition (la zone rouge valait 92 % d'essai)
- [x] **Discipline** : pénalités passées de 2,8 à ~8 par match, pilotées par les attributs joueurs
- [x] **Duel porteur / défenseur** : statistiques individuelles réelles et narratif nominatif
- [x] **Coupe d'Europe** : seconde compétition entrelacée, qui force la rotation d'effectif
- [x] **Relégation** : descente du 14e, barrage du 13e contre le 2e de Pro D2
- [x] Calibration : **12/12 cibles** (« points cumulés » verte pour la première fois)
- [x] **UI** : feuille de statistiques individuelles post-match, panneau Coupe d'Europe sur le
      tableau de bord, badges européens et zones de descente dans le classement

### ✅ V0.14 — Boucle de développement
- [x] Progression des joueurs pilotée par le **temps de jeu**, l'âge, le potentiel,
      le professionnalisme et la qualité du staff
- [x] 6 focus d'entraînement individuels (physique, technique, poste, mental…)
- [x] Staff doté d'une compétence chiffrée et d'un salaire — il a enfin un effet
- [x] Écran Entraînement + bilan d'intersaison attribut par attribut

### ✅ V0.15 — Brouillard sur les joueurs
- [x] Familiarité 0-100 par joueur, alimentée par 4 sources
- [x] Attributs et potentiel affichés en **fourchettes** qui se resserrent
- [x] Missions d'observation (2 à 5 créneaux selon la compétence du scout)
- [x] Rapport de scouting sur la fiche joueur + barres d'attribut incertaines
- [x] Consultation de l'adversaire → dossier d'avant-match en V0.36

### ✅ V0.28 — Transferts sortants
- [x] Offre pour un joueur sous contrat : décision du club vendeur puis du joueur
- [x] Refus toujours attribué (club / joueur) avec motif exploitable
- [x] Contre-proposition chiffrée du vendeur face à une offre sérieuse
- [x] Valeur marchande brouillée par le scouting + échelle recalée sur la trésorerie
- [x] `hidden.ambition` et `hidden.loyaute` enfin utilisés
- [x] Transferts entre clubs IA → V0.29

### ✅ V0.29 — Le championnat vit sans vous
- [x] Mercato des clubs IA à chaque intersaison (mêmes règles que le joueur)
- [x] Diagnostic d'effectif par poste : couverture + écart au niveau moyen
- [x] Prolongations et complément d'effectif — le championnat ne se vide plus
- [x] Plafonds d'achats et de ventes par club
- [x] Onglet « Mercato du championnat »
- [x] Fil d'actualité permanent → V0.38, puis onglet dédié en V0.40
- [x] Mercato en cours de saison → V0.30

### ✅ V0.30 — Mercato d'hiver
- [x] Fenêtres de mercato (J1-J3 et J13-J16), opposables au manager comme à l'IA
- [x] Mercato d'hiver IA : un renfort, un départ, pas de reconstruction
- [x] Pression du classement : un club qui rate sa saison cherche et surpaie
- [x] Diagnostic sensible aux blessures longue durée
- [x] Pastille d'état du marché dans l'écran Transferts
- [x] Blessures simulées pour les clubs IA → V0.31

### ✅ V0.31 — Trois corrections de fond
- [x] Fins de contrat échelonnées : plus d'effondrement de l'effectif utilisateur
- [x] Entraînement, scouting et délais d'offre persistés (sauvegarde 0.5.0)
- [x] Blessures et suspensions pour tous les clubs, avec guérison
- [x] Compositions bâties sur l'effectif réel : le mercato IA agit enfin sur le terrain
- [x] Joker médical hors fenêtre → V0.37

### ✅ V0.32 — Le plan de match existe enfin
- [x] Occupation, ligne défensive et travail des phases arrêtées effectifs
- [x] Plans de l'IA déduits de l'identité du club
- [x] Aucun plan dominant : des profils, pas un optimum

### ✅ V0.33 — Bord de touche
- [x] Banc visible en match : fatigue, postes couverts, quota
- [x] Remplacements manuels, règles du moteur appliquées
- [x] Ajustement du plan en cours de match

### ✅ V0.34 — Rôles de joueurs
- [x] 19 rôles sur les quinze postes, à somme nulle
- [x] Sélecteur de rôle par titulaire + choix automatique pour l'IA
- [x] Rôles visibles hors match (fiche joueur, écran effectif) → V0.35

### ✅ V0.36 — Dossier adversaire et débriefing
- [x] Dossier d'avant-match filtré par le scouting
- [x] Débriefing : possession, territoire, conquête, pénalités
- [x] Lecture de ce que le plan a produit
- [x] Mission de scouting ciblant un club adverse → V0.43

### ✅ V0.37 — Joker médical
- [x] Remplacement d'un blessé longue durée hors fenêtre
- [x] Vivier d'agents libres dès le début de carrière

### ✅ V0.38 — Fil d'actualité
- [x] Journal persistant, filtrable, plafonné
- [x] Transferts, mercatos, blessures, résultats, titres

### ✅ V0.39 — Centre de formation
- [x] Investissement et orientation réglables
- [x] Convergence lente : la formation est un choix de long terme
- [x] Suivi individuel des espoirs du centre → V0.43

### ✅ V0.40 — Les actualités prennent leur onglet
- [x] Onglet dédié, présentation de fil social
- [x] Comptes par club, rédaction pour le reste
- [x] Tri chronologique explicite

### ✅ V0.41 — Carrière du manager
- [x] Limogeages dans le championnat, relayés par le fil d'actualité
- [x] Propositions de clubs pilotées par réputation et stature
- [x] Un limogeage rend libre : la carrière ne se termine plus
- [x] Réputation jugée sur la mission, plus sur le classement absolu
- [x] Modale d'offres affichée en jeu (elle vivait dans une branche de rendu que la carrière ne traverse plus)
- [x] Saison sans club → année sabbatique en V0.43

### ✅ V0.42 — Onglet « Ma carrière »
- [x] Bandeau d'identité : réputation, confiance du board, mission, ancienneté
- [x] Messagerie : sept expéditeurs, non-lus badgés, persistance des messages lus
- [x] Parcours : une ligne par saison dirigée + courbe de réputation
- [x] Palmarès : totaux du manager, saison de référence, passages par club
- [x] Négociation de contrat avec le président → V0.43
- [x] Mails actionnables → V0.43

### ✅ V0.43 — Le manager répond
- [x] Négociation de contrat : durée, salaire, enveloppe de transfert
- [x] La patience du board s'achète en signant long, se perd en se payant cher
- [x] Mails à réponse : presse, convocation du bureau, arbitrage de l'enveloppe
- [x] Année sabbatique + limogeages en cours de saison
- [x] Suivi nominatif des espoirs du centre
- [x] Mission de scouting sur un club entier
- [ ] Renégociation en cours de contrat (prolongation, revalorisation)
- [ ] Sollicitations d'agents pour placer un joueur
- [x] Modale de négociation vérifiée en jeu (arbitrage, contre-proposition, signature)
- [x] Écran sabbatique vérifié en jeu (bancs qui s'ouvrent en cours de saison, offres)
- [x] Mails à réponse vérifiés en jeu (convocation du bureau, effets appliqués)

### ✅ V0.44 — Un plancher, un encadrement, une semaine
- [x] La descente s'applique enfin (le module dormait depuis V0.13)
- [x] Pro D2 jouable : 14 clubs persistants, effectifs, économie, objectifs propres
- [x] Barrage d'accession 13ᵉ contre 2ᵉ de Pro D2
- [x] Carrière démarrable en seconde division
- [x] Marché des techniciens : embauche, indemnité de rupture, refus motivé
- [x] La charge d'entraînement se paie en forme, fatigue et blessures
- [ ] Pro D2 à 16 clubs et 30 journées (simplifiée à 14 pour réutiliser la saison)
- [ ] Mercato adapté à la seconde division (les budgets IA ignorent l'étage)
- [ ] Repos individuel dans la semaine (la charge est collective)

### ✅ V0.45 — Une contrainte, une maison, une parole
- [x] Salary cap opposable, calibré sur les effectifs réels du jeu
- [x] Quota JIFF en proportion, contrôlé sur l'effectif
- [x] Sanctions graduées : amende, retrait de points, interdiction de recruter
- [x] Chantiers pluriannuels : stade, entraînement, médical, boutique
- [x] Prix des places, campagnes marketing, merchandising
- [x] L'affluence pèse sur le match (avantage du terrain)
- [x] Causerie de mi-temps à quatre tons, avec risque de retournement
- [x] Le mercato IA contraint par le plafond → V0.46
- [x] Momentum lisible pendant la rencontre *(V0.50)*
- [ ] Sanctions appliquées aux clubs IA

### ✅ V0.46 — Le plafond s'applique à tout le monde
- [x] Marge de recrutement IA bornée par le plafond de la division
- [x] Dégraissage : un club en dépassement libère ses plus gros salaires
- [x] Le complément d'effectif respecte le plafond (fin de la boucle libération/re-signature)
- [x] Les libérations apparaissent dans le fil d'actualité
- [x] Dégraissage annuel uniquement (plus de double libération en janvier)
- [x] Sanctions appliquées aux clubs IA → V0.47

### ✅ V0.47 — La commission juge tout le championnat
- [x] Contrôle de tous les clubs à l'intersaison (amende, points, interdiction)
- [x] La commission passe **avant** le mercato, sur l'effectif de la saison jouée
- [x] L'interdiction de recruter écarte réellement un club IA du marché
- [x] Récidive suivie par club et persistée
- [ ] Momentum lisible pendant la rencontre
- [ ] Repos individuel dans la semaine d'entraînement
- [ ] Pro D2 à 16 clubs et 30 journées

### ✅ V0.48 — Parler, exiger, se détester
- [x] Conversations depuis la fiche joueur, réaction selon traits et situation
- [x] Promesses de temps de jeu suivies, tenues ou trahies
- [x] Attentes du board au-delà du classement, jugées en fin de saison
- [x] Rivalités : affluence, moral amplifié, mémoire des confrontations
- [x] Demandes de transfert après une promesse trahie *(V0.49)*
- [ ] Réactions du vestiaire aux conversations avec un coéquipier
- [ ] Rivalités entre joueurs (le graphe de relations ne les connaît pas)

### ✅ V0.49 — La semaine du manager, et le prix d'une parole
- [x] Digest hebdomadaire en tête du tableau de bord, trié par urgence, muet quand tout va bien
- [x] Chaque entrée renvoie vers l'onglet concerné
- [x] Une promesse trahie peut déclencher une demande de départ, selon le tempérament
- [x] Le vestiaire encaisse une parole non tenue, que le joueur parte ou non
- [x] Courrier de l'agent à deux réponses, chacune avec son coût annoncé
- [x] La liste des transferts fait réellement venir des offres sur le joueur
- [x] Demandes de départ persistées, effacées à l'intersaison
- [x] L'introduction remise à niveau : quatorze leçons contextuelles au lieu d'une visite guidée
- [x] Vouvoiement partout — le tutoriel et l'écran de choix du club tutoyaient encore

### ✅ V0.50 — Ce qui était écrit sans être lu
- [x] Le capitaine agit : causerie relayée, discipline tenue, contrecoup à sa sortie
- [x] Le brassard compte pour celui qui le porte, et survit au match comme à la sauvegarde
- [x] L'élan est un état du moteur, qui agit et qui se lit
- [x] La hiérarchie de l'effectif : cadre, rotation, espoir, hors projet, annoncés et opposables

### ✅ V0.51 — Le système humain touche enfin le terrain
- [x] Moral et cohésion pèsent sur la confiance, l'erreur, l'engagement et la discipline
- [x] Le graphe de relations atteint un match, sur les joueurs alignés ensemble
- [x] L'état du vestiaire se lit avant le coup d'envoi
- [x] Harnais de calibration : défaut porté à 8000 matchs, la cible « équipe forte » y étant illisible à 1000
- [x] La météo : tirée par journée et par stade, elle change la manipulation, le pied, les essais et la touche
- [x] L'arbitre : douze profils nommés, sévérité par domaine, biais domicile

### ✅ V0.52 — L'arbitre et le carton qui se vit
- [x] Douze arbitres nommés, sévérité indépendante ruck / mêlée / hors-jeu
- [x] Le carton en direct : dix minutes à quatorze pour un jaune, définitif pour un rouge
- [x] Les suspensions découlent des cartons réellement pris
- [x] Consigne au sol et fiche arbitre au dossier d'avant-match

### ✅ V0.53 — Le monde autour du club
- [x] Quinze entraîneurs nommés, avec réputation, style et carrière
- [x] Les bancs se libèrent et se repourvoient ; les rivaux disputent les postes au joueur
- [x] Onglet Confrères : la réputation devient un rang
- [x] Les honneurs de fin de saison : meilleur joueur, espoir, marqueur, XV type
- [x] Le vestiaire réagit joueur par joueur, via le graphe de relations
- [x] Vouvoiement partout : les événements humains tutoyaient encore
- [x] **Les deux morals réunifiés** *(V0.54)* : `dynamic.mood` est désormais le résultat des sept sources plus les événements datés

### ✅ V0.55 — La troisième voie, et les attributs qui dormaient
- [x] Le prêt : un jeune peut partir jouer ailleurs, et ses minutes le font progresser
- [x] `hidden.adaptabilite` : une recrue met des semaines à trouver ses marques
- [x] `hidden.determinisme` : il décide désormais qui atteint son potentiel
- [x] Le repos individuel dans la semaine d'entraînement

### ✅ V0.56 — Le vestiaire se tend, et la vraie Pro D2
- [x] **Une seule source de vérité pour l'effectif** : `commitRoster`, point d'écriture unique — ferme la classe de défauts qui a frappé en V0.53, V0.54 et V0.55
- [x] Les rivalités entre joueurs : la concurrence au poste tend vraiment une relation
- [x] La hiérarchie déclarée désamorce ou aggrave la tension, selon ce qu'on a annoncé
- [x] Le staff signale une brouille au moment où elle éclate, une seule fois
- [x] La Pro D2 à seize clubs et trente journées, avec des phases finales qui suivent le championnat

### ✅ V0.57 — On voit enfin un match de rugby
- [x] La composition se fait sur le terrain, en glisser-déposer — liseré d'aptitude, condition, brassard, buteur, acclimatation
- [x] Les trente joueurs sur le terrain pendant le match, replacés à chaque phase
- [x] Le porteur, le plaqueur, le buteur, le marqueur et le sanctionné nommés et mis en évidence
- [x] Les temps forts d'un match auto-simulé, rejoués sur le même terrain
- [x] `getSubstitutions()` : qui est sur le pré, pendant la rencontre et plus seulement à la fin

### ✅ V0.58 — Le XV de France, et ce que le public change
- [x] Un groupe de trente-trois composé avec des quotas par poste, sur le niveau, la forme, le temps de jeu et l'âge
- [x] Les capes se cumulent, s'affichent sur la fiche, et le monde démarre avec un passé international
- [x] Les tests d'automne et le Tournoi se jouent ; les internationaux reviennent fatigués
- [x] **`homeFans` branché** : le remplissage du stade module l'avantage du terrain, et s'affiche avant le match
- [x] Les statistiques de saison survivent au rechargement

### ✅ V0.59 — La mémoire longue
- [x] La carrière d'un joueur, saison par saison — matchs, minutes, essais, capes, honneurs, prêts
- [x] Les records du club se dérivent du registre, plus d'un cumul tenu à part
- [x] Un hommage à qui raccroche, chiffré sur ce qu'il a réellement fait
- [x] Le banc du XV de France : la fédération approche un manager titré, et le poste ne se cumule pas
- [x] Un test qui empêche un extra de sauvegarde de se perdre en route

### ✅ V0.60 : Fondations, le monde tient vingt saisons
- [x] Le championnat va au bout : retrait de points, phases finales rechargées, finale nulle tranchée, saison sans titre
- [x] Les règles ne se contournent plus : trêves, prêts, interdiction de recruter, joker médical, compo de secours
- [x] La sauvegarde ne se perd plus : lecture défensive, copie de secours, quota, format versionné, élagage mesuré
- [x] Deux divisions, deux calendriers : jeunes et mercato partout, salaires sur trente journées, mercato d'hiver à mi-parcours
- [x] Une seule vérité : squelette de V0.1 retiré, ancienne sélection purgée, champs morts supprimés, version affichée réelle
- [ ] Extraire l'intersaison vers le moteur, reporté en V0.61 (voir le CHANGELOG)

### ✅ V0.61 : La donnée parle
- [x] Note du joueur sur dix et homme du match, situées dans la distribution du poste
- [x] Vue statistiques de l'effectif : mètres, battus, franchissements, plaquages, grattages
- [x] Classements individuels du championnat sous la table
- [x] Fiche club, adversaire compris, avec confrontations et effectif filtré par le scouting
- [x] Comparateur de deux ou trois joueurs, fourchettes de scouting respectées
- [x] Liste de suivi avec alertes de fin de contrat, distincte du scouting
- [x] Classements, fil d'actualité, salaires et classement mènent aux fiches
- [x] Verdict de fin de saison extrait vers le moteur et testé
- [ ] Extraction complète de l'intersaison, reportée en V0.62 (voir le CHANGELOG)

### ✅ V0.62 : Réglages, accessibilité, délégation
- [x] Écran de réglages : vitesse de match, sauvegarde automatique, confirmations, volume
- [x] Accessibilité : animations réduites, taille de texte, palette daltonienne, thème clair
- [x] Délégation au staff : composition, remplacements, entraînement, offres mineures
- [x] Encyclopédie contextuelle, ouverte sur le terme de l'écran courant
- [x] Commission, promotion des jeunes et clôture financière extraites vers le moteur
- [x] **V0.62.1** : thème clair réellement fonctionnel (185 couleurs en dur passées aux variables, quatre teintes remontées au seuil AA et verrouillées par un test), réglages, encyclopédie et entraînement remis en forme

### ✅ V0.63 : Le monde s'élargit
- [x] Trente-deux clubs européens persistants : identité, niveau, forme et palmarès conservés d'une saison à l'autre, effectifs reconstruits à l'identique depuis une graine stable
- [x] Palmarès européen historisé : deux vainqueurs par saison, même les années sans club dirigé dans le tableau
- [x] Marché international : pool anglo-celte et hémisphère sud, recrues non-JIFF, réputation du club exigée par le joueur
- [x] Vente à l'étranger : les clubs européens paient au-dessus du marché français, et l'expatrié perd la sélection
- [x] Tests internationaux joués par le moteur de match : performances individuelles, capes réservées aux vingt-trois d'une feuille, fatigue au prorata des minutes, blessures en bleu

### ✅ V0.64 : Le mercato mûrit
- [x] Clauses de contrat branchées : clause libératoire, primes de match, d'essai et de sélection, salaire progressif, année en option
- [x] Les primes se paient le soir du match, sur une ligne de bilan distincte du salaire
- [x] Paiement échelonné et pourcentage à la revente, escomptés par le vendeur selon sa trésorerie ; registre d'échéances soldé à l'ouverture de chaque saison, pour tous les clubs
- [x] Dix-huit agents se partagent le championnat : commission prélevée, relation qui se dégrade et s'estompe, blocage d'un dossier, sollicitations spontanées
- [x] Revalorisation en cours de contrat et résiliation à l'amiable, depuis la fiche du joueur
- [x] Surenchère : le nombre de clubs intéressés s'affiche avant l'offre, et l'un d'eux peut emporter la cible après les deux accords
- [x] Pré-contrats à six mois de l'échéance, dans les deux sens : on signe le joueur d'un autre, on perd le sien
- [x] Prêt avec option d'achat obligatoire ou facultative, levée sur les minutes réellement jouées, et rappel anticipé réservé à la crise de blessures

### ✅ V0.65 : Le playbook, la touche se dessine
- [x] Carnet de trois à cinq combinaisons de touche, nommées par le manager : alignement, créneau de sauteur, option, sauteur désigné
- [x] La combinaison s'appelle sur la position du ballon : on sort de ses vingt-deux, on va chercher l'essai dans les leurs
- [x] Une combinaison jouée plus d'une fois sur trois face à un adversaire qui prépare finit lue : conquête en baisse, maul étouffé, et le compte rendu le dit
- [x] Le dossier d'avant-match avertit avant le coup d'envoi, et le scout principal trouve là son premier usage offensif
- [x] Consignes individuelles : marquage d'un adversaire (qui coûte au marqueur), consigne au pied jugée sur la ligne défensive adverse
- [x] Plans A et B enregistrés, rappelés d'un clic, conservés dans la sauvegarde
- [x] Point neutre vérifié au dix-millième : sans carnet, la touche se joue exactement comme en V0.64

### ⬜ V0.9 — Bêta privée
- [ ] Init Tauri (binaire desktop)
- [ ] EULA + politique de confidentialité
- [ ] Décision juridique licence Top 14 (chemin A/B/C — voir [12-juridique.md](./design/12-juridique.md))
- [ ] 5-10 testeurs proches recrutés
- [ ] Sondage hebdo "qu'est-ce qui t'a fait revenir cette semaine ?"
- [ ] Itération polish selon feedback

### ⬜ V1.0 — Release
- [ ] Page Steam (capsules, screenshots, trailer 30s + 1min)
- [ ] Page Itch.io
- [ ] Build Steam soumis + validé
- [ ] Discord public ouvert
- [ ] Plan de support post-launch

## Couverture moteur (V0.5)

### Sous-systèmes match
| Sous-système | V0.1 | V0.13 |
|---|---|---|
| Mêlée | Score plat | Duel technique + dominance cumulée + mêlées simulées |
| Touche | Score plat | Philosophie pré-match + maul pénétrant |
| Ruck | Ratio simple | Ratio + sanctions pilotées par la discipline |
| Jeu courant | Score plat | **Chaîne porteur → défenseur**, 3-5 contacts par phase |
| Défense de ligne | *inexistante* | **Phase `GOAL_LINE` par attrition** |
| Jeu au pied | Place + tactique | Place avec buteur explicite et fatigue individuelle |
| Discipline | *inexistante* | **Pénalités pilotées par `discipline` / `agressivite`** |
| Banc | *inexistant* | **8 remplacements, fatigue individuelle, règles première ligne** |

### Système humain
| Pièce | Statut |
|---|---|
| Traits (catalogue + génération) | ✅ 30 traits |
| Mood (sources + traits modifiers) | ✅ 7 sources |
| Relations (graphe + évolution) | ✅ |
| Events humains | ✅ 5 types |
| Staff voix | ✅ 8 staff par club, voix dans live moments |

## Tests automatisés

**1201 tests, 86 fichiers.** `npm run test` les joue en quelques secondes.

Quelques familles, plutôt qu'une liste exhaustive qui périmerait aussitôt :

- **Moteur de match** — mêlée, touche, ruck, jeu courant, discipline, banc, cartons, arbitre, météo, public. Les tests de distribution tournent sur plusieurs centaines de matchs et n'affirment jamais un écart plus petit que le bruit de l'échantillon.
- **Saison et compétitions** — calendrier, classement, phases finales, deux divisions, montées et descentes, coupe d'Europe.
- **Système humain** — traits, moral unifié, relations, rivalités de vestiaire, conversations, promesses.
- **Carrière** — développement, centre de formation, prêts, honneurs, XV de France, registre de carrière, poste de sélectionneur.
- **Persistance** — aller-retour de sauvegarde, migration des anciens formats, et un test qui vérifie qu'aucun champ confié à la sauvegarde ne se perd en route.

## Outils CLI disponibles

```bash
npm run play -- 42 toulouse ubb -v        # match interactif déterministe
npm run play:stats -- toulouse usap 500   # 500 matchs simulés agrégés
npm run calibrate                         # 8000 matchs par scénario vs 12 cibles
```

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | dev server Vite (port 5173) |
| `npm run build` | build prod |
| `npm run test` | tests Vitest |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint + règles archi (moteur pur) |

## Métriques actuelles

- **14 clubs de Top 14** nominatifs, **16 clubs de Pro D2**, ~700 joueurs
- **Sauvegarde** : 705 Ko à la mi-saison 1, bornée par l'élagage des carrières achevées
- **30 traits** de personnalité en 5 catégories
- **Saison complète** simulable en moins d'une seconde
- **Calibration moteur** : 12/12 cibles vertes sur 8000 matchs par scénario
