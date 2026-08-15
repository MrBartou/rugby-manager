# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/). Versions sémantiques.

## [V0.63] : Le monde s'élargit

Le jeu se jouait dans un pays fermé. Trente clubs français, un vivier français,
et aux frontières deux trous : les adversaires européens étaient **régénérés à
chaque saison** (quatre inconnus tirés au sort en septembre, oubliés en mai),
et les matchs du XV de France étaient un score **estimé**, sans un plaquage ni
un essai derrière.

Cette version donne à l'extérieur ce que le championnat a depuis la V0.9 : de la
mémoire, et des conséquences.

### Ajouté

- **Trente-deux clubs européens qui durent** (`season/european-world.ts`). Ils
  existent en dehors de nous : ils gardent leur effectif, dérivent de niveau
  d'une saison à l'autre, montent en coupe majeure ou en redescendent, et
  gagnent des titres. Battre Ballymore en poule veut enfin dire quelque chose,
  parce que Ballymore était là l'an dernier et sera là l'an prochain.
- **Le palmarès européen, historisé.** Deux vainqueurs par saison, **y compris
  les années où le club dirigé n'y jouait pas**. Jusqu'ici personne ne
  remportait la coupe d'Europe ces années-là. Consultable au palmarès de
  carrière : les finales année par année, et le classement des clubs par titres.
- **Un marché international** (`club/international-market.ts`) : un vivier
  anglo-celte et hémisphère sud, meilleur à prix égal que le marché français, et
  **non-JIFF**. C'est le premier endroit du jeu où recruter coûte une place sur
  la feuille de match.
- **Une vente à l'étranger.** Les clubs européens viennent chercher les
  meilleurs et paient environ un tiers au-dessus d'une offre française
  comparable. Le joueur qui part perd le maillot bleu (`Player.abroad`) : c'est
  la règle française des expatriés, et c'est ce qui fait de l'offre une
  décision plutôt qu'un encaissement.
- **Les tests internationaux, joués par le moteur.** Deux feuilles de
  vingt-trois, quatre-vingts minutes simulées, contre des sélections qui durent
  elles aussi (`season/national-opponent.ts`).
- **Trois entrées d'encyclopédie** : marché international, expatrié, sélection.

### Modifié

- **Une cape se gagne sur la feuille, plus dans le groupe.** On en comptait une
  par joueur convoqué : le vingt-huitième homme d'un groupe de trente-trois
  rentrait chez lui avec cinq sélections sans avoir quitté la tribune.
- **La fatigue de sélection suit les minutes disputées**, au lieu d'un forfait
  par match de la fenêtre. Cinq matchs pleins et dix minutes en fin de Tournoi
  ne se paient plus pareil.
- **Un international revient avec des statistiques.** Sa fiche disait « douze
  sélections » et rien d'autre ; elle dit maintenant ce qu'il y a fait. Ces
  totaux restent séparés de ceux du championnat : un essai en bleu n'entre pas
  au classement des marqueurs du Top 14.
- **Les blessures en bleu existent.** Elles arrivent au club par une porte qu'il
  ne contrôle pas : c'est le revers d'avoir cinq internationaux.
- **La fabrique de joueurs étrangers est unique** (`season/foreign-players.ts`).
  Elle vivait dans `data/`, au service du seul adversaire européen. Trois
  usages en avaient besoin cette version : la recopier trois fois était la faute
  que ce projet a déjà payée trois fois.

### Retiré

- **`playWindow`**, qui estimait un résultat international à partir d'un écart
  de force. Les matchs se jouent : garder les deux aurait laissé deux réponses à
  la question « qu'a fait la France en novembre ».

### Notes de modélisation

- **On persiste une identité, pas sept cent trente-six joueurs.** Un club
  européen garde son nom, son niveau, sa forme, son palmarès et une graine
  d'effectif ; ses vingt-trois joueurs sont reconstruits à l'identique depuis
  cette graine. Les stocker ferait plus que doubler une sauvegarde pour une
  information que le manager voit quatre-vingts minutes par an, et que la
  reconstruction rend de toute façon identique. Ce qu'on ne peut pas modéliser
  ainsi, leurs blessures et leur forme individuelle, n'a jamais existé : aucun
  match entre clubs étrangers n'est simulé.
- **Un effectif persistant doit vieillir sans devenir immortel.** Chaque poste
  se renouvelle tous les six ans, décalé d'un poste à l'autre : environ quatre
  joueurs changent par saison. Sans le décalage, les vingt-trois partiraient à
  la retraite le même été ; sans le renouvellement, on affronterait des piliers
  de quarante-deux ans à la vingtième saison.
- **Le parcours réel du club dirigé prime sur le tableau.** Le reste de la coupe
  est résolu à l'écart de niveau, mais on ne va pas faire perdre en quart de
  finale une coupe que le manager vient de gagner sur le terrain.
- **Le continent a besoin d'un rappel vers la moyenne.** Vingt saisons de dérive
  aléatoire écrasent trente-deux clubs contre les bornes : tout le monde à 88 ou
  tout le monde à 38, et plus aucun tirage intéressant. Un test déroule vingt
  saisons et vérifie que l'écart tient.
- **Trois portes pour signer un étranger, et il faut passer les trois** : le
  club vendeur veut son indemnité, le joueur veut son salaire, et il veut un
  club à sa hauteur. C'est la troisième qu'on oublie en écrivant un marché :
  sans elle, un promu signe un All Black dès qu'il en a les moyens.
- **Une nation adverse ne se simule que quand la France joue.** Personne ne
  regarderait Italie-Écosse, et le classement du Tournoi se lit très bien dans
  les cinq résultats français.

### Vérification

1454 tests verts, typecheck, lint et build propres, calibration 12/12. Le
moteur de match n'a pas bougé, seuls ses appelants ont changé.

## [V0.62.1] : La passe de rattrapage sur le design

Les trois nouveautés de la V0.62 ont été livrées fonctionnelles et laides. Ce
correctif reprend leur mise en forme, et surtout la cause commune : le thème
clair ne pouvait pas fonctionner.

### Corrigé

- **185 couleurs étaient écrites en dur** dans la feuille de style, en valeurs
  du thème sombre : surfaces, ombres, voiles d'élévation, teintes des deux
  camps, or des trophées. Le thème clair repeignait les variables, mais la
  moitié de l'interface ne les lisait pas. Tout passe désormais par elles.
- **Le voile des fenêtres modales s'éclaircissait avec le thème** : il lavait la
  page au lieu de la mettre en retrait, et la fenêtre ne ressortait plus. Un
  voile reste sombre dans les deux thèmes.
- **Le titre de chaque écran devenait invisible en thème clair** : son dégradé
  allait du blanc au gris, pensé pour un fond sombre.
- **Le bandeau de club restait noir** au-dessus d'une page blanche.
- **Deux teintes tombaient sous le seuil de contraste AA** en thème clair,
  mesurées : les libellés secondaires à 4,31 et l'accent employé comme texte à
  3,19. Corrigées à 4,69 et 5,23.
- **L'écran de réglages se réduisait à 359 pixels de large** sur un écran de
  1280 : dans une colonne flex, il prenait la largeur de son contenu le plus
  étroit. C'est ce qui lui donnait son air compressé.
- **L'aide s'ouvrait sous les fenêtres d'événement**, alors qu'on l'ouvre
  justement quand on ne comprend pas ce qu'une fenêtre demande.
- **Le numéro de version affiché ne bougeait pas en développement** : il est
  figé au chargement de la configuration de Vite, qui ne surveille que son
  propre fichier. Le `package.json` est désormais surveillé aussi.

- **L'écran d'entraînement plaçait ses panneaux dans l'ordre du code.** Cinq
  d'entre eux y avaient été ajoutés au fil de six versions sans que personne ne
  resitue les suivants : l'effectif, tableau de vingt-huit lignes qui est le
  travail même de l'écran, avait fini dans la colonne étroite, à 270 pixels de
  large et 1428 de haut, sous un panneau de délégation qui occupait la hauteur
  d'un écran entier.
- **Quatre couleurs du thème clair étaient sous le seuil AA** dans leur emploi
  réel, mesurées : le vert des indicateurs à 2,66, le jaune à 2,89, le rouge et
  le bleu à peine au-dessus de 4. Les libellés secondaires retombaient à 4,05
  sur les fonds enfoncés, que la première correction n'avait pas regardés.

### Modifié

- **L'écran de réglages** : des groupes titrés qui se distinguent, de l'air
  entre les lignes, une colonne de contrôles alignée, et des interrupteurs
  dessinés à la place des cases à cocher natives.
- **L'encyclopédie** passe de dix à vingt entrées, rangées par thème. Chaque
  entrée s'ouvre sur une phrase avant le paragraphe, et renvoie aux notions
  voisines d'un clic.
- **L'entraînement** est rangé en zones nommées : le tableau tient la colonne
  large, les décisions se rangent dans une colonne latérale, les espoirs passent
  en pleine largeur. Le tableau gagne un bilan de rotation en tête (bien
  employés, trop peu joué, hors rotation, au repos), un en-tête qui reste
  visible, une jauge de temps de jeu avec son repère à 1200 minutes, et le même
  interrupteur que les réglages pour le repos.
- **Le marché des techniciens** s'ouvre en fenêtre, où les fiches se comparent
  côte à côte, au lieu d'un accordéon dans un panneau de trois cents pixels.

### Notes de modélisation

- **Un glossaire s'ouvre pour débloquer une décision, pas pour s'instruire.**
  D'où la phrase courte en tête de chaque entrée, avant la définition. Et d'où
  les renvois : un terme de rugby en appelle toujours un autre.
- **Redessiner un contrôle ne doit pas revenir à en construire un qui n'obéit
  qu'à la souris.** L'interrupteur garde l'`input` natif sous le rail dessiné :
  il porte le clavier, le libellé et l'état coché.
- **Une grille qui laisse tomber ses enfants là où ils viennent se dérègle à
  chaque ajout.** Une grille nommée refuse le nouvel arrivant tant qu'on ne lui
  a pas dit où il va : c'est la seule raison pour laquelle l'écran
  d'entraînement a pu dériver pendant six versions sans que rien ne casse.
- **Le pire cas d'une couleur n'est pas le fond blanc.** Un indicateur s'affiche
  presque toujours en pastille, c'est-à-dire en texte plein sur une teinte à
  12 % de lui-même : le fond se rapproche alors du texte au lieu de s'en
  éloigner. Un test refait le calcul du WCAG sur les quatre fonds du thème et
  leurs quatre pastilles, palette daltonienne comprise.
- **Une mesure prise dans le même tick qu'un changement de thème ne vaut
  rien**, et une mesure de géométrie prise pendant que le panneau du navigateur
  est masqué non plus : la fenêtre fait alors zéro pixel de large. Deux fausses
  pistes suivies avant de m'en apercevoir.

## [V0.62] : Réglages, accessibilité, délégation

Aucun écran de réglages n'existait. Les trente-deux animations tournaient pour
tout le monde, un joueur qui distingue mal le rouge du vert n'avait aucun recours
devant les liserés de la composition, et le troisième pilier du GDD, déléguer à
son staff ce qu'on ne veut pas gérer, n'avait jamais été implémenté.

### Ajouté

- **Un écran de réglages** ([ui/settings.ts](../src/ui/settings.ts)) : vitesse de match par défaut, sauvegarde automatique, confirmations, volume (préparé pour la V0.69). Atteignable depuis l'écran titre comme en cours de partie.
- **L'accessibilité** : animations réduites (respectant `prefers-reduced-motion` d'emblée), quatre tailles de texte, palette daltonienne, thème clair.
- **La délégation au staff** ([club/delegation.ts](../src/engine/club/delegation.ts)) : composition, remplacements, focus d'entraînement, offres mineures. Quatre cases à cocher, rien de délégué par défaut, et tout se reprend d'un clic.
- **L'encyclopédie** ([ui/encyclopedia.ts](../src/ui/encyclopedia.ts)) : dix entrées (JIFF, salary cap, commission, bonus, phases finales, joker médical, fenêtres de mercato, feuille de match, barrage d'accession, note de match), ouvertes depuis n'importe quel écran sur le terme qu'on y rencontre.

### Modifié

- **Le contrôle de la commission a quitté l'interface** ([club/regulations.ts](../src/engine/club/regulations.ts)) : il décidait des points retirés, des interdictions et des amendes de toute une division depuis un composant React.
- **La promotion des jeunes aussi** ([season/rollover.ts](../src/engine/season/rollover.ts)) : la boucle porte deux règles, tous les clubs reçoivent leur promotion et seul le centre du club dirigé suit l'investissement du manager.
- **La clôture d'exercice également** ([club/finances.ts](../src/engine/club/finances.ts)) : le club dirigé encaisse selon sa politique commerciale, les autres gardent l'enveloppe sèche de leur budget.

### Corrigé

- **Cinquante-deux lignes de couleurs écrites en dur** court-circuitaient les variables CSS, dont les liserés d'aptitude de la composition : c'est exactement l'exemple que la roadmap citait, et le réglage de palette n'y aurait rien changé.
- **La minute passée à l'adjoint était divisée deux fois.** La session expose déjà des minutes, le compteur en secondes est interne : l'adjoint serait resté figé à la première minute et le banc ne serait jamais entré. Trouvé en lisant le code de la session avant de le brancher, pas après.
- **La palette daltonienne confondait deux de ses trois états** en thème clair : le jaune et l'orange se ressemblaient trop, et l'échelle à trois crans redevenait une échelle à deux.

### Notes de modélisation

- **Déléguer coûte quelque chose.** L'adjoint décide comme un adjoint : sa compétence fixe la qualité de ce qu'il choisit, et le facteur ne dépasse jamais un. Déléguer ne peut pas rendre meilleur que décider soi-même, sans quoi le jeu se jouerait tout seul.
- **Une offre sur un cadre remonte toujours au manager**, quoi qu'il arrive. Déléguer les petites décisions ne doit jamais faire partir un titulaire dans votre dos.
- **La compo déléguée porte les erreurs de son auteur.** Le quinze proposé par défaut a toujours été le meilleur possible : sans cette imperfection, déléguer la composition n'aurait rien changé et la case aurait été un décor. L'adjoint se trompe sur la hiérarchie, jamais sur le poste, et le manager garde la main.
- **Personne ne sort avant l'heure de jeu.** Vider son banc à la vingtième minute n'est pas une délégation, c'est un sabotage. Un adjoint dépassé laisse en outre ses joueurs s'épuiser plus longtemps avant de réagir.
- **Une préférence suit le joueur, une délégation suit la carrière.** Le confort de lecture ne doit pas se réinitialiser parce qu'on démarre une partie ; confier sa composition à son adjoint, si, puisque cet adjoint reste au club qu'on quitte.
- **`prefers-reduced-motion` est respecté d'emblée.** Un joueur sujet au mal des transports ne devrait pas avoir à découvrir un écran de réglages pour cesser d'être malade.
- **Une entrée d'encyclopédie dit ce que le mot implique**, pas seulement ce qu'il désigne, et annonce les écarts assumés avec le règlement réel. Laisser un connaisseur découvrir l'écart lui ferait croire à un défaut.

### Reporté

- **L'orchestration de l'intersaison.** Ses trois derniers blocs de règles (commission, promotion des jeunes, clôture financière) sont partis au moteur, après le verdict de fin de saison en V0.61. Ce qui reste dans `App.tsx` ne décide plus rien : appeler le moteur, publier des actualités, écrire dans une trentaine de références React. Le sortir demanderait une abstraction de rollover dont le seul bénéfice serait esthétique, et ce n'est plus une dette de règles. Le sujet est clos sous cette forme.

## [V0.61] : La donnée parle

Le moteur capture treize statistiques individuelles par rencontre depuis la
V0.13. Elles n'ont jamais servi qu'à des agrégats de fin de saison. Après un
match, le manager lisait un score, un récit, et rien qui lui dise qui avait tenu
son poste. Le meilleur rapport entre l'effort et l'effet du rattrapage : la
donnée existe déjà, il manquait de quoi la lire.

### Ajouté

- **La note du joueur, sur dix** ([match/player-rating.ts](../src/engine/match/player-rating.ts)), et **l'homme du match**. Affichées sur la feuille de statistiques, qui se trie désormais par note.
- **Une vue statistiques de l'effectif** : mètres, défenseurs battus, franchissements, plaquages, grattages, essais, minutes. Tout était calculé depuis la V0.13 et n'apparaissait nulle part.
- **Les classements individuels du championnat** ([season/leaderboards.ts](../src/engine/season/leaderboards.ts)) : meilleurs marqueurs, meilleures notes, mètres, plaquages, ballons grattés. Sous la table du championnat, clubs adverses compris.
- **La fiche d'un club** ([ui/screens/ClubScreen.tsx](../src/ui/screens/ClubScreen.tsx)) : classement, forme, stade, masse salariale, âge moyen, confrontations, effectif. On croisait un adversaire quatorze fois par saison sans jamais pouvoir l'ouvrir.
- **Le comparateur** : deux ou trois joueurs face à face, saison et attributs.
- **La liste de suivi** ([club/shortlist.ts](../src/engine/club/shortlist.ts)) : garder un joueur à l'œil sans consommer de créneau d'observation, avec les alertes qui comptent (libre, fin de contrat, dernière année, changement de club, blessure longue).
- **Ce qui s'ouvre se signale** : une ligne de classement mène à la fiche du club, un billet du fil à son club ou au joueur dont il parle, un gros salaire à sa fiche, une ligne de classement individuel au joueur.

### Modifié

- **Le verdict de fin de saison a quitté l'interface** ([season/season-verdict.ts](../src/engine/season/season-verdict.ts)). Archives, objectif, réputation, confiance du président, limogeage et ligne de parcours : ces règles décident du sort du manager et vivaient dans un composant React, mêlées à la publication des actualités et à la mise à jour d'une trentaine de références. Elles sont désormais dans le moteur, et testées.

### Corrigé

- **Le classement des notes se calculait sur le mauvais dénominateur.** Vu en jeu sur une partie reprise : les notes n'existaient que depuis une journée, le compteur de matchs en affichait treize, et une moyenne tirée d'une seule rencontre trônait en tête. Le seuil de présence porte maintenant sur les matchs **notés**, c'est à dire sur ce qui fait la moyenne.
- **La fiche club lisait la familiarité du scouting à la mauvaise échelle** (de 0 à 1 au lieu de 0 à 100) : tout adversaire affichait son niveau chiffré, et le club dirigé se voyait attribuer une connaissance quasi nulle de ses propres joueurs. Deux erreurs de la même origine.

### Notes de modélisation

- **La note est un rang, pas un barème.** Mesuré sur 400 rencontres : le moteur crédite 1,09 plaquage et 1,5 mètre par match à un pilier, 0,21 essai à un trois-quarts. C'est très en dessous du rugby réel, parce que l'attribution nominative ne récompense que le porteur et le plaqueur de la phase résolue. **La moitié des joueurs ne produit rien de mesurable dans un match donné.** Une note bâtie sur une échelle inventée aurait été du bruit habillé en chiffre. On situe donc la contribution dans la distribution mesurée **de sa ligne** : 6 est la médiane du poste, 7,5 le neuvième décile, 9 le centième. Le chiffre dit quelque chose de vérifiable.
- **Dix n'existe pas.** La note s'approche de 9,9 par une asymptote : un match exceptionnel ne doit pas se confondre avec un match record, et une copie parfaite n'existe pas.
- **L'homme du match peut être un vaincu.** Le bonus de résultat, un quart de point, penche vers le vainqueur sans l'imposer : mesuré, 14 % des distinctions vont au camp perdant. Un titre qui suivrait mécaniquement le score ne dirait rien du joueur.
- **Une fourchette ne se compare pas.** Le comparateur ne désigne un meilleur que lorsque les estimations ne se chevauchent pas. Trancher entre « 68–81 » et « 72–85 » serait inventer une précision que le scouting n'a pas rapportée.
- **Suivre n'est pas observer.** La liste de suivi n'apprend rien sur un joueur : elle veille. Les confondre aurait vidé le scouting de son intérêt, puisqu'il suffirait de mettre en liste pour savoir.
- **La note de saison est une dérivée.** On stocke la somme des notes et le nombre de matchs notés, jamais la moyenne : une moyenne écrite en dur ne se met pas à jour sans se dénaturer. Ce projet a déjà payé trois fois le prix de deux sources de vérité pour la même donnée.

### Reporté

- **L'extraction complète de l'intersaison.** Le verdict de fin de saison, qui en était le bloc de règles le plus dense, est parti au moteur. Ce qui reste dans `App.tsx` est de l'orchestration : appeler le moteur, publier des actualités, écrire dans une trentaine de références React. L'extraire demande de concevoir une abstraction de rollover à part entière, avec ses entrées et ses sorties, ce qui reste un chantier de version. Reporté en V0.62.

## [V0.60] : Fondations, le monde tient vingt saisons

Cinquante-neuf versions ont ajouté des règles. Celle-ci vérifie qu'elles tiennent
sur la durée. Le point de départ est l'audit de la roadmap, complété par ce que
le jeu a révélé quand on a cessé de le regarder journée par journée : un
championnat qui se fige, une sauvegarde qui s'efface, des règles qu'on peut
contourner sans le vouloir.

### Corrigé : le championnat va jusqu'au bout

- **Un retrait de points effaçait le classement.** L'intersaison ne transmet que les clubs sanctionnés, sous forme d'ajustements ; la session prenait cette liste pour la table entière. Tous les matchs de la saison suivante étaient alors ignorés en silence, et la J27 plantait sur un « top 6 incomplet ». Déclenchable dès qu'un club écope d'un retrait.
- **Recharger en phases finales détruisait la phase finale.** Les tableaux ne sont pas sauvegardés et n'étaient reconstruits qu'à la journée qui les concerne : une partie chargée en demies trouvait des barrages vides, ne composait aucune demie et se terminait sans champion. Ils se régénèrent désormais en cascade, à l'identique, depuis le classement et l'historique.
- **Une finale nulle ne désignait personne.** Le règlement des phases finales tranche par le classement de la saison régulière ; le moteur avait trois tranchages différents, dont un qui laissait le titre vacant.
- **Une saison sans titre décerné ne laissait aucune trace** : ni archive, ni verdict du président, ni réputation mise à jour. Tout le bilan de fin d'année vivait sous un `if (champion)`.
- **La récidive DNCG s'armait sur un simple avertissement**, ce qui accélérait le retrait de points ci-dessus. Seule une sanction réelle la déclenche.

### Corrigé : les règles ne se contournent plus

- **Simuler la journée de trêve alignait vos internationaux partis en sélection.** La composition automatique n'avait aucun moyen de connaître les absents : exploit direct, et gratuit.
- **La compo de secours rappelait blessés, suspendus et retraités** dès qu'un poste manquait de titulaire, parce que ses replis puisaient dans l'effectif brut. Elle posait au passage **deux brassards de capitaine**, à l'ouvreur et au demi de mêlée, ce qui n'existe pas sur un terrain.
- **Le joker médical ne proposait jamais personne** : il cherchait des joueurs libres dans les effectifs des clubs, c'est à dire là où ils ne peuvent par définition pas se trouver. Fonctionnalité morte depuis sa livraison.
- **L'interdiction de recruter ne bloquait que les agents libres.** Une offre payante ou un joker passait à côté : un club sanctionné pouvait recruter à condition de payer. Le contrôle est descendu dans le moteur, à toutes les portes d'entrée.
- **Le prêt était décoratif** : la part de salaire négociée ne servait qu'à l'affichage, le club prêteur payait cent pour cent. Elle allège désormais réellement la feuille de paie, et un prêt ne se conclut plus marché fermé.
- **La proposition du XV de France était quasi inatteignable**, prisonnière de deux `if` imbriqués qui exigeaient sabbatique, limogeage et offre reçue le même jour.

### Corrigé : la sauvegarde ne se perd plus

- **Une sauvegarde corrompue effaçait toutes les parties, définitivement.** Une seule entrée mal formée renvoyait un stockage vide, et l'auto-save suivante réécrivait le tout par-dessus : la perte devenait irréversible en une journée de jeu. La lecture se fait entrée par entrée, ce qu'on ne sait pas lire est conservé tel quel, et une copie de secours est prise avant chaque écrasement.
- **Le stockage plein n'était pas géré à l'écriture** : « Échec de la sauvegarde », sans cause ni remède.
- **Le tampon de format était figé à `0.5.0` depuis la V0.31**, alors que le contenu avait évolué jusqu'en V0.58. Une sauvegarde écrite par une version postérieure était chargée puis re-tamponnée sans contrôle ; elle est désormais reconnue, laissée intacte et signalée.
- **La sauvegarde grossissait sans borne.** Mesuré : 880 octets par joueur, 705 Ko dès la première saison, et les retraités conservés à vie. Les retraites anciennes sont réduites à un identifiant quand les données de base savent les reconstruire, et les carrières achevées sont repliées en une ligne par club, totaux et records préservés à l'unité près.
- **Aucun ErrorBoundary** : la moindre exception de rendu était une page blanche définitive, sans message et sans possibilité de sauvegarder.
- **État perdu au rechargement** : décisions de vestiaire en attente, retouches du groupe France, retraits de points, bancs vacants.

### Corrigé : deux divisions, deux calendriers

- **La division non jouée se vidait** : vieillissement et retraites s'appliquaient partout, mais la promotion des jeunes et le mercato ne tournaient que dans la division du manager. En quelques saisons, l'autre étage n'avait plus d'effectifs.
- **Les salaires de Pro D2 n'étaient facturés que 26 journées sur 30**, soit 15 % de masse salariale offerte à toute la division.
- **La fenêtre de mercato hivernal était figée à J13-J16**, le milieu du Top 14 et pas celui d'une Pro D2 qui joue trente journées.
- **Deux billetteries coexistaient** : le club dirigé encaissait selon son stade et sa politique tarifaire, les clubs IA selon un billet à trente euros en dur. Les recettes du championnat n'étaient pas comparables entre elles.

### Corrigé : une seule vérité

- **`StaffMember`, `SeasonState` et `ClubStanding` étaient définis deux fois** : une fois pour de vrai, une fois dans un squelette de réducteur d'événements de V0.1 que rien n'a jamais construit. Le squelette est retiré.
- **L'ancienne sélection nationale** (trois JIFF par club, quarante-deux joueurs pour une équipe de quinze) vivait encore à côté du vrai XV de France livré en V0.58.
- **Trois champs jamais écrits ni lus** retirés : `Contract.releaseClause`, `Contract.performanceBonus`, `PreMatchTacticalPlan.targetingStrategy`.
- **Le temps de jeu qui alimente le moral était factice** : trois valeurs codées en dur selon la place dans une composition automatique, au lieu des minutes réellement disputées.
- **L'en-tête annonçait « Alpha V0.10 »** cinquante versions plus tard. La version affichée vient maintenant du `package.json`.
- **`pixi.js` et `zustand` étaient déclarés sans être jamais importés.**
- **Le barrage d'accession retirait trois points au visiteur** pour éviter le nul, ce qui pouvait afficher un score négatif et faire descendre un club sur un 0-0.

### Notes de modélisation

- **Un club aligne toujours quinze joueurs.** Trouvé en jeu, dès la première trêve : écarter d'un coup blessés, suspendus et internationaux d'un effectif de dix-sept descendait sous quinze, et la journée levait une exception non rattrapée. L'indisponibilité se relâche donc par degrés (d'abord les valides, puis les sélectionnés, en dernier ressort les blessés) et l'on préfère un valide hors de son poste à un blessé dans le sien. Le banc, lui, reste réservé aux joueurs réellement disponibles : un club décimé se présente à quinze plutôt que d'asseoir un blessé.
- **Ce qu'on ne sait pas lire, on ne l'efface pas.** Une entrée abîmée ou trop récente est conservée octet pour octet et remise en place à l'écriture suivante. Le stockage n'est jamais réécrit en n'y remettant que ce qu'on a compris.
- **Le plafond de phases a été mesuré, pas supposé** : 75 phases en médiane, 80 au maximum sur 500 matchs, contre une limite de 250. Elle reste un garde-fou contre une boucle infinie, jamais une contrainte de jeu.

### Reporté

- **L'extraction de l'intersaison vers le moteur** reste à faire. L'audit visait ~400 lignes de règles métier dans `App.tsx` ; l'inspection montre que les règles elles-mêmes (retraites, développement, promotion des jeunes, mercato, montées et descentes, sanctions, chantiers) sont **déjà** dans le moteur et appelées depuis l'interface. Ce qui reste est de l'orchestration et des effets de bord sur une trentaine de références React. L'extraire proprement demande de concevoir une abstraction de rollover à part entière : c'est un chantier de version, pas une ligne de nettoyage. Reporté en V0.61, sans rien perdre de ce que l'audit avait relevé.

## [V0.59] — La mémoire longue

Le jeu accumule depuis longtemps tout ce qu'il faut pour raconter une carrière :
un centre de formation (V0.39), des prêts (V0.55), une progression qui se paie
en minutes (V0.14), des honneurs individuels (V0.53), des capes (V0.58). Et la
fiche d'un joueur ne montrait **que la saison en cours**. Le jeu long n'avait
pas de mémoire, donc pas de récompense.

### Ajouté

- **Le registre de carrière** ([season/player-career.ts](../src/engine/season/player-career.ts)) : une ligne par saison et par club — matchs, minutes, essais, capes gagnées, honneurs, prêts. Affiché sur la fiche du joueur, totaux compris.
- **Les records du club** s'en dérivent : meilleurs marqueurs, et le plus de matchs sous le maillot. Ils lisaient auparavant un cumul tenu à part.
- **Un hommage au moment de raccrocher** : un joueur du club qui prend sa retraite reçoit un courrier qui chiffre ce qu'il a réellement fait — et salue une carrière entière au même club, quand c'en est une.
- **Le banc du XV de France** ([season/national-job.ts](../src/engine/season/national-job.ts)) : la fédération approche un manager titré, installé et réputé. Le poste **ne se cumule pas** — accepter, c'est quitter son club pour sept matchs par an.
- **L'écran du sélectionneur** : le groupe proposé au mérite, que le manager retouche joueur par joueur ; les résultats des fenêtres ; et le Top 14 qui se joue sans lui. Un bilan de fin de saison jugé sur le Tournoi, avec renvoi au deuxième échec consécutif.

### Corrigé

- **`careerBook` n'était pas sauvegardé** alors que le champ existait. `buildSeasonSaveFromState` recopie ses extras **champ par champ** : déclarer un champ sans ajouter sa ligne compile parfaitement et produit une sauvegarde silencieusement incomplète. Découvert en jouant une intersaison entière puis en inspectant le stockage — un test le verrouille désormais pour tous les extras.
- **Les capes d'une saison étaient déduites du cumul de carrière**, qui contient le passé estimé au démarrage : une seule saison se voyait attribuer cinquante-quatre sélections dans un monde qui en joue sept. La session, recréée chaque intersaison, compte désormais les capes de l'année directement.
- **L'objectif affiché à la création de carrière** était dérivé du seul budget du club, quand le board en annonçait un autre au coup d'envoi : Brive promettait « Maintien » sur l'écran de choix et « Accession » une minute plus tard. Les deux écrans appellent maintenant la même fonction.
- **Une sauvegarde antérieure à la V0.56 gardait une Pro D2 à quatorze clubs** pour toujours : la promotion échange un club contre un club, personne n'ajoutait jamais les deux manquants. Les clubs absents sont réintégrés au chargement.
- **La fin de `docs/STATUS.md` était périmée** — elle annonçait 579 tests et 9/12 à la calibration, contre 1201 et 12/12.

### Notes de modélisation

- **Une seule source, pas deux.** `playerCareerStats` cumulait essais et matchs à côté du nouveau registre : il a été **supprimé** plutôt que conservé en parallèle. Ce projet a déjà payé trois fois le prix de deux sources de vérité pour la même donnée (V0.53, V0.54, V0.55). Les totaux se dérivent des lignes de saison, jamais l'inverse.
- **Une saison blanche n'est pas consignée.** Un joueur blessé toute l'année ne laisse pas une ligne de zéros dans son palmarès : c'est un registre de ce qui s'est passé, pas un calendrier. Une saison sans match mais avec une sélection, en revanche, compte.
- **La reprise d'un cumul antérieur n'invente pas de découpage.** Les sauvegardes d'avant la V0.59 ne portent qu'un total : il est consigné en une ligne unique, minutes à zéro, plutôt que réparti sur des saisons plausibles. Admettre qu'on ne sait pas vaut mieux que fabriquer une histoire.
- **Le poste de sélectionneur est rare et perdable.** Réputation ≥ 72, quatre saisons de métier, au moins un titre, et un poste vacant. Deux Tournois manqués de suite y mettent fin : un poste dont on ne peut pas tomber n'est pas un poste, c'est un décor.

## [V0.58] — Le XV de France, et ce que le public change

Les trêves internationales existent depuis la V0.8, et une sélection n'y avait
jamais été autre chose qu'une **absence** : les trois meilleurs JIFF de chaque
club — quarante-deux joueurs pour une équipe de quinze — disparaissaient deux
journées, revenaient, et rien n'avait changé. C'est pourtant l'un des deux
horizons d'une carrière de joueur français, et la seule chose qu'un club puisse
offrir qu'un autre ne peut pas acheter.

### Ajouté

- **Le XV de France** ([season/national-team.ts](../src/engine/season/national-team.ts)) : un sélectionneur compose un groupe de trente-trois **avec des quotas par poste** — cinq piliers, trois talonneurs, deux arrières. Un groupe pris au classement des mieux notés partait au Tournoi sans première ligne de rechange.
- **Ce qui décide d'une sélection** : le niveau, la forme, le **temps de jeu** (le premier critère qu'un sélectionneur énonce en conférence de presse), l'âge, et les capes — qui rassurent sans donner de droit acquis.
- **Les capes comptent et se cumulent**, saison après saison, et s'affichent sur la fiche du joueur. Une première sélection est signalée comme telle, une fois.
- **Le monde a un passé** : les capes d'avant la première journée sont estimées à partir du niveau et de l'âge. Sans cela, la carrière commençait dans un monde où Antoine Dupont n'avait jamais porté le maillot.
- **Les matchs se jouent** — deux tests d'automne, cinq matchs du Tournoi — et leurs résultats arrivent dans le fil d'actualité, avec le bilan de la fenêtre.
- **La sélection se paie** : les internationaux reviennent avec de la fatigue accumulée, et le vestiaire l'entend — une sélection est une reconnaissance, une première sélection plus longtemps qu'une routine.
- **Le public entre dans le moteur** ([match/crowd.ts](../src/engine/match/crowd.ts)) : le remplissage du stade devient un niveau d'affluence qui module l'avantage du terrain. Il s'affiche avant le match, chiffré et qualifié.
- **Les statistiques de saison survivent au rechargement**, avec le compteur de matchs qui leur sert de dénominateur.

### Corrigé

- **`homeFans` était le huitième champ mort du projet.** Déclaré sur chaque feuille de match depuis la V0.1, lu nulle part. L'affluence se calculait pourtant depuis la V0.45 — mais son effet sur la rencontre était replié dans un `tacticalBonus` bricolé côté interface. Deux problèmes en un : le moteur ignorait le public, et l'interface calculait un effet de jeu, ce qui n'est pas son travail.
- **`seasonPlayerStats` n'était pas sauvegardé.** Recharger une partie à la vingtième journée remettait tout le monde à zéro match : le classement des marqueurs se vidait, le développement des jeunes perdait les minutes qui le pilotent depuis la V0.14, les honneurs de fin de saison jugeaient sur une demi-saison, et le temps de jeu des rivalités (V0.56) repartait de zéro.
- **Le vivier de la sélection ne contenait que la division jouée.** Trouvé en jeu : un manager de Pro D2 voyait le sélectionneur composer le XV de France uniquement parmi les clubs de deuxième division, et sept joueurs de Brive partaient affronter la Nouvelle-Zélande. `allClubs` porte le championnat qu'on joue — ce qui est juste pour le championnat et faux pour une sélection nationale.

### Notes de modélisation

- **La sélection est déterministe.** À effectifs et forme identiques, la même liste : un manager doit pouvoir comprendre pourquoi son joueur n'y est pas, et agir dessus. Le hasard n'a pas sa place dans une sélection.
- **Un joueur dont on ne suit pas le championnat est une inconnue, pas un remplaçant.** Le temps de jeu n'est mesuré que dans la division jouée ; ailleurs, on suppose un temps de jeu ordinaire plutôt que zéro — sinon une division entière serait écartée pour une information qu'on n'a simplement pas.
- Le module **ne simule pas** les rencontres internationales phase par phase : il faudrait cinq effectifs étrangers complets pour une information qui tient en une ligne de score. Même arbitrage que `loans.ts` pour un joueur prêté. Mesuré sur 2 000 matchs : une France à 85 marque 29,7 points de moyenne et en encaisse 15,9, sans gagner mécaniquement.
- Le rythme des capes est **plafonné au nombre de matchs que ce monde joue** — sept par saison. Sans ce plafond, la formule attribuait onze capes par an au meilleur joueur du pays, et Dupont démarrait à quatre-vingt-treize sélections, plus qu'une carrière entière n'en permet ici.
- **`MOYEN` est un point neutre exact** pour le public : c'est la valeur que porte la fixture du harnais de calibration, qui reste donc valide par construction. Même procédé que la météo (V0.51) et l'arbitre (V0.52). Calibration verte, 12/12.
- Un test comparait deux niveaux d'affluence voisins sur quatre cents matchs et affirmait une différence plus petite que le bruit de l'échantillon — la même erreur qu'en V0.51. Il ne compare plus que les deux extrêmes, sur mille cinq cents matchs, et le commentaire dit pourquoi.
- **Vérifié en jeu** : à Toulouse, quinze joueurs du club dans le groupe France (Baille, Dupont, Ntamack, Ramos…), la liste publiée dans l'actualité, Dupont à cinquante-six sélections sur sa fiche avec le modificateur de moral actif, et « Stade plein — 18 810 / 19 000 · 99 % » avant de recevoir Clermont. À Brive, en Pro D2 : aucun sélectionné, ce qui est exactement le résultat attendu.

## [V0.57] — On voit enfin un match de rugby

Six versions de suite ont réparé de la mécanique invisible. Celle-ci s'occupe
de ce qu'on regarde. Le constat de départ : le match se déroulait déjà phase par
phase, avec le score, le chrono, l'élan et les remplacements en direct — mais
**le terrain était vide**, seul le ballon s'y déplaçait. Et la composition, l'écran
qu'on ouvre avant chaque rencontre, était un tableau de quinze listes
déroulantes.

### Ajouté

- **La composition se fait sur le terrain** ([components/LineupPitch.tsx](../src/ui/components/LineupPitch.tsx)) : quinze maillots à leur place, le banc en dessous, et l'on y dépose les joueurs. Glisser-déposer à la souris, sélection au clic pour le doigt et le clavier — les deux chemins passent par la même fonction d'affectation.
- **Chaque maillot dit ce qu'il faut savoir avant d'aligner** : liseré vert, orange ou rouge selon que le joueur est à son poste, à un poste voisin ou hors de son registre ; barre de condition physique ; pastilles capitaine, buteur et recrue en acclimatation.
- **Les trente joueurs sont sur le terrain pendant le match** ([ui/pitch/phase-formation.ts](../src/ui/pitch/phase-formation.ts)) : la mêlée se pousse à huit contre huit, l'alignement en touche rentre dans le terrain depuis le bord, la ligne de trois-quarts s'ouvre en diagonale, le rideau défensif monte. Ils se déplacent d'une phase à l'autre.
- **Le moteur nomme, la vue met en évidence** : le porteur, le plaqueur, le buteur, le marqueur et le sanctionné portent un halo et leur nom. Les autres sont là parce que le rugby se joue à quinze.
- **Les temps forts d'un match qu'on n'a pas joué** ([match/highlights.ts](../src/engine/match/highlights.ts)) : simuler une journée ouvre désormais un condensé de six à huit moments, rejoués sur le même terrain avec le score qui bouge. Essais, cartons, points au pied, franchissements, ballons volés — et les bascules d'élan, ces moments où le match change de camp sans que rien de spectaculaire ne se produise.
- `getSubstitutions()` sur la session de match : les remplacements des deux camps, disponibles **pendant** la rencontre et non plus seulement à la fin.

### Corrigé

- **`isPositionMatching` filtrait les candidats en amont** : un dépannage hors poste était impossible, alors que c'est une décision que le manager doit pouvoir prendre — au prix affiché. Le terrain propose tout l'effectif alignable, trié par aptitude.
- **Deux ailiers, deux deuxièmes lignes ou deux troisièmes lignes aile étaient annoncés « poste voisin »** alors qu'ils occupent le même poste à un côté du terrain près. Les piliers, eux, restent signalés : gauche et droit sont deux métiers.
- **Un quatrième libellé de poste** allait être écrit ; les trois copies existantes sont remplacées par `positionLabel`, exporté une fois.
- **La fiche joueur affichait le type de relation brut** (`RIVAL`, `CONFLIT`) — lisible pour qui a écrit le moteur, opaque pour le joueur. Elle affiche désormais un libellé, avec le motif en infobulle.

### Notes de modélisation

- **Un revirement assumé, sans céder sur ce qui le motivait.** `MatchPitch.tsx` portait une consigne explicite : *« Pas de 30 ronds qui sautent. Pas de mensonge. »* Le raisonnement était juste — le moteur ne suit pas trente positions — mais il menait à un terrain vide. La consigne est levée, la contrainte est gardée : **chaque joueur affiché est déduit de ce que la simulation affirme** (type de phase, position du ballon, possession, contributions nommées, remplacements effectués). Aucun résultat ne dépend d'une coordonnée calculée par la vue ; si les deux devaient diverger, c'est la vue qui a tort. Le module le dit en tête, et douze tests le vérifient.
- Le mouvement ne vient pas du moteur : chaque phase produit une nouvelle formation, et c'est l'interpolation CSS d'un point à l'autre qui donne l'impression d'un match qui se joue. `prefers-reduced-motion` la coupe.
- **Le condensé sélectionne, il ne résume pas.** La nuance compte : un résumé invente, une sélection non. Chaque temps fort est une phase réellement jouée, avec le score tel qu'il était **après** elle — le montrer avec le score d'avant l'essai raterait précisément le moment qu'on veut faire voir.
- Deux erreurs trouvées en construisant, toutes deux devenues des tests : les deux packs recevaient les mêmes décalages dans le même repère et se **superposaient** au lieu de se faire face ; et l'écart latéral se retournait avec le sens de l'attaque, ce qui faisait sortir du terrain l'alignement de l'équipe qui jouait vers la gauche.
- Sur une touche, le ballon restait au milieu du terrain pendant que la figure se posait au bord : deux actions à la fois. Il suit désormais la figure.
- Mesuré sur cinq matchs complets : environ une phase sur trois nomme quelqu'un. Les deux autres tiers affichent trente joueurs sans mise en avant — c'est voulu, et c'est ce qui rend le halo lisible quand il apparaît.
- La calibration reste verte (12/12) : rien de tout cela ne touche à la simulation.

## [V0.56] — Ce qui manquait au vestiaire, et la vraie Pro D2

Trois versions de suite, le même défaut a frappé au même endroit : une
fonctionnalité correcte côté moteur, invisible en jeu parce que l'interface et
la session tenaient chacune leur propre copie de l'effectif. Réactions de
vestiaire invisibles (V0.53), deux morals qui ne communiquaient pas (V0.54),
date d'arrivée effacée (V0.55). Cette version commence par fermer la classe
entière, puis en profite pour donner une vie au vestiaire — et remettre la
deuxième division à sa vraie taille.

### Ajouté

- **Les rivalités entre joueurs** ([human/squad-rivalry.ts](../src/engine/human/squad-rivalry.ts)) : la concurrence au poste tend réellement une relation. Deux joueurs qui se disputent le même maillot pendant six mois restaient parfaitement cordiaux ; celui qui regarde l'autre jouer lui en veut désormais, un peu plus à chaque journée.
- **La hiérarchie déclarée devient un outil de vestiaire.** Un espoir laissé sur le banc ne s'estime pas volé — c'est ce qu'on lui a annoncé. Un cadre à qui on a promis le maillot, si. Nommer un jeune « espoir » désamorce d'avance la rivalité que sa mise à l'écart aurait créée, au prix d'avoir à le lui dire en face.
- **Le staff prévient quand ça casse**, une seule fois, au moment où la tension devient un conflit ouvert — courrier de la direction sportive et notification. Une tension qui monte n'est pas une nouvelle ; une brouille déclarée en est une.
- **La Pro D2 compte seize clubs et trente journées**, comme la vraie. Soyaux Angoulême XV et US Carcassonne rejoignent la deuxième division, avec leur effectif généré comme les quatorze autres.
- **`commitRoster`, point d'écriture unique de l'effectif** dans [App.tsx](../src/ui/App.tsx) : toute modification passe par lui, et il synchronise la session dans la foulée.
- Les libellés de relation sont enfin lisibles sur la fiche : « Rivalité », « Conflit ouvert », « Le prend sous son aile » au lieu des types bruts du moteur, avec le motif en infobulle.

### Corrigé

- **`RIVAL` était un septième champ mort.** Le type existait dans le graphe de relations depuis la V0.4, et rien ne l'a jamais produit : il se déduisait d'un score bas que rien ne faisait jamais baisser pour cette raison-là.
- **Quinze écritures de l'effectif, six suivies d'une synchronisation.** C'est la mesure qui a motivé le chantier : les neuf autres laissaient l'interface et la session diverger. Toutes passent maintenant par un seul point, et les cinq synchronisations manuelles devenues redondantes ont été supprimées.
- **Les phases finales étaient figées aux journées 27, 28 et 29** — les trois qui suivent un Top 14. Sur un championnat de trente journées, elles tombaient au milieu de la saison régulière : une Pro D2 se serait terminée sans barrages ni champion. Elles suivent désormais la longueur réelle du championnat.
- **Le temps de jeu se mesurait avec deux compteurs incompatibles.** Le dénominateur venait de l'historique des matchs, qui est restauré au chargement d'une sauvegarde ; le numérateur des statistiques individuelles, qui ne le sont pas. Sur une partie reprise en cours de saison — c'est-à-dire le cas courant — tout l'effectif passait pour remplaçant et le système des rivalités restait sans effet.

### Notes de modélisation

- **Ce n'est pas la concurrence qui blesse, c'est le déséquilibre.** Deux ouvreurs qui se partagent la saison moitié-moitié n'ont aucune raison de se détester : en dessous de 25 points d'écart de temps de jeu, rien ne se passe. Les postes sont regroupés par maillot réellement disputé — les deux ailiers se concurrencent, un pilier et un centre non.
- **Mesuré en jeu, pas réglé au jugé.** L'éventail va de un point par journée pour un remplaçant qui gratte des bouts de match, à quatre pour un cadre déclaré qui ne joue jamais. Un espoir dans la même situation accumule sans jamais franchir le seuil du conflit ouvert : c'est exactement la distinction voulue.
- **Le tempérament décide de qui le vit mal** : un ambitieux supporte moins bien, un mentor voit un jeune à former plutôt qu'un concurrent à écarter.
- **Vérifié en jeu** sur une carrière de Toulouse : Guillaume Cramont, troisième talonneur sans une seule feuille de match, passe en « Rivalité » avec Julien Marchand **et** Peato Mauvaka, motif « Concurrence au poste » à l'appui. C'est cette vérification qui a révélé le défaut des deux compteurs — le test de bout en bout ne pouvait pas le voir, puisqu'il part d'une session neuve où ils coïncident par construction.
- **Vérifié en jeu** côté Pro D2 : une carrière lancée à Brive démarre sur « J1/30 », le classement affiche seize clubs, et la première journée se joue contre l'un des deux nouveaux.
- Le nombre de clubs par division n'est plus une constante unique : `TOP14_CLUBS` et `PRO_D2_CLUBS`. Ils n'ont jamais été égaux dans la réalité, et les confondre donnait à la deuxième division la saison de la première.
- La calibration reste verte (12/12) : rien de tout cela ne touche le moteur de match, et les rivalités passent par la cohésion, que le harnais neutralise déjà.

## [V0.55] — La troisième voie, et ce qui dormait depuis la V0.4

Le jeu savait former des joueurs (V0.39), annoncer à l'un d'eux qu'il est un
espoir (V0.50), et faire progresser un jeune **à proportion de ses minutes**
(V0.14). Une Pro D2 se joue vraiment depuis la V0.44. Et pourtant un jeune
n'avait que deux issues : prendre des minutes à l'équipe première — ce qu'une
course au titre interdit — ou stagner sur le banc.

### Ajouté

- **Le prêt** ([club/loans.ts](../src/engine/club/loans.ts)) : la troisième voie. Un jeune qui ne joue pas peut partir jouer ailleurs pour la saison, et les minutes qu'il y dispute alimentent son développement exactement comme celles disputées ici.
- **Un onglet Prêts** dans les transferts : qui peut partir, ce que chaque club propose, et ce que la décision coûte.
- **Le prêt retire vraiment le joueur** : ni compo automatique, ni sélection manuelle. Il revient à l'intersaison avec un bilan franc.
- Les prêts sont sauvegardés et respectent la fenêtre de mercato, comme un transfert.
- **L'acclimatation d'une recrue** ([club/adaptation.ts](../src/engine/club/adaptation.ts)) : un joueur qui arrive met des semaines à trouver ses marques. Sa technique et sa décision sont diminuées le temps qu'il s'installe — jamais son physique : un joueur qui change de club ne perd pas ses jambes.
- **La détermination fait progresser** : `hidden.determinisme` entre dans le calcul de développement, à côté du professionnalisme avec lequel il ne fait pas doublon — l'un dit comment on s'entretient, l'autre si l'on s'accroche quand ça ne vient pas.
- **Le repos individuel** dans la semaine d'entraînement : on peut ménager un homme sans ménager tout le groupe.

### Corrigé

- **`hidden.adaptabilite` et `hidden.determinisme` étaient les cinquième et sixième champs morts du projet.** Générés sur chaque joueur depuis la V0.4, lus nulle part : une recrue jouait à cent pour cent dès son premier match, et deux joueurs au même potentiel progressaient exactement pareil — ce qui vidait le potentiel de son sens, puisque dans un centre de formation la différence n'est presque jamais le talent brut.
- **La charge d'entraînement était collective.** Impossible de préserver un cadre de trente-quatre ans tout en poussant les jeunes, alors que c'est précisément ce qu'on gère le reste du temps avec la rotation.

### Notes de modélisation

- Le module **ne simule pas** une saison de Pro D2 à la phase près pour un joueur prêté : le moteur n'en a pas besoin. Il calcule ce que le prêt rapporte — des minutes, donc de la progression — et ce qu'il coûte : un joueur en moins, et une part de salaire qu'on continue de payer.
- **C'est un arbitrage, et les chiffres le disent.** Plus le club d'accueil est modeste, plus il fait jouer et moins il participe au salaire. Vérifié en jeu sur un pilier de 23 ans : Valence Romans promet 20 matchs et prend 38 % du salaire, la Section Paloise 12 matchs et 65 %. Chaque proposition affiche aussi ce qu'elle coûte : « contre Merkler indisponible toute la saison ».
- Le prêt est réservé à ceux qui en ont besoin : 23 ans au plus, moins de 35 % des matchs disputés ici, et pas en fin de contrat — le prêter reviendrait alors à le perdre pour rien.
- L'acclimatation produit une **vue diminuée** du joueur pour la feuille de match, jamais une mutation de l'effectif stocké — même procédé que `applyRole`. Huit points d'attribut au maximum : une recrue qui débarque n'est pas un autre joueur, c'est le même joueur mal réglé.
- Le repos n'est pas gratuit : il récupère franchement et met à l'abri des blessures, mais fait perdre du rythme. Sans ce coût, mettre tout l'effectif au repos chaque semaine serait sans contrepartie. **Vérifié en jeu sur une semaine réelle** : Antoine Dupont, mis au repos, passe de 25 à 43 de condition et perd un point de forme, quand un témoin non ménagé passe de 25 à 29 et en gagne un.
- **L'acclimatation vérifiée de bout en bout** : une recrue signée à la J14 affiche « Vient d'arriver — il cherche encore ses repères », et la mention a disparu à la J20.
- **Un troisième défaut, du même genre que celui du moral** : la date d'arrivée d'une recrue était bien posée, puis `refreshSeason` recopiait l'effectif de la session par-dessus les overrides et l'effaçait aussitôt. La fiche n'affichait donc jamais rien. Elle est désormais synchronisée dans la session au moment de la signature.
- Deux défauts trouvés en vérifiant : un joueur déjà prêté restait proposé au prêt, et surtout il restait **sélectionnable à la main** — la compo automatique l'écartait, le manager pouvait le remettre. Les deux sont corrigés.

## [V0.54] — Il n'y a plus qu'un seul moral

Le jeu en portait **deux, qui ne communiquaient pas**. L'écran d'effectif
recalculait un moral à la volée avec `computeMood()`, à partir des sept sources
de la V0.4. Le moteur de match, lui, ne lisait que `player.dynamic.mood`, un
compteur indépendant déplacé par les événements. Une promesse trahie changeait
le second sans jamais toucher au premier : le manager ne voyait rien de ce qu'il
venait de provoquer, et les sept sources documentées depuis la V0.4 ne
touchaient jamais le terrain.

### Ajouté

- **Les événements de moral sont des modificateurs datés** ([human/mood.ts](../src/engine/human/mood.ts)) : `pushMoodEvent`, `pruneMoodEvents`, et trois durées usuelles. Chacun porte sa source, son delta, sa raison et son échéance.
- **`dynamic.mood` est devenu le résultat** : sept sources + événements encore actifs, recalculé à chaque rafraîchissement de saison. C'est ce total qu'affiche l'écran **et** que lit le moteur de match.
- Les événements périmés sont purgés au passage : une carrière de vingt saisons ne traîne pas des centaines de modificateurs inertes dans chaque sauvegarde.

### Corrigé

- **`moodModifiers` était un quatrième champ mort.** Déclaré sur chaque joueur depuis la V0.4 avec `source`, `delta`, `reason` et même `expiresAt`, initialisé à `[]` partout, recopié une fois dans `injuries.ts` — et **jamais rempli ni lu**. L'architecture prévue était déjà écrite dans les types ; elle n'était pas branchée.
- **Ce qui pesait sur le terrain n'était pas ce que le manager voyait.** Corrige explicitement ce qui a été écrit en V0.51 : le moral qui atteignait le moteur était le compteur d'événements, pas le modèle à sept sources. Les deux coïncident désormais.
- **Les réactions du vestiaire de la V0.53 étaient invisibles.** Elles fonctionnaient — seize joueurs touchés à −2, mesuré en jeu — mais modifiaient un nombre que l'écran n'affichait pas. Vérifié après correction : mettre un joueur hors projet fait bien passer tout le groupe de 45 à 43.

### Notes de modélisation

- Les événements **s'estompent**. Rien n'est permanent par défaut : une décision pèse sur les semaines qui suivent, pas sur toute une carrière. Une conversation tient quatre journées, une promesse tenue huit, une promesse trahie quinze.
- Deux événements de même raison **se remplacent** au lieu de s'empiler : retrahir la même promesse ne doit pas punir deux fois.
- Le recalcul ne touche que le club dirigé. Un joueur adverse n'a ni historique d'événements ni relations connues : le recalculer l'écraserait à sa valeur de base.
- La calibration reste verte et **le reste par construction** : le harnais fixe `dynamic.mood` à 60 directement sur ses effectifs de test et ne passe jamais par le pipeline.

## [V0.53] — Le monde autour du club

Les clubs IA licenciaient leur entraîneur depuis la V0.43 : c'est de là que
viennent les postes vacants. Mais **cet entraîneur n'existait nulle part**. Une
vacance était un simple identifiant de club, et le monde limogeait des fantômes.

### Ajouté

- **Quinze entraîneurs nommés** ([season/rival-managers.ts](../src/engine/season/rival-managers.ts)), écrits à la main comme les arbitres et les rivalités. Réputation de 34 à 88, style de jeu, et une phrase qui dit ce que la presse pense d'eux. Les meilleurs occupent les plus gros bancs.
- **Les carrières bougent** : on est limogé, on perd de la réputation, on rebondit ailleurs. Une bonne saison fait monter, une mauvaise fait descendre — jugées sur l'écart à ce que la stature du club laissait espérer, comme pour le manager joueur.
- **Le joueur n'est plus seul à vouloir le poste.** Un banc convoité est d'abord proposé aux entraîneurs sans club : si l'un d'eux est nettement mieux coté, il signe et l'offre passe sous le nez du manager.
- **Un onglet « Confrères »** dans Ma carrière : le classement de réputation du championnat, le joueur compris.
- **Les honneurs de fin de saison** ([season/honours.ts](../src/engine/season/honours.ts)) : meilleur joueur, meilleur espoir, meilleur marqueur et XV de la saison, calculés sur le championnat entier. Courrier de la Ligue, entrée au fil d'actualité, et badges sur la fiche du joueur.
- **Les réactions du vestiaire** ([human/dressing-room.ts](../src/engine/human/dressing-room.ts)) : vendre un joueur, écarter un cadre ou trahir une promesse secoue le groupe **joueur par joueur**. Un ami le prend deux fois plus mal, un rival y voit une place se libérer.
- Les statistiques de saison couvrent désormais **tout le championnat** et portent plaquages, mètres, grattages, défenseurs battus et franchissements — pas seulement les essais du club dirigé.

### Corrigé

- **La réputation du manager ne se comparait à rien.** « Réputation 62 » ne mesurait rien : personne ne lui disputait un banc, personne ne se faisait virer pendant qu'il tenait le sien. Elle devient un **rang** — et un rang, on cherche à le monter.
- **Le jeu tutoyait encore dans les événements humains** (« Émilien Gailleton veut te parler »), alors que tout le reste vouvoie depuis la V0.49. Douze formulations corrigées, plus une modale de contrat.
- **Le vestiaire ne réagissait qu'à ce qu'on lui faisait à lui.** `applySquadMoodDelta` n'était appelé que sur une promesse trahie, et appliquait le même malus à tout le monde : le graphe de 435 relations ne servait jamais à dire **qui** prend mal une décision.
- **Les bancs vacants ne se repourvoyaient jamais tout seuls.** Ils n'étaient traités qu'au moment où le manager acceptait ou déclinait une offre : un manager qui n'en recevait aucune voyait les vacances s'empiler d'année en année. Elles se pourvoient désormais dès l'intersaison, sauf celles sur lesquelles il a une offre en cours.

### Notes de modélisation

- Le module **ne simule pas** quinze managers en train de composer une équipe : le moteur décide déjà des résultats des clubs IA, et doubler cette décision n'apporterait rien. Il ajoute un nom sur chaque banc et une carrière qui bouge.
- Quinze noms pour quatorze bancs : il faut au moins un entraîneur disponible au premier limogeage, sinon le premier banc libéré resterait vide.
- Un limogeage coûte six points de réputation, pas davantage : dans le rugby professionnel, se faire virer d'un club en difficulté n'a jamais fermé de portes. C'est la répétition qui condamne, d'où le compteur de limogeages.
- Un club modeste ne décroche pas une gloire et un grand club ne se rabat pas sur un inconnu tant qu'il a mieux — mais à défaut de candidat crédible, il prend qui reste : un club ne commence pas une saison sans entraîneur. Deux tests vérifient l'invariant sur un cycle complet, puis sur dix saisons de valse.
- **Le barème des honneurs a été calé sur la mesure, pas au jugé.** Première version écrite sur des ordres de grandeur inventés — mille quatre cents mètres pour un ailier, deux cents plaquages pour un troisième ligne. Le moteur produit tout autre chose : mesuré sur vingt-six matchs, un troisième ligne cumule 39 plaquages et 88 mètres par saison, un ailier 5 essais et 86 mètres. Les poids sont désormais réglés pour qu'un joueur **moyen** de chaque ligne sorte entre 8 et 12 de note — condition pour qu'un pilier puisse gagner le trophée.
- Au passage : le grattage individuel est quasi inexistant dans le moteur (0,3 par saison). Le poids qu'on lui donne ne départage presque personne aujourd'hui.
- **Deux morals coexistent dans le jeu, et ils ne communiquent pas.** Découvert en vérifiant les réactions du vestiaire : l'écran d'effectif n'affiche pas `player.dynamic.mood` mais recalcule un moral à la volée avec `computeMood()`, à partir des sept sources de la V0.4. Le moteur de match, lui, ne lit que `dynamic.mood`. Les réactions fonctionnent — seize joueurs touchés à −2 sur une mise hors projet, mesuré en jeu — mais le manager ne les voit pas. **Cela corrige aussi ce qui a été écrit en V0.51** : ce qui pèse sur le terrain est le moral *stocké*, déplacé par les événements, et non le moral *calculé* à partir des sept sources. Réunifier les deux est une décision de conception, pas un correctif.
- L'embauche garde une part de hasard entre les trois meilleurs candidats : un président n'est pas un tableur, et deux carrières identiques ne doivent pas se rejouer à l'identique.

## [V0.52] — L'arbitre, et le carton qui se vit

Trois commentaires du moteur invoquaient l'arbitre depuis la V0.13 — « l'arbitre
tend à siffler contre eux » — et il n'en existait aucun. `PhaseOutcome.cardIssued`
était déclaré, le narratif savait le raconter, et **aucun sous-système ne l'avait
jamais produit** : une branche de récit qui ne pouvait pas se déclencher.

### Ajouté

- **Douze arbitres nommés** ([match/referee.ts](../src/engine/match/referee.ts)), écrits à la main comme les rivalités. Sévérité indépendante au ruck, en mêlée et sur le hors-jeu, propension aux cartons, et pour trois d'entre eux un biais domicile. On les recroise sur la saison et on apprend leurs manies.
- **Le carton en direct.** Un jaune retire réellement un joueur du terrain pendant dix minutes ; un rouge, jusqu'au coup de sifflet final. Le XV tombe à quatorze, avec tout ce qui s'ensuit.
- **La consigne au sol** : contester chaque ballon, contester à bon escient, ou ne pas contester. Plus de turnovers contre plus de pénalités — un arbitrage que l'arbitre du jour rend plus ou moins coûteux.
- **La fiche arbitre au dossier d'avant-match**, avec sa réputation et la consigne que le staff recommande contre lui.

### Corrigé

- **Les pénalités tombaient à taux fixe**, identiques d'un match à l'autre, quel que soit l'homme au sifflet.
- **Les cartons étaient tirés après le match, sans le moindre lien avec ce qui s'y était passé.** `rollPostMatchCards` roulait une probabilité plate pour chaque titulaire : un joueur pouvait écoper d'un rouge dans une rencontre où il n'avait pas commis une faute, et un match haché n'en produisait pas plus qu'un autre. Le module ne garde plus que les **suites** — suspension et moral — et les cartons se sifflent à l'instant de la faute.
- **`SquadRuntime` ne savait faire que des remplacements définitifs.** Il connaît maintenant la sortie temporaire : le slot est retiré et conservé tel quel, puis remis à sa place dix minutes plus tard.

### Notes de modélisation

- L'arbitre agit **par domaine** et non en sévérité globale : un curseur unique n'aurait ajouté que du bruit, alors que trois domaines séparés se lisent et se préparent. C'est ce que la météo a apporté au plan de match, appliqué à la discipline.
- Retirer le slot plutôt que marquer le joueur est ce qui rend l'exclusion peu coûteuse à brancher : pack, lignes arrières, fatigue moyenne, première ligne disponible — **toutes** les lectures dérivées passent à quatorze sans qu'aucune n'ait à connaître les cartons.
- Un pilier au cachot fait passer les mêlées en simulé **le temps de la peine seulement**. L'épuisement des doublures, lui, reste définitif : les deux causes sont différentes, et verrouiller le match entier pour un carton jaune punirait deux fois la même faute.
- Le biais domicile ne joue que sur les pénalités, jamais sur les cartons : on peut soupçonner un arbitre de laisser courir une faute chez lui, pas d'y ranger son carton rouge.
- **Premier chantier qui n'est pas neutre par construction.** Le moral et la météo se calaient sur un point neutre laissant la calibration intacte ; faire jouer une équipe à quatorze déplace forcément possession, essais et points. Le taux de carton par pénalité est donc le seul paramètre libre introduit, et c'est sur lui qu'on règle. Mesuré sur 1500 matchs : le moteur siffle 7,9 pénalités par rencontre — bien moins que les vingt d'un vrai match, parce qu'une phase condense plusieurs temps de jeu, et cette valeur-là est calibrée depuis la V0.13. À 0,055 par pénalité on obtenait 0,40 jaune par match, deux fois trop peu ; **retenu 0,125 et 0,010, soit 0,87 jaune et 0,079 rouge par rencontre**, conforme au Top 14 récent. Les douze cibles tiennent.
- Le rouge l'emporte sur un jaune pris plus tôt par le même homme, et un rouge pris au cachot l'empêche de revenir.

## [V0.51] — Le moral se joue sur le terrain, et il se met à pleuvoir

Aucun des sept sous-systèmes de match ne lisait `dynamic.mood`. Le moral
n'apparaissait dans le moteur que pour être **modifié** — cartons, blessures,
causerie — jamais pour être lu. Et deux champs obligatoires de `MatchInput`,
`weather` et `fieldCondition`, n'ont jamais quitté leur valeur par défaut.

### Ajouté

- **Le moral et la cohésion pèsent sur le jeu** ([match/morale.ts](../src/engine/match/morale.ts)) : confiance dans le franchissement et à la ligne, taux d'erreur de manipulation, engagement défensif, discipline. Deux grandeurs distinctes — ce que chacun a dans la tête, et ce qu'ils ont entre eux.
- **Le graphe de relations atteint enfin un match.** La cohésion compte les affinités et les inimitiés **entre joueurs alignés ensemble** : deux joueurs brouillés qui ne se croisent jamais sur une feuille de match ne coûtent rien.
- **L'état du vestiaire se lit avant le coup d'envoi**, sur l'écran de préparation, qualifié et jamais chiffré.
- **La météo** ([match/weather.ts](../src/engine/match/weather.ts)) : temps sec, pluie, vent, conditions extrêmes, tirés par journée et par stade. Septembre est presque toujours sec, décembre et janvier beaucoup moins ; La Rochelle, Bayonne et Perpignan prennent plus de vent que Toulouse.
- **La pluie change le jeu** : manipulation, tendance au jeu au pied, probabilité d'essai, conquête en touche — et le terrain gras rejoint la poussée en mêlée, qui l'attendait depuis la V0.2. Annoncée en préparation avec ce qu'elle implique, affichée pendant la rencontre.

### Corrigé

- **Une équipe à 20 de moral jouait exactement comme une équipe à 90.** Sept sources de moral, trente traits, 435 paires de relations, les conversations et les promesses de la V0.48, la causerie, les demandes de départ, le capitanat et la hiérarchie de la V0.50 : tout cela alimentait une valeur qui ne touchait jamais le résultat. Le défaut « écrit mais jamais lu » à son échelle maximale, et sur la prémisse même du genre.
- **Aucun match de carrière n'a jamais été joué sous la pluie.** `weather` était un champ obligatoire depuis la V0.2, implémenté au seul jeu au pied placé et fixé à `'SEC'` dans le constructeur de feuille de match. `fieldCondition` avait un effet réel sur la poussée en mêlée et valait toujours `'BON'`.
- **Le harnais de calibration mesurait par défaut sur un échantillon trop petit pour l'une de ses propres cibles.** « Victoires de l'équipe forte » est un taux autour de 0,78 dont l'erreur type à 1000 matchs vaut ≈ 1,3 point, pour une fenêtre haute à 78 % : deux versions identiques du moteur pouvaient y afficher 77,6 % et 78,3 %, l'une verte et l'autre rouge. Le défaut par défaut passe à 8000 matchs — sept secondes de plus, un portail lisible.

### Notes de modélisation

- **Le point neutre est 60**, valeur que le seed et le harnais donnent tous deux au moral d'un joueur au repos. À 60, les quatre facteurs valent exactement 1 ou 0 : la calibration existante reste donc valide **par construction**, et toute dérive mesurée est un vrai effet, pas un décalage d'origine.
- **L'effet est délibérément asymétrique**, et c'est le point de conception central. Le moral monte quand on gagne — la victoire est l'une des sept sources. Un effet symétrique créerait une boucle : gagner rend meilleur, ce qui fait gagner davantage, et le championnat se fige au bout de dix journées. Dans un vestiaire, la confiance donne **un peu** et un groupe empoisonné coûte **beaucoup** ; on plafonne donc le gain et on laisse la pénalité mordre.
- Calibré par la mesure, sur 800 matchs à effectifs strictement identiques. Première version : un groupe effondré perdait 4,6 points de taux de victoire — imperceptible. Amplitudes doublées, puis plafond du gain ramené de 0,35 à 0,20 parce que le haut avait grossi avec le bas. **Résultat retenu : référence 49,4 %, groupe effondré 43,4 %, groupe euphorique 51,2 %.** Six points de perte contre moins de deux de gain, soit un rapport de trois pour un.
- Six points de taux de victoire, sur une saison de 26 journées, valent une victoire et demie : perceptible sans jamais écraser le niveau des joueurs, qui doit rester le premier facteur.
- La cohésion ne touche que ce qui se joue **entre** joueurs — manipulation et engagement collectif — jamais la discipline : un homme malheureux peut rester discipliné, un groupe divisé lâche des ballons.
- Les seuils d'affinité et de conflit (±50) sont ceux que le module de relations utilise lui-même pour dire `AMI` et `CONFLIT`. Mesuré en jeu : à la première journée, la relation la plus forte d'un effectif du Top 14 plafonne vers +25 et la cohésion vaut donc zéro. Elle se construit ensuite, environ deux points par match disputé ensemble et gagné — un groupe soudé se fabrique sur une saison, il ne se décrète pas.
- La météo est le premier élément qui rend la préparation **situationnelle**. Jusqu'ici un plan de match était bon ou mauvais dans l'absolu : on trouvait le meilleur réglage et on le gardait vingt-six journées. Sous la pluie, jouer la main devient une faute et l'occupation reprend son sens.
- Il pleut pour tout le monde : les facteurs météo ne sont **pas** un avantage pour le club recevant. Ce qui distingue les deux équipes, c'est la façon dont chacune s'y prépare, pas le ciel.
- Mesuré sur 600 matchs par condition, à effectifs identiques : **sec 4,59 essais et 37,0 points ; pluie 4,28 et 34,1 ; vent 4,54 et 34,6 ; extrême 3,95 et 30,3**, avec le jeu au pied qui passe de 1,1 à 1,5 coup par match sous le déluge et tombe à 0,9 par grand vent. Un match sous la pluie reste un match — sans quoi la météo cesserait d'être une contrainte pour devenir une punition.
- Le vent est le seul temps qui **dissuade** de jouer au pied : c'est aussi le seul qui pénalise lourdement la touche.
- Les stades exposés sont écrits à la main, comme les rivalités : la géographie d'un club ne se déduit pas d'une latitude.
- La cohésion d'un club IA vaut zéro : la saison ne suit le graphe de relations que pour le club de l'utilisateur. Neutre, donc — ni avantage ni handicap. Le moral, lui, est porté par les joueurs eux-mêmes et pèse des deux côtés.

## [V0.50] — Ce qui était écrit sans être lu

Deux champs déclarés depuis les premières versions, écrits partout et lus nulle
part : le brassard de capitaine, et l'élan. Et un troisième manque : le statut
d'un joueur dans l'effectif, que le moteur **déduisait** sans que le manager
puisse jamais rien annoncer.

### Ajouté

- **Le capitaine agit** ([match/captain.ts](../src/engine/match/captain.ts)). Une note d'**autorité** — leadership, sang-froid, discipline, plus les traits — décide de ce qu'il apporte : il relaie la causerie de mi-temps, il tient la discipline de son groupe, et il coûte quelque chose quand il quitte le terrain.
- **Le brassard se paie en retour** : être capitaine remonte le moral de celui qui le porte, d'autant plus qu'il a l'autorité pour l'assumer.
- **Le choix survit au match** : le capitaine est porté par le club, sauvegardé, et affiché dans l'effectif. L'écran d'avant-match trie les titulaires par autorité et l'affiche.
- **L'élan est un état du moteur** ([match/momentum.ts](../src/engine/match/momentum.ts)). Il monte sur ce qui fait lever un stade — essai, turnover, carton, pénalité arrachée, mêlée qui recule en face — et redescend tout seul. Il agit sur trois choses : la confiance dans le franchissement, le taux d'erreur, et la réussite au pied sous pression.
- **La barre d'élan lit le moteur** et porte un libellé qui nomme ce qui se passe, au lieu d'être un curseur muet.
- **La hiérarchie de l'effectif** ([club/squad-status.ts](../src/engine/club/squad-status.ts)) : cadre, rotation, espoir, hors projet, annoncés depuis l'écran d'effectif. Chaque rôle porte une attente chiffrée de temps de jeu, et c'est **l'écart** entre l'annonce et le vécu qui décide du moral.
- Le rôle annoncé pèse aussi **hors du vestiaire** : un cadre réclame 15 % de plus à la prolongation, un joueur mis hors projet accepte moins et finit par vouloir partir.
- **Le garde-fou arithmétique** : un XV plus son banc offrent un nombre fini de places sur une saison. Promettre le statut de cadre à tout l'effectif est intenable, et la semaine du manager le dit.

### Corrigé

- **Le brassard était réattribué avant chaque rencontre.** L'écran d'avant-match repartait de « l'ouvreur, sinon le premier de la liste » : le choix du manager ne passait pas le coup de sifflet final.
- **Le capitaine par défaut était l'ouvreur**, y compris pour les clubs IA et l'adversaire européen. C'est le poste du meneur de jeu, ce qui n'est pas celui du meneur d'hommes.
- **La note d'autorité saturait à 100** dans un gros club : deux internationaux dotés de `leader_naturel` sortaient tous les deux au maximum, et l'écran ne permettait plus de les départager. Le bonus de trait se loge désormais dans ce qui reste au-dessus de la note brute. Mesuré sur le XV de Toulouse : 61-98 au lieu de 61-100 avec deux ex æquo en tête.
- **Le moral aurait compté huit sources au lieu de sept.** Le capitanat entre dans la reconnaissance plutôt qu'à côté — c'est très exactement ce dont il s'agit, et « sept sources » est un invariant que le reste du code tient pour acquis depuis la V0.4.
- **Le statut d'un joueur n'était qu'une déduction de son temps de jeu.** Impossible de dire à un jeune « prends ton temps » : faute de le faire jouer, il se démoralisait exactement comme un international mis au placard. C'est le pendant manquant de la promesse de la V0.48 — celle-ci porte sur six journées et un homme, la hiérarchie porte sur la saison et tout le groupe.
- **`homeMomentum` valait `0` en dur** depuis la V0.2, alors que le type le déclarait « -100 à +100 ». La barre affichée pendant la rencontre était calculée **dans l'interface** à partir de la possession des huit dernières phases : elle montrait quelque chose que la simulation ignorait. Un match n'a jamais basculé — il additionnait des phases indépendantes, chacune tirée sur les mêmes probabilités que la précédente.

### Notes de modélisation

- Un capitaine ne rend personne meilleur : il ne plaque pas mieux et ne court pas plus vite. En faire un bonus d'attributs serait une caricature. Il **relaie et tient**, rien d'autre.
- **Ce qu'il apporte est relatif au groupe qu'il mène**, et c'est la calibration qui l'a imposé. Première version, en absolu : la victoire de l'équipe forte passait de 77,6 % à 78,3 %, au-dessus de la cible. Le modèle était faux — un gros club a les meilleurs joueurs **donc** les meilleurs capitaines, et un bonus absolu revenait à donner un avantage de plus à celui qui en avait déjà le plus. Ce qu'un capitaine apporte, c'est ce qu'il a de plus que ceux qu'il mène : un leader né dans un groupe de suiveurs change tout, le même entouré de quatorze internationaux ne change presque rien.
- Amplitude bornée à ±6 % sur les fautes concédées : perceptible sur une saison, invisible sur un match. C'est le poids d'un brassard.
- Un capitaine plus faible que son groupe **coûte** au lieu de rapporter : un mauvais capitaine est pire que pas de capitaine.
- Le contrecoup de sa sortie est proportionnel à ce qu'il représentait, et nul en dessous de 55 d'autorité — perdre un capitaine de façade ne coûte rien.
- L'élan ne se construit pas sur la possession : garder le ballon sans avancer n'a jamais soulevé un stade. Les poids se lisent les uns par rapport aux autres — un essai vaut trois turnovers, un turnover vaut deux pénalités arrachées, une percée ne vaut presque rien seule.
- Trois garde-fous contre l'emballement, parce qu'une boucle de rétroaction positive mal bridée transforme chaque match en avalanche : érosion à chaque phase, érosion renforcée sur un renvoi (un arrêt de jeu casse un élan, c'est exactement ce que cherche l'équipe qui subit), et effets plafonnés sous l'avantage du terrain.
- L'effet est **symétrique** : celui qui subit lâche davantage de ballons et manque davantage de coups de pied. Ne bonifier que celui qui domine ferait de l'élan un gain net, et le match ne basculerait toujours pas — il s'emballerait dans un seul sens.
- Annoncer ne coûte rien sur le moment : c'est **tenir** qui coûte. Un espoir à 15 % de temps de jeu est en paix ; le même, annoncé cadre, est amer avec exactement les mêmes minutes. Mesuré en jeu sur un troisième talonneur : moral 56 en espoir, 35 en cadre, sans qu'une seule minute change.
- Jouer **plus** que promis ne rend jamais malheureux — personne ne s'est jamais plaint d'être surclassé. C'est un petit bonus, jamais un malus.
- La tolérance avant qu'un joueur crie à la trahison est large (18 points) : blessures, suspensions, adversaires qui ne conviennent pas — un effectif ne tourne jamais au chiffre près, et un professionnel le sait.
- **Le garde-fou compare bien ce qui se compare.** Première version : la somme des temps de jeu promis était multipliée par quinze avant d'être comparée aux places disponibles, soit deux grandeurs sans rapport — un effectif parfaitement raisonnable était déclaré intenable. Un joueur à qui l'on promet 75 % consomme 0,75 apparition par match, et une feuille de match en offre environ 17,8 : les deux se comparent directement, le nombre de journées se simplifiant des deux côtés. Attrapé par un test.
- Sans rôle annoncé, tout reste **exactement** comme avant : une sauvegarde antérieure à la V0.50 n'a rien déclaré, et son effectif ne doit pas changer d'humeur au chargement.
- **Vérifié que l'élan ne biaise pas le championnat.** À l'échantillon par défaut (1000 matchs), la victoire de l'équipe forte passait de 77,6 % à 78,0 % — soit le plafond de la cible. Balayage des trois amplitudes : aucun effet. Mesure à 8000 matchs, élan actif contre élan calculé mais inerte : **76,8 % dans les deux cas, écart-type des essais identique à 1,67**. L'écart vu à 1000 matchs était du bruit d'échantillonnage — l'erreur type y est d'environ 1,3 point. La leçon vaut au-delà de ce chantier : cette cible-là ne se lit pas à 1000 matchs.

## [V0.49] — La semaine du manager, et le prix d'une parole

Quinze systèmes tournaient sans que rien ne remonte au manager, une promesse
trahie ne coûtait qu'une jauge de moral qu'on encaissait en haussant les
épaules, et le tutoriel présentait encore le jeu de la V0.12.

### Ajouté

- **La semaine du manager** ([season/manager-agenda.ts](../src/engine/season/manager-agenda.ts)) : un digest en tête du tableau de bord qui regarde le plafond salarial, le quota JIFF, l'interdiction de recruter, les promesses en cours, la feuille de route du président, la confiance du bureau, le courrier en attente, l'infirmerie, les contrats qui expirent et le chantier en cours. Trié par urgence, chaque entrée cliquable vers l'onglet concerné.
- **Les suites d'une promesse trahie** ([human/player-talk.ts](../src/engine/human/player-talk.ts)) : le joueur peut **demander à partir**, et le vestiaire réagit. Son agent écrit ; deux réponses possibles, chacune avec son coût annoncé.
- **La liste des transferts** : accepter une demande de départ place réellement le joueur sur le marché. Les offres entrantes le prennent alors pour cible même s'il ne remplit aucun des critères habituels — un club se déplace pour un joueur qui veut partir.
- La demande de départ se lit sur la **fiche du joueur** et dans **la semaine du manager**, et survit à un rechargement de sauvegarde.
- **L'introduction, étalée sur la carrière** ([season/onboarding.ts](../src/engine/season/onboarding.ts)) : quatorze leçons qui n'apparaissent qu'au moment où leur sujet arrive — le plafond salarial le jour où il est tendu, la promesse le jour où l'on en fait une, la demande de départ le jour où elle tombe. Trois cartes à l'arrivée, une leçon à la fois, jamais deux ensemble.
- « Ne plus rien m'expliquer » coupe tout ; « Revoir les explications », depuis le menu titre, remet le compteur à zéro.

### Corrigé

- **Le tableau de bord affichait la même chose qu'en V0.10** — objectif, calendrier, classement — alors que le jeu porte désormais une quinzaine de systèmes. Le manager devait faire le tour de dix onglets pour savoir ce qui réclamait son attention, et ne le faisait pas. C'est le défaut « écrit mais jamais appelé » d'un cran au-dessus : **construit mais jamais remonté**.
- **Trahir une promesse ne coûtait que du moral.** Une jauge qui baisse s'encaisse sans rien changer : on pouvait promettre du temps de jeu à tout le vestiaire et vivre très bien avec.
- **Le tutoriel datait de la V0.12.** Il annonçait « le tour des écrans en 30 secondes » et présentait quatre onglets, à un moment où le jeu en comptait quatre. Il en compte neuf, et six systèmes majeurs sont arrivés depuis sans que rien ne les mentionne.
- **Le jeu tutoyait à deux endroits** — le tutoriel et l'écran de choix du club — et vouvoyait partout ailleurs. Ces deux écrans sont les premiers que l'on lit.

### Notes de modélisation

- Le digest **se tait quand tout va bien**. Un digest qui parle chaque semaine ne se lit plus au bout de trois journées, et l'absence d'entrée est en soi une information.
- On n'y remonte que ce sur quoi le manager peut **agir** : un chantier qui avance bien ou un plafond respecté n'appelle aucune décision et noierait le reste.
- Le tempérament décide de qui claque la porte : un loyal attaché au club encaisse (5 % environ), un mercenaire ambitieux part sept fois sur dix. Personne n'est totalement à l'abri ni totalement condamné.
- **Le vestiaire prend toujours quelque chose**, que le joueur demande à partir ou non. Sans cela, il suffirait de multiplier les promesses en pariant qu'aucune ne se retournera vraiment.
- Les deux réponses à une demande de départ sont défendables, sinon le choix n'en est pas un : accepter apaise le joueur mais ouvre la porte sur un cadre ; le retenir garde l'effectif intact mais laisse un homme aigri dans un vestiaire qui a tout suivi.
- Une demande de départ ne traverse pas l'intersaison : sans cela, un joueur jamais vendu resterait « sur la liste » à vie.
- L'identité du joueur sert de clé de déduplication au courrier de l'agent, comme pour la convocation du bureau en V0.43 : une affaire, une lettre.
- L'alternative à l'introduction progressive était d'allonger la visite guidée : quinze cartes d'affilée avant d'avoir joué le moindre match. Personne ne les lit, et personne ne s'en souvient.
- L'ordre des leçons est le contenu du module : ce qui **bloque** une décision passe avant ce qui l'éclaire, et ce qui éclaire passe avant ce qui informe. Une seule leçon s'affiche à la fois — la suivante attend le tour d'après.
- La règle d'éligibilité vit dans le moteur et pas dans le composant, précisément parce que le projet n'a pas d'infrastructure de test de composants : une règle qui vit là se teste, la même noyée dans un `useEffect` ne se teste pas. Vingt-six tests couvrent l'ordre, le silence et le non-rejeu.
- Un ancien « passer le tuto » de la V0.12 vaut refus global : on ne resert pas quatorze cartes à quelqu'un qui avait déjà cliqué pour ne rien voir.

## [V0.48] — Parler, exiger, se détester

Trois systèmes existaient sans qu'on puisse les toucher, ou n'existaient pas du
tout.

### Ajouté

- **Parler à ses joueurs** ([human/player-talk.ts](../src/engine/human/player-talk.ts)) : féliciter, recadrer, rassurer sur le rôle, promettre du temps de jeu, demander un effort — depuis la fiche du joueur. La réaction dépend de la situation (forme, temps de jeu, moral) et du **tempérament** : un rancunier n'encaisse pas un recadrage comme un professionnel.
- **Les promesses**, qui sont le cœur du risque. Promettre du temps de jeu engage sur six journées ; tenue, la promesse vaut +12 de moral, trahie elle en coûte 28. Elles sont suivies journée après journée et persistées.
- **Les attentes du board** ([season/board-expectations.ts](../src/engine/season/board-expectations.ts)) : tenir la masse salariale, reconstituer la marge JIFF, faire jouer les jeunes, équilibrer les comptes. Le président choisit **ce qui manque à ce club-là**, deux exigences au maximum, et fait les comptes en fin de saison.
- **Les rivalités** ([season/rivalries.ts](../src/engine/season/rivalries.ts)) : treize derbies et classiques du Top 14 et de la Pro D2, avec affluence majorée, moral amplifié dans les deux sens, et mémoire des confrontations.

### Corrigé

- **La fiche d'un joueur ne contenait que des boutons de navigation.** Tout le système humain — moral à sept sources, trente traits, 435 paires de relations — arrivait au manager sous forme de modales, sans qu'il puisse jamais aller voir quelqu'un.
- **`SeasonObjective` était un classement et rien d'autre.** Le président ne demandait qu'une place, alors que le jeu mesure depuis V0.43-V0.45 la masse salariale, le quota JIFF, les espoirs sortis du centre et les comptes du club. Quatre systèmes construits, aucun exigé.
- **Aucune rivalité nulle part.** Un Top 14 où Toulouse–Toulon se jouait exactement comme une journée quelconque.

### Notes de modélisation

- Trahir une promesse coûte plus du double de ce que la tenir rapporte. Sans cette asymétrie, promettre à tout le monde serait un pari gagnant.
- Une conversation se retourne d'autant plus facilement que le joueur va mal : c'est quand on a le plus besoin de lui parler qu'on risque le plus.
- Le board ne formule jamais plus de deux exigences, servies par ordre de menace — une masse salariale hors des clous met le club en danger, le temps de jeu des jeunes est du confort. Quatre exigences simultanées, c'est aucune exigence.
- Ces exigences pèsent moins que le classement (±4/−6 de confiance contre −20 pour un objectif sportif raté) : c'est de la gestion, pas la mission principale.
- Les rivalités sont **écrites, pas calculées** : Toulon et Toulouse ne sont pas voisins, Bayonne et Biarritz le sont trop. Une rivalité est une histoire, pas une fonction de la géographie.
- Le moral d'un derby est amplifié en victoire **comme** en défaite : ne bonifier que la victoire en ferait une aubaine.
- Un test valide que chaque identifiant de la table de rivalités désigne un club existant — une faute de frappe y désactiverait un derby en silence.

## [V0.47] — La commission juge tout le championnat

V0.46 avait rendu le plafond contraignant pour les clubs IA, mais seule
l'équipe de l'utilisateur passait devant la commission : les autres
respectaient la règle sans jamais rien risquer. Le règlement restait à deux
vitesses — un club sanctionné, treize spectateurs.

### Ajouté

- **Tous les clubs sont contrôlés** à l'intersaison : amende prélevée sur leur trésorerie, points retirés au classement de la saison qui s'ouvre, interdiction de recruter.
- **L'interdiction de recruter s'applique réellement au mercato IA** : un club sanctionné ne participe pas au marché. Il peut encore perdre des joueurs et dégraisser — l'en empêcher l'enfermerait définitivement en infraction.
- **Le fil d'actualité rapporte chaque sanction**, quel que soit le club : un club qui démarre la saison avec six points de retard doit avoir une raison lisible.
- **La récidive est suivie par club** et persistée : recharger une sauvegarde ne purge plus les antécédents.

### Corrigé

- **Le contrôle tournait après le mercato.** Une interdiction prononcée à l'intersaison ne pouvait alors s'appliquer qu'à la fenêtre de l'année suivante. La commission passe désormais **avant** le marché, sur l'effectif d'avant-mercato — donc sur la saison réellement jouée. La faire passer après ne verrait d'ailleurs plus aucune infraction, puisque les clubs y dégraissent depuis V0.46.
- **Le retrait de points ne frappait que le club de l'utilisateur**, ce qui en faisait un handicap réservé au joueur plutôt qu'une sanction.

### Notes de modélisation

- Mesuré sur quatre saisons : Toulouse écope de 698 k€ d'amende la première année pour son dépassement de 17 %, dégraisse au mercato suivant, et plus aucun club n'est sanctionné ensuite. C'est le comportement attendu — les clubs IA s'autorégulent, et seul un manager humain peut choisir de forcer et d'assumer.
- Le retrait de points reste donc, en pratique, une sanction de joueur : l'IA ne récidive jamais assez pour l'atteindre. C'est une asymétrie assumée — la marge de manœuvre est le privilège de celui qui décide.

## [V0.46] — Le plafond s'applique à tout le monde

V0.45 rendait le salary cap opposable — mais au seul club de l'utilisateur. Les
clubs IA empilaient les salaires sans limite : la règle censée façonner tous les
effectifs n'en contraignait qu'un, et le manager était le seul à devoir arbitrer.

### Ajouté

- **Le mercato IA respecte le plafond** : la marge de recrutement d'un club est désormais la plus serrée de son budget et du plafond de sa division.
- **Le dégraissage** : un club au-dessus de la barre libère ses plus gros salaires jusqu'à repasser dessous — au maximum trois par intersaison, et jamais au point de descendre sous seize joueurs.
- **Le fil d'actualité raconte les libérations** (`DEPART_LIBRE`), avec sa formulation propre : un joueur libéré pour tenir le plafond ne « s'engage » nulle part.

### Corrigé

- **Un club en infraction y restait indéfiniment.** Le plafond gelait son mercato sans jamais le faire redescendre : il ne pouvait plus recruter, rien ne le poussait à vendre, et il traversait les saisons hors des clous.
- **Les mêmes cadres libérés deux fois par saison**, constaté en jeu : Toulouse relâchait Dupont, Ntamack et Baille à la journée 13, puis de nouveau à l'intersaison. Le dégraissage ne s'exécute plus qu'à l'intersaison — le plafond s'apprécie sur l'exercice, exactement comme la commission qui sanctionne.
- **Boucle libération / re-signature**, trouvée en mesurant six saisons : un club libérait ses gros salaires pour repasser sous la barre, puis les reprenait au complément d'effectif, pour les relâcher de nouveau l'année suivante. Antoine Dupont était libéré deux saisons de suite par Toulouse. Le complément d'effectif respecte maintenant le plafond lui aussi.

### Notes de modélisation

- On libère au **salaire**, pas au niveau : c'est de la masse salariale qu'il faut retirer, et viser le niveau ne ferait pas redescendre sous la barre. Effet observé — Toulouse libère Dupont, Ntamack et Baille, passe de 117 % à 99 % du plafond en une intersaison, et les trois sont récupérés par Bordeaux et La Rochelle. Le plafond redistribue le talent au lieu de le geler.
- Trois départs maximum par club et par fenêtre : au-delà, un club préfère l'amende à jouer à quinze.
- Mesuré sur six saisons simulées : plus aucun club en dépassement à partir de la deuxième, consommation maximale stabilisée entre 89 % et 99 %, médiane du championnat montée de 63 % à 80 % — les clubs utilisent leur marge sans jamais la franchir.

## [V0.45] — Une contrainte, une maison, une parole

### Ajouté

- **Le règlement s'oppose enfin** ([club/regulations.ts](../src/engine/club/regulations.ts)) : masse salariale plafonnée et quota JIFF contrôlés sur l'effectif, affichés en permanence sur l'écran des transferts, avec sanctions annuelles graduées — amende, retrait de points sur la saison suivante, interdiction de recruter.
- **La direction du club** ([club/club-management.ts](../src/engine/club/club-management.ts), [ClubDirectionScreen.tsx](../src/ui/screens/ClubDirectionScreen.tsx)) : chantiers pluriannuels (stade, centre d'entraînement, centre médical, boutique), prix des places, campagnes marketing, recettes de merchandising, et une projection de saison qui dit ce que tout cela rapporte.
- **La causerie de mi-temps** ([match/team-talk.ts](../src/engine/match/team-talk.ts)) : quatre tons dont la réception dépend de la situation, du moral et du sang-froid du groupe. Une causerie peut se retourner.

### Corrigé

- **`Club.salaryCapUsage` était un champ mort** : mis à `0` partout où l'on construisait un club, jamais calculé, jamais lu. Avec de la trésorerie, rien n'empêchait d'empiler trente joueurs à 85.
- **Le quota JIFF était décoratif** : `computeClubJiffStats()` n'était appelé que par l'écran Effectif, pour afficher un badge. Ni le mercato ni la composition ne le regardaient.
- **L'argent n'avait aucune destination.** Cinq natures de mouvement financier, aucun investissement possible — d'où les 116 M€ de trésorerie dormante observés en jeu sur une partie.
- **La mi-temps était une bascule tactique**, pas une causerie : les mêmes trois options qu'on mène de trente points ou qu'on se fasse démolir, aucun mot au groupe, aucun effet sur des hommes.

### Notes de modélisation

- **Le plafond est calibré sur les effectifs du jeu, pas sur le règlement réel.** À 10 M€ — le chiffre officiel — Toulouse démarrait à 140 % et perdait douze points avant la première journée. À 12 M€, il est en dépassement modéré (amende), Bordeaux est tendu, les douze autres ont de la marge.
- **Le quota JIFF s'apprécie en proportion, pas en nombre.** Un seuil absolu de seize mettait douze clubs sur quatorze en infraction dès le coup d'envoi. En ratio, tout le monde est conforme au départ, avec des marges de trois à treize recrues étrangères — la règle ne mord que si l'on recrute hors formation française.
- **Le dépassement n'est pas bloqué, il est sanctionné.** Interdire ferait de la règle une validation de formulaire ; l'avertir en fait une décision.
- **Monter les tarifs n'est pas un gain net.** L'affluence chute, et une enceinte pleine vaut un bonus de discipline tactique à domicile : +1 en tarif populaire, −0,9 en premium. Sans ce branchement, le premium aurait été un choix évident.
- **Une causerie ne se chiffre pas avant d'être tenue.** On qualifie la réception (« le moment s'y prête parfaitement », « le groupe ne comprendrait pas ») sans donner de probabilité : c'est un pari sur des hommes, pas un calcul.
- Un test a révélé un trou dans la table des tons : « mener de peu » n'avait aucune bonne réponse, ce qui rendait une mi-temps sur cinq arbitraire.

## [V0.44] — Un plancher, un encadrement, une semaine

Trois manques structurels, tous du même ordre : un système écrit mais jamais
branché, ou branché sans contrepartie.

### Ajouté

- **La descente existe, et la Pro D2 se joue** ([season/divisions.ts](../src/engine/season/divisions.ts)) : quatorze clubs de seconde division, persistants d'une saison à l'autre, avec leurs effectifs, leur économie et leurs objectifs propres. Le 14ᵉ descend, le champion de Pro D2 monte, le 13ᵉ défend sa place en barrage contre le 2ᵉ. On peut **commencer sa carrière en Pro D2** et bâtir la remontée.
- **Le staff se recrute** ([club/staff-market.ts](../src/engine/club/staff-market.ts)) : un vivier de techniciens renouvelé chaque saison, avec ce que chaque poste améliore, le titulaire en place en regard, et un candidat qui refuse un club trop petit pour lui. La réputation du manager compense la modestie de son club.
- **La semaine d'entraînement se paie** ([club/training-week.ts](../src/engine/club/training-week.ts)) : la charge agit sur la forme et la fatigue au-delà du week-end, et peut blesser. Le pronostic est annoncé avant le choix — forme, récupération, et nombre de blessés attendus.

### Corrigé

- **`resolveSeasonRelegation` n'était appelé nulle part.** Le classement colorait la zone rouge depuis V0.13, le tableau de bord avertissait, et à la fin de la saison il ne se passait rien : on pouvait finir 14ᵉ chaque année sans conséquence. Tout le bas de tableau était un décor.
- **La qualité d'encadrement était figée à vie.** `generateStaffForClub()` la dérivait de la seule réputation du club, à chaque appel. Elle pilote pourtant la progression des joueurs, les créneaux d'observation du scout et la formation : le levier le plus profond du jeu sur le long terme était le seul sans aucune prise.
- **Charger à l'entraînement ne coûtait rien.** Six points de fatigue au coup d'envoi contre un point et demi de discipline tactique : le choix se faisait tout seul, et lever le pied n'avait aucun intérêt.
- **Un `?` de trop dans la construction de match.** Les clubs hors CSV faisaient échouer la rencontre sur « Club inconnu » : la Pro D2 était injouable jusqu'à ce que `makeMatchInputFromSeed` accepte un fournisseur de clubs, comme il acceptait déjà un fournisseur d'effectifs.

### Notes de modélisation

- La Pro D2 compte quatorze clubs et vingt-six journées, comme le Top 14. La vraie en a seize : aligner les deux formats évite de rendre paramétrable tout ce qui suppose des phases finales aux journées 27 à 29, et la saison entière fonctionne alors sans une ligne de code spécifique.
- La division qu'on ne joue pas est résolue par un modèle léger — force des effectifs plus aléa large. Simuler les deux championnats match par match doublerait le coût d'une saison pour une information dont on n'a besoin qu'une fois par an.
- Les clubs de Pro D2 sont stables d'une saison à l'autre. Le module d'origine les tirait au hasard chaque année : le promu naissait au moment de monter et n'avait aucun passé.
- Un technicien refuse un club trop petit. Sans ce filtre, il suffirait d'avoir de la trésorerie pour rafler les meilleurs, et un promu s'offrirait le staff de Toulouse dès son premier été.
- La charge forte rapporte plus de forme qu'elle ne coûte en récupération — sinon personne ne la choisirait. Son prix est ailleurs : dix fois le risque de blessure d'une semaine légère, divisé par la qualité du staff médical.

## [V0.43] — Le manager répond

V0.42 avait donné au manager une mémoire et une boîte aux lettres, mais la
correspondance restait à sens unique : le président écrivait, on encaissait.
Signer dans un club était un clic, la patience du board était codée en dur, un
limogeage obligeait à reprendre un banc dans la seconde, les jeunes du centre se
fondaient dans l'effectif sans qu'on sache ce qu'ils devenaient, et le dossier
d'avant-match ne se dé-brouillait qu'en affrontant l'adversaire — c'est-à-dire
trop tard pour préparer quoi que ce soit.

### Ajouté

- **Négociation de contrat** ([season/contract-negotiation.ts](../src/engine/season/contract-negotiation.ts)) : durée, salaire et enveloppe de transfert se discutent à la signature. Le crédit auprès du président vient de l'écart entre réputation et stature du club ; un refus revient toujours avec une contre-proposition acceptable.
- **Mails actionnables** : entretien de presse après une série de défaites, convocation du bureau quand la confiance s'effrite, arbitrage sur l'enveloppe promise. Chaque option annonce ce qu'elle engage.
- **Année sabbatique** ([SabbaticalScreen.tsx](../src/ui/screens/SabbaticalScreen.tsx)) : un manager libre peut refuser tous les bancs et regarder la saison se jouer sans lui. Des **limogeages en cours de saison** ouvrent alors des postes, entre les journées 8 et 20.
- **Suivi des espoirs** ([club/academy.ts](../src/engine/club/academy.ts)) : chaque promotion du centre est suivie nommément — niveau de sortie, progression, temps de jeu, verdict — avec le bilan cumulé du centre.
- **Mission de scouting sur un club** : observer un effectif entier plutôt qu'un joueur, pour deux créneaux au lieu d'un. Le dossier d'avant-match s'affine journée après journée.

### Corrigé

- **Blocage complet de la partie dès que deux événements humains s'enchaînaient** (trouvé en vérifiant V0.43 en jeu). `useDismiss` arme un drapeau `closing` le temps de l'animation de sortie, avec un garde `if (closing) return`. Ce drapeau n'était jamais relâché : quand le parent réutilisait la même instance de modale pour présenter l'élément suivant de la file, **tous** les clics suivants étaient avalés. Plus aucun bouton ne répondait, et il n'existait aucune sortie — ni « Plus tard », ni choix d'option. Le garde se relâche désormais une fois l'action passée, et les trois modales à file d'attente (événement humain, décision de contrat, moment de match) portent une `key` sur l'élément affiché. Vérifié en jeu : la file se vide et la saison reprend son cours. Pas de test automatisé — le projet ne teste que `src/engine/**` et n'embarque aucune infrastructure de test de composant.
- **Les sollicitations partaient à chaque journée au lieu d'une fois.** La convocation du bureau se déclenche sur un **état durable** — confiance basse, classement en retard — et l'identifiant d'un message inclut la journée : le président réécrivait donc à chaque journée tant que l'état tenait. Onze lettres identiques sur un seul exercice, plus quatre entretiens de presse d'affilée, constatés en jeu. Les messages de ce type portent désormais une identité de déduplication à la saison. La justification écrite dans le code — « l'identifiant s'en charge » — était fausse et n'avait pas été vérifiée.
- **Le vestiaire de l'ancien club continuait de solliciter un manager limogé** : renouvellements de contrat et événements humains s'affichaient pendant une année sabbatique. Ces modales exigent maintenant d'être en poste.
- **Le bandeau affichait encore l'ancien club et sa mission** pendant une sabbatique. Il indique « Sans club » et masque l'objectif.
- **Un club sans joueur à un poste figeait la partie** (trouvé en vérifiant la négociation en jeu). Après quatre saisons de mercato et de retraites, un effectif peut n'avoir plus personne pour tenir le numéro 8. `pickStartingFifteen` levait alors une exception — non rattrapée, donc invisible : le bouton « Simuler la journée » ne faisait plus rien, sans le moindre message, et la saison était morte. Un dernier recours aligne désormais le meilleur joueur encore libre, hors de son poste s'il le faut. C'est mauvais pour l'équipe, c'est ce qu'un vrai club ferait, et c'est infiniment préférable à une partie qui se fige.
- **Le tutoriel d'accueil passait par-dessus la négociation de contrat.** Sa condition — « journée 1, aucun match joué » — est vraie au début de chaque saison, et aussi juste après une signature, qui reconstruit la session à zéro. Il exige maintenant une carrière encore vierge et laisse la priorité à toute décision de carrière en cours.
- **La patience du board était codée en dur** à deux saisons d'échec, quel que soit le contrat. C'est désormais ce qu'on achète en signant long — et ce qu'on perd en se payant cher.
- **Une saison passée sans club entrait au parcours de carrière**, créditant le manager d'un résultat qu'il n'avait pas produit.
- **`publishRoundNews()` était appelé deux fois** sur le chemin « pas de match du joueur ». Sans effet visible grâce à la déduplication du fil, mais deux fois le travail.

### Notes de modélisation

- Aucune demande de contrat n'est gratuite, et l'ordre des concessions n'est pas neutre : le budget de transfert sort du même portefeuille que les joueurs, il tombe donc en premier ; la durée résiste le mieux.
- Un salaire au-dessus du marché durcit la mission d'un cran et raccourcit le sursis d'une saison. Sans contrepartie, le palier le plus élevé serait un choix sans arbitrage.
- Les effets d'une réponse portent leur montant dans l'identifiant (`BUDGET_DEPENSER:2500000`) : la décision reste une simple chaîne, relisible dans une sauvegarde des saisons plus tard.
- Un limogeage en cours de saison exige six places sous les attentes, contre quatre en fin d'exercice — un club garde son entraîneur tant qu'il reste une saison à retourner.
- Un espoir se juge à sa **progression depuis la sortie du centre**, jamais à son niveau brut : +6 en deux ans vaut autant à 55 qu'à 70. Sa première saison ne compte pas, sous peine de punir la patience qu'on veut encourager.
- Les effectifs des clubs observés sont résolus à chaque journée plutôt que figés à l'affectation : un transfert rendrait la liste fausse.

## [V0.42] — Onglet « Ma carrière »

La carrière existait en pièces détachées : une réputation dans un coin du
tableau de bord, un objectif dans le bandeau, un limogeage noyé dans le fil
d'actualité du championnat, des offres dans une modale qui ne durait qu'un clic.
Rien ne réunissait tout cela, et surtout rien n'en gardait la trace.

### Ajouté

- **Onglet Ma carrière** ([CareerScreen.tsx](../src/ui/screens/CareerScreen.tsx)) : bandeau d'identité permanent (réputation, confiance du board, mission en cours, ancienneté au club) et trois vues — messagerie, parcours, palmarès.
- **Messagerie** ([season/mailbox.ts](../src/engine/season/mailbox.ts)) : sept expéditeurs qui écrivent **au manager**, avec non-lus badgés dans la navigation. Lettre de mission du président en ouverture de saison, verdict à la clôture, diagnostic du staff médical sur les blessures longues, bilan de fenêtre par la direction sportive, promotion du centre de formation, démarches de l'agent quand un banc se libère, jalons de carrière relevés par la presse.
- **Parcours** ([season/manager-record.ts](../src/engine/season/manager-record.ts)) : une ligne par saison dirigée — club, mission confiée, classement, verdict, variation de réputation — et la courbe de réputation depuis les débuts.
- **Palmarès** : totaux du manager, saison de référence, passages par club avec leur mode de fin.

### Corrigé

- **Le palmarès appartenait au club, pas au manager.** `clubPalmares()` comptait les Brennus du club courant : un entraîneur passé par Toulouse puis Vannes se voyait crédité du palmarès toulousain à vie, ou dépossédé de son propre titre en changeant de banc. Le parcours suit désormais l'homme.
- **La saison de référence se jugeait au classement brut.** Finir 4ᵉ en visant le titre n'est pas meilleur que finir 8ᵉ en visant le maintien : c'est l'écart à la mission qui départage.

### Notes de modélisation

- Le fil d'actualité raconte le **championnat** ; la messagerie s'adresse **au manager**. D'où le non-lu, qui n'a aucun sens pour l'un et tout son sens pour l'autre.
- Les identifiants de mail dérivent du contenu et de l'horodatage, comme pour le fil : rejouer une intersaison au rechargement d'une sauvegarde ne duplique pas les messages et ne **rouvre** pas ceux déjà lus.
- Les passages par club ne sont pas agrégés : revenir des années plus tard compte pour un second passage, sans quoi on effacerait précisément ce qui fait le sel d'un retour.
- Sauvegarde : `managerSeasons` et `mailbox` sont optionnels, les parties antérieures se chargent sans rien perdre — vérifié en jeu sur une sauvegarde V0.41.

## [V0.41] — Carrière du manager

Le joueur choisissait un club au début et y restait jusqu'à ce que le board le
remercie — auquel cas la partie s'arrêtait net et le renvoyait à l'écran de
sélection. La réputation était calculée, stockée, sauvegardée, et ne servait
qu'à durcir l'objectif de la saison suivante. Gagner le Brennus avec Vannes et
finir 9e avec Toulouse menaient au même endroit.

### Ajouté

- **Statut de manager** ([season/manager-career.ts](../src/engine/season/manager-career.ts)) : en poste, ou libre.
- **Valse des entraîneurs** : les clubs limogent le leur quand la saison trahit leur stature, plus une rotation de fond indépendante du classement. Relayée par le fil d'actualité.
- **Propositions de clubs** à l'intersaison, filtrées par l'écart entre la réputation du manager et la stature du club, avec l'objectif que le board fixera.
- **Un limogeage rend libre, pas mort** : d'autres clubs appellent, et signer ailleurs reconstruit la saison autour du nouvel effectif.

### Corrigé

- **La modale d'offres ne s'affichait jamais** (constaté en jeu). Elle et l'avis de licenciement vivaient dans la branche de rendu `season-setup`, héritage du temps où être remercié renvoyait à l'écran de sélection de club. La carrière n'y repassant plus, un manager limogé restait silencieusement sans club : le board le remerciait, la confiance tombait à 0, et le jeu enchaînait la saison suivante comme si de rien n'était. Les deux blocs sont remontés au niveau global, par-dessus l'écran courant.
- **Une proposition de tutorat passait au-dessus d'une décision de carrière.** La modale d'offres partage le z-index des modales de routine ; elle passe désormais devant — tant que le banc n'est pas repris, rien d'autre ne se décide.
- **Un manager modeste ne pouvait pas construire de carrière.** Finir 12e avec un promu **atteignait** l'objectif « maintien » mais déclenchait quand même le malus de bas de tableau : chaque saison réussie coûtait 3 points de réputation. La sanction ne s'applique plus que lorsque le classement trahit la mission, et dépasser nettement la commande rapporte désormais.

### Notes de modélisation

- La **stature** d'un club mêle réputation et budget : un club historique désargenté reste exigeant, un nouveau riche aussi. Prendre l'un sans l'autre laisserait passer un des deux cas.
- La portée est **asymétrique** : un grand club ne recrute pas un inconnu (+18 d'écart maximum), un petit club accueille volontiers une gloire (−45). C'est ce qui permet de rebondir sans jamais sauter les étapes vers le haut.
- Sans la **rotation de fond**, les seuls postes vacants étaient ceux des gros clubs — les objectifs modestes étant presque toujours atteints — et un manager limogé sans réputation ne recevait plus jamais d'offre.
- Un manager libre reçoit **toujours** au moins une porte de sortie : si sa réputation ne lui ouvre plus rien, le poste le moins prestigieux l'appelle. C'est la garantie centrale du module — la carrière ne se termine jamais.
- Un **nouveau board** ne tient pas les échecs précédents contre son entraîneur : la confiance repart à zéro en signant ailleurs.
- Rester sans club **érode** la réputation, faute de quoi on pourrait décliner toutes les offres modestes en attendant indéfiniment que le meilleur club appelle.

### Limite connue

Un manager sans club doit reprendre un banc pour continuer : le jeu ne sait pas
encore faire vivre une saison de spectateur. Forcer le choix vaut mieux que
proposer une option qui n'existe pas.

### Tests

579 tests, dont `manager-career.test.ts` (16 tests) : sanction proportionnée à
la stature, postes vacants à tous les étages, portée asymétrique, garantie de
rebond à toute réputation, et déterminisme à graine fixée.

## [V0.40] — Les actualités prennent leur onglet

Le journal de V0.38 était un tableau coincé sous le classement. Une liste de
lignes se lit comme un relevé comptable ; un fil se parcourt.

### Ajouté

- **Onglet « Actus »** dédié ([screens/NewsScreen.tsx](../src/ui/screens/NewsScreen.tsx)), en présentation de fil social : avatar, nom de compte, pseudo, ancienneté, corps du message et carte jointe pour le détail chiffré.
- **Comptes** : ce qui touche un club est publié par ce club, avec son blason et sa couleur ; le reste vient de la rédaction (`@lequinze`). Les blasons sont le repère le plus rapide pour savoir qui parle.
- Ancienneté comptée en **journées de championnat** (« 3 j », « intersaison », « 2 saisons ») — l'unité de temps du jeu.

### Corrigé

- **Le fil n'était pas ordonné.** Les entrées viennent de plusieurs sources — journée, mercato, fin de saison — qui ne se suivent pas chronologiquement : une J13 s'affichait au-dessus d'une J14. Le tri est désormais explicite et ne dépend plus de l'ordre d'insertion.
- **Un agent libre « quittait » son ancien club** alors qu'il n'en avait pas : « Bonnet quitte Sans club pour Vannes ». Il s'engage.
- Le pseudo d'un club contenait espaces et accents (`@la rochelle`), ce qui se lisait comme une faute plutôt que comme un compte.

### Supprimé

- `NewsPanel`, remplacé par l'écran dédié — ainsi que son CSS, plutôt que de le laisser mourir en place.

## [V0.39] — Centre de formation

L'académie sortait trois à six jeunes par intersaison, d'un niveau dicté par le
tier du club et rien d'autre. Le manager était spectateur du dernier grand
système du jeu.

### Ajouté

- **Investissement** (minimal à maximal) et **orientation** (avants, équilibrée, trois-quarts) du centre ([club/academy.ts](../src/engine/club/academy.ts)), réglables dans l'écran Entraînement.
- Jauge de niveau avec repère de la cible : on voit où l'on en est *et* où l'on va.
- Coût annuel prélevé à l'intersaison, indexé sur le budget du club.

### Notes de modélisation

- Le niveau **converge** vers la cible au lieu de la suivre : investir une saison puis couper ne donne rien (+0,35 par an au mieux). C'est ce qui fait de la formation un choix de long terme et non un curseur qu'on pousse l'année où l'on a de l'argent.
- La dégradation est **plus lente que la progression** (−0,2 contre +0,35). Le désinvestissement reste tentant à court terme et coûteux à long terme — exactement l'arbitrage qu'on veut poser.
- Un petit club plafonne plus bas qu'un gros : il progresse réellement sans rattraper Toulouse en une saison.
- L'orientation ne ferme jamais complètement l'autre versant : trois saisons d'orientation avants laisseraient sinon le club sans le moindre trois-quarts formé.
- Le bonus d'orientation est modeste (±4 de potentiel) : elle décide de **qui** l'on forme, la qualité vient de l'investissement.

## [V0.38] — Fil d'actualité

Le jeu produisait transferts, mercatos, blessures et titres sans en garder
trace. Seuls les mouvements de la dernière fenêtre restaient visibles.

### Ajouté

- **Journal du championnat** ([season/news.ts](../src/engine/season/news.ts)) : transferts, résumés de mercato, blessures longues, résultats hors norme, titres et classements finaux — horodatés par saison et journée, filtrables par nature, par saison et sur son propre club.
- Panneau dans l'écran Compétition, au contact du classement.

### Notes de modélisation

- Les entrées sont **immuables et dédoublonnées** par contenu : rejouer une intersaison après un rechargement est le cas normal, pas une exception.
- Le journal est **plafonné à 400 entrées**. Une carrière de vingt saisons en produirait des milliers, toutes sérialisées à chaque sauvegarde.
- Les **prolongations n'entrent pas** dans le fil : en consigner cent cinquante noierait tout le jour de la falaise de contrats.
- Un match n'est retenu qu'au-delà de 21 points d'écart. Un fil qui garde tous les matchs n'est plus un fil, c'est un calendrier.

## [V0.37] — Joker médical

Règle propre au rugby professionnel français, rendue possible par V0.31 : avant
elle, les blessures n'existaient que pour le club de l'utilisateur.

### Ajouté

- **Joker médical** ([club/medical-joker.ts](../src/engine/club/medical-joker.ts)) : un joueur absent au moins 8 journées peut être remplacé **hors fenêtre de mercato**. Onglet dédié dans l'écran Transferts.
- **Vivier d'agents libres** dès le coup d'envoi de la carrière (22 joueurs de complément).

### Corrigé

- **Le marché des agents libres restait vide toute la première saison** : les contrats n'expirant qu'à l'intersaison, il n'y avait littéralement personne à signer. Le joker aurait été décoratif, et un club décimé par les blessures ne pouvait rien faire.

### Notes de modélisation

- Quatre garde-fous, sans lesquels le joker deviendrait un moyen de recruter toute l'année en gardant un blessé sous le coude : absence longue, même poste, **pas meilleur que le blessé**, et un seul joker par blessé.
- Réservé aux **agents libres** : l'ouvrir aux joueurs sous contrat rouvrirait le marché des transferts hors fenêtre, ce que V0.30 ferme précisément.
- Le contrat s'achève en fin de saison. Le laisser signer trois ans ferait du joker le moyen le plus économique de constituer un effectif.

## [V0.36] — Dossier adversaire et débriefing

Le manager disposait de trois curseurs tactiques, dix-neuf rôles et un banc à
gérer — sans rien savoir de son adversaire avant, ni de ce que son plan avait
produit après. Un volant sans pare-brise ni rétroviseur.

### Ajouté

- **Dossier d'avant-match** ([club/opponent-report.ts](../src/engine/club/opponent-report.ts)) : forme, classement, manière de jouer déduite de l'identité du club, notes par ligne situées face au championnat, joueurs à surveiller et absents.
- **Débriefing d'après-match** ([match/team-stats.ts](../src/engine/match/team-stats.ts)) : possession, territoire, conquête mêlée et touche, coups de pied, ballons perdus, pénalités concédées — les deux camps face à face — suivis d'une lecture de ce que le plan a produit.

### Notes de modélisation

- **Tout le dossier passe par le scouting.** Un adversaire jamais observé ne livre ni note de ligne, ni point faible, ni joueur à surveiller. Le scouting ne servait qu'au recrutement, c'est-à-dire une fois par fenêtre ; il pèse désormais chaque semaine.
- Point délicat : `estimateAttribute` restitue la **valeur réelle** dans son point d'estimation et ne masque que l'affichage. S'y fier divulguait le niveau exact d'un adversaire inconnu — les notes de ligne sont donc explicitement neutralisées quand rien n'est su.
- Le débriefing **ne juge pas**. Il rapporte ce que le plan a provoqué et laisse conclure : aucun réglage n'étant censé dominer, dire « bon » ou « mauvais » serait faux.
- Le territoire se mesure sur ses propres possessions : les deux camps peuvent dépasser 50 % ensemble. Ce n'est pas un partage du terrain mais la hauteur de jeu de chacun.

## [V0.35] — Les rôles sortent de la feuille de match

Les rôles n'existaient que dans l'écran de composition : on ne pouvait pas
savoir, en regardant son effectif, qu'on n'avait aucun gratteur.

### Ajouté

- **Colonne « Profil »** dans le vestiaire : le rôle où les qualités du joueur servent le mieux. Triable — c'est ainsi qu'on repère d'un coup d'œil un trou dans l'effectif.
- **Panneau « Rôles »** sur la fiche joueur : les deux ou trois rôles de son poste classés par affinité, chacun avec son appréciation (« rôle naturel », « à l'aise », « convenable », « hors de son registre ») et sa description.
- `roleFitness()` et `fitLabel()` ([match/roles.ts](../src/engine/match/roles.ts)).

### Changé

- `bestRoleFor` s'appuie désormais sur `roleFitness` : une seule source de vérité pour le choix automatique, la colonne du vestiaire et la fiche joueur. Les trois écrans ne peuvent plus se contredire.
- L'affinité compare des **moyennes** et non des sommes. Sans cela, un rôle touchant six attributs l'emportait mécaniquement sur un rôle qui en touche trois — on mesurait la largeur du rôle, pas son adéquation au joueur.

### Notes de modélisation

- Un rôle reste un choix de **composition**, pas un attribut du joueur. Ce qu'on affiche hors match est donc un profil déduit de ses attributs, jamais une donnée stockée.
- L'affinité regarde autant ce que le rôle **sacrifie** que ce qu'il amplifie : un joueur convient à un rôle quand ses points forts sont ceux qu'on met en avant *et* que ce qu'on lui retire n'était pas sa qualité première.
- Les seuils d'appréciation sont calés sur la distribution réelle du championnat (scores de −11 à +18, médiane 1,5). À vue, « rôle naturel » n'aurait concerné que 2 % des joueurs et l'étiquette n'aurait jamais servi.

### Tests

490 tests, dont 5 nouveaux sur l'affinité : classement complet, cohérence avec le choix automatique, comparabilité entre rôles de largeurs différentes.

## [V0.34] — Rôles de joueurs

Deux ouvreurs de même niveau étaient rigoureusement le même joueur pour le
moteur. Le plan de match décide de la manière de jouer de l'équipe ; les rôles
décident de celle de chaque homme.

### Ajouté

- **19 rôles** couvrant les quinze postes, deux ou trois par poste ([match/roles.ts](../src/engine/match/roles.ts)) : pilier d'ancrage ou baladeur, talonneur lanceur ou troisième flanker, gratteur, porteur ou plaqueur, métronome ou animateur…
- **Sélecteur de rôle** sur chaque titulaire de la composition, à côté du choix du joueur.
- **Choix automatique** (`bestRoleFor`) : sans consigne, on retient le rôle qui met le mieux en valeur le joueur. Les équipes IA en bénéficient aussi — sans quoi le manager aurait été le seul du championnat à aligner des rôles.

### Notes de modélisation

- Un rôle est une **transformation pure** du joueur, appliquée à la copie que reçoit le moteur. Aucun sous-système ne connaît l'existence des rôles : la mêlée, la touche et le jeu courant lisent les mêmes champs qu'avant. Ajouter un rôle, c'est ajouter une ligne de tableau.
- **Somme nulle** : chaque rôle donne autant qu'il retire. Neuf des dix-neuf ne l'étaient pas à la première écriture — je les avais réglés au jugé, avec des dérives allant jusqu'à +15 — et un test le vérifie désormais rôle par rôle.
- Le rôle suit le **poste occupé sur la feuille**, pas le poste nominal : un centre aligné à l'aile joue un rôle d'ailier.
- La fiche du joueur en base n'est jamais modifiée : un rôle vaut pour un match, pas pour une carrière.
- Un rôle qui pointe vers un attribut spécifique absent est ignoré plutôt que de le créer — donner une « qualité de lancer » à un ailier n'aurait aucun sens.

### Tests

485 tests, dont `roles.test.ts` (14 tests) : couverture des quinze postes, neutralité du total d'attributs, non-mutation du joueur d'origine, respect des bornes 1-99, pertinence du choix automatique.

## [V0.33] — Bord de touche

Les huit remplacements, la fatigue individuelle et les règles de première ligne
existaient depuis V0.13 — en pilote automatique. Le manager ne voyait ni qui
était cuit, ni qui attendait sur le banc, et ne pouvait rien y faire.

### Ajouté

- **Panneau « Bord de touche »** pendant le match : les quinze sur le terrain avec leur fatigue, le banc avec les postes que chacun couvre, le quota de remplacements.
- **Remplacements manuels** — `substitute()` sur `MatchSession`. Le moteur applique ses propres règles (quota de 8, couverture de poste, retour interdit) et renvoie un motif lisible en cas de refus.
- **Ajustement tactique en cours de match** — `setTacticalPlan()` : occupation et ligne défensive se changent à la mi-temps ou dans l'urgence, avec effet immédiat sur les phases à venir.
- Alerte quand le pack n'a plus de première ligne de rechange (mêlées simulées).

### Notes de modélisation

- Un remplaçant qui ne couvre pas le poste est **grisé, pas masqué** : le manager doit comprendre pourquoi c'est impossible.
- Le banc est verrouillé pendant qu'un live moment attend une décision — on ne gère pas deux choses à la fois.

## [V0.32] — Le plan de match existe enfin

`PreMatchTacticalPlan` était déclaré dans les types, transporté dans chaque
`MatchInput`, et **lu par aucun sous-système**. Les deux équipes de tous les
matchs du jeu partaient avec la même valeur codée en dur. Le moteur simulait
cinq sous-systèmes en profondeur ; le manager n'avait que deux boutons pour
l'infléchir.

### Ajouté

- **Trois curseurs** effectifs ([match/tactics.ts](../src/engine/match/tactics.ts)) : occupation du terrain, ligne défensive, travail des phases arrêtées — exposés dans l'écran pré-match.
- **Les clubs IA jouent selon leur identité** (`planForIdentity`) : affronter un club de jeu d'avants ou un club de grand écart ne se ressemble plus.

### Changé

- Le plan neutre est désormais `MEDIANE / RIDEAU / NONE` (au lieu de `MONTANTE`, devenue une défense agressive). C'est ce que joue le harnais de calibration : les douze cibles restent mesurées sur un jeu sans parti pris.

### Notes de modélisation

- **Aucun plan ne domine.** Mesuré sur 1500 matchs entre équipes égales, le différentiel s'étale de +0,7 à −1,1 point autour du plan neutre — sous le bruit d'un match isolé. Ce qui change, ce sont les **profils** : occupation haute → matchs fermés (18/17), ballon en main → matchs ouverts (18/19), défense montante → plus de ballons récupérés mais une pénalité de plus par match, mêlée travaillée → conquête de 76 % à 81 %.
- Le premier réglage était **dix fois trop faible** pour se voir, le deuxième faisait de la défense reculée un choix sans inconvénient — donc le seul rationnel. Le point délicat : les probabilités de base diffèrent d'un ordre de grandeur entre faute de main (~1 %) et pénalité (~16 %), si bien qu'un multiplicateur identique sur l'une et l'autre n'équilibre rien.
- Chaque axe de conquête travaillé se paie en jeu courant. Sans ce coût, tout manager cocherait les trois cases.

## [V0.31] — Trois corrections de fond

Pas de nouveauté : trois problèmes qui vidaient de leur valeur des chantiers
déjà livrés.

### Corrigé — la falaise de contrats

Tous les contrats du seed s'achevaient en 2027. À l'intersaison suivante, près
de deux cents joueurs devenaient libres d'un coup. Les clubs IA encaissaient
grâce à la prolongation automatique de V0.29 ; l'effectif de l'utilisateur, qui
se renouvelle à la main, **perdait 26 points de moyenne en une saison et ne s'en
relevait jamais**.

Les échéances sont désormais réparties sur 2026-2029 ([seed.ts](../src/data/seed.ts)),
soit deux à six dossiers par saison au lieu de la totalité de l'effectif. Mesuré
sur six saisons : un manager attentif tient à 69 de moyenne (au-dessus des 60 de
l'IA), un manager passif retombe à 53. Une conséquence, plus une annihilation.

### Corrigé — l'état perdu au rechargement

Les focus d'entraînement (V0.14), la connaissance du scouting (V0.15) et les
délais après refus d'offre (V0.28) ne vivaient qu'en mémoire. Recharger une
partie les effaçait — au point qu'il suffisait de sauvegarder puis recharger
pour reproposer une offre qu'un joueur venait de décliner.

Sauvegarde en **0.5.0**. Les champs ajoutés sont optionnels : une partie
antérieure reste lisible et repart des valeurs par défaut.

### Corrigé — l'infirmerie à sens unique

`rollPostMatchInjuries` et `rollPostMatchCards` ne s'appliquaient qu'à l'effectif
de l'utilisateur : il perdait des joueurs, ses adversaires jamais. Les matchs
auto-simulés produisent désormais blessures et suspensions pour les deux camps,
avec guérison à chaque journée. Mesuré en jeu après huit journées : quinze
blessés et deux suspendus répartis sur neuf clubs.

**Et surtout** : `makeMatchInputFromSeed` composait les équipes à partir du CSV
brut. Un joueur transféré continuait de jouer pour son ancien club, un blessé
était aligné comme si de rien n'était — autrement dit **tout le mercato des
clubs IA de V0.29 et V0.30 n'avait aucun effet sur le terrain**. Les compositions
s'appuient maintenant sur l'effectif réel, overrides compris.

### Notes de modélisation

- La session ne possède pas les effectifs adverses ; elle tient un calque des
  joueurs qu'elle modifie, que l'appelant répercute — même mécanisme que pour le
  roster du club utilisateur.
- Les guérisons balaient les effectifs réels et non ce calque : celui-ci repart
  vide après un chargement, ce qui aurait condamné tout blessé adverse à ne
  jamais revenir.
- L'échelonnement des contrats répartit d'abord uniformément, puis ne corrige que
  les cas absurdes (un contrat courant au-delà de 37 ans). Raccourcir la plage
  des vétérans paraissait plus fin, mais déplaçait la falaise au lieu de la
  supprimer.

### Tests

457 tests (contre 442), dont `seed-contracts.test.ts`, `save-roundtrip.test.ts`
(aller-retour complet par JSON, y compris la relecture d'une sauvegarde 0.4.0)
et `match-input-roster.test.ts` (blessé, suspendu et transféré écartés de la
composition).

## [V0.30] — Mercato d'hiver

V0.29 faisait bouger le championnat, mais une seule fois par an. Et le marché
n'avait toujours pas de calendrier : les clubs IA attendaient l'intersaison
pendant que le manager pouvait signer n'importe qui à n'importe quelle journée.
Deux régimes différents pour les mêmes règles.

### Ajouté

- **Fenêtres de mercato** ([season/transfer-window.ts](../src/engine/season/transfer-window.ts)) — estivale (J1-J3) et hivernale (J13-J16). Hors fenêtre, aucun joueur sous contrat ne change de club.
- **Mercato d'hiver des clubs IA**, joué à l'ouverture de la fenêtre : pas de prolongations, pas de reconstruction d'effectif, **un seul renfort et un seul départ** par club.
- **Diagnostic sensible aux blessures** — un joueur absent longue durée cesse de couvrir son poste, ce qui est la première raison d'aller au marché en janvier.
- **Pression du classement** — un club nettement en dessous du rang que sa réputation laissait espérer cherche partout et **surpaie le salaire** pour convaincre.
- **Pastille d'état du marché** dans l'écran Transferts, et bouton « recruter » désactivé hors fenêtre.
- `applyExternalTransfers` sur `SeasonSession` : les indemnités du mercato d'hiver entrent réellement dans les comptes des deux clubs.

### Changé

- **Le manager est soumis à la même contrainte calendaire que l'IA.** Il pouvait acheter en continu pendant que l'IA attendait l'été : un avantage que rien ne justifiait, et qui vidait de son sens la contrainte imposée à tout le monde. Les **agents libres restent signables toute l'année** — ils n'appartiennent à personne, et c'est le seul recours d'une équipe décimée en février.
- **`perceivedRank`** ([transfer-offers.ts](../src/engine/club/transfer-offers.ts)) — un joueur juge un club sur son classement **et** sa stature, moitié-moitié. Formule partagée par l'IA et le manager.

### Corrigé

- **Une liste de cibles s'épuisait sur des vendeurs fermés.** Les meilleurs joueurs disponibles appartiennent aux clubs les plus sollicités, qui atteignent vite leur plafond de ventes ; ils occupaient toute la liste et aucune offre n'aboutissait. Les clubs fermés sont désormais écartés en amont.
- **L'IA proposait parfois une baisse de salaire.** La surenchère s'appliquait au tarif du marché, pas au salaire que le joueur touchait déjà.

### Notes de modélisation

- Sans `perceivedRank`, le mercato d'hiver était **impossible par construction** : les clubs qui ont besoin de se renforcer sont par définition mal classés, donc personne n'acceptait de les rejoindre.
- Un club sous pression **balaie tous les postes** au lieu de ses trois points faibles. Ce sont justement les postes où un grand club en difficulté reste bon, donc où le renfort est hors de prix : se limiter à eux le condamnait à l'inaction.
- Le seuil de panique est calé haut (5 places de retard). À 3, dix clubs sur quatorze se jugeaient en crise à la trêve et le marché d'hiver devenait plus agité que celui d'été — l'inverse de la réalité.
- Une **limite connue** : les blessures ne sont simulées que pour le club de l'utilisateur. Le levier « blessure longue durée » est donc en place et testé, mais ne se déclenche jamais pour les clubs IA tant que leurs matchs sont résolus sans suivi individuel.

### Tests

442 tests (contre 426), dont `transfer-window.test.ts` (7 tests) et l'extension de `season-flow.test.ts` : non-chevauchement des fenêtres, blocage des offres du manager hors fenêtre, circulation des indemnités, sobriété du mercato d'hiver face à celui d'été.

## [V0.29] — Le championnat vit sans vous

V0.28 permettait d'acheter ses concurrents ; l'inverse n'existait pas entre eux.
Un effectif adverse en 2031 était celui de 2025, aux retraites et aux jeunes
près. Le monde ne bougeait que quand le manager le touchait.

### Ajouté

- **Mercato des clubs IA** ([club/ai-market.ts](../src/engine/club/ai-market.ts)) — chaque intersaison, les clubs diagnostiquent leur effectif, prolongent, recrutent et se vendent des joueurs entre eux.
- **Diagnostic d'effectif** — `diagnoseSquad` classe les postes par gravité, en combinant le manque de couverture et l'écart au niveau moyen du championnat.
- **Trois natures de mouvement** distinguées (`TRANSFERT`, `RECRUE_LIBRE`, `PROLONGATION`) : une intersaison compte quelques transferts payants et parfois des dizaines de prolongations, et les mélanger noierait l'information.
- **Onglet « Mercato du championnat »** dans l'écran Transferts : quatre chiffres de tendance puis la liste des mouvements.
- `ALL_POSITIONS` dans [types.ts](../src/engine/types.ts) — source unique pour parcourir les quinze postes.

### Changé

- **L'IA passe par `resolveTransferOffer`**, exactement comme le manager. Un barème parallèle aurait divergé au premier réglage et produit des transferts que le joueur ne pourrait pas reproduire.
- **Prime de contrat récent** dans `askingPriceFor` : un club qui vient de sécuriser un joueur sur trois ans ou plus ne le cède plus au prix du marché. Sans elle, les mêmes joueurs rebondissaient de club en club chaque été.

### Corrigé

- **Le championnat se vidait.** Tous les contrats du seed expirant la même année, `expireContracts` versait près de 200 joueurs à la rue d'un coup : les effectifs IA tombaient à une douzaine de joueurs et n'en sortaient jamais, faute de quiconque pour re-signer côté IA. Les clubs IA prolongent désormais leurs propres joueurs avant d'aller voir ailleurs, et complètent jusqu'à 26 joueurs.
- **Le meilleur effectif servait de supermarché** : quatre cadres du même club partaient le même été, puisqu'ils constituaient mécaniquement la meilleure amélioration disponible pour tout le monde. Deux départs payants maximum par club et par fenêtre.
- **Un joueur pouvait enchaîner deux clubs dans la même intersaison**, ce qui faussait aussi le décompte des indemnités.

### Notes de modélisation

- L'IA **ne touche jamais** à l'effectif du club utilisateur. Vendre un de ses joueurs sans son accord serait une décision prise à sa place ; c'est le rôle des offres entrantes, qu'il accepte ou refuse.
- Le **titulaire** se juge au poste exact, la **couverture** par groupe de postes. Les confondre faisait qu'un bon ailier masquait un arrière médiocre, et le club ne voyait jamais le trou.
- Un club explore une **liste de cibles**, pas un nom. Avec une seule tentative par besoin, un prix hors budget ou un joueur qui décline asséchait le marché : deux transferts par intersaison sur tout un championnat, alors qu'une quarantaine de candidats étaient disponibles.
- Un poste **dégarni** accepte une doublure un peu moins bonne ; un poste **pourvu** exige un vrai titulaire. Sans cette distinction, seules les superstars changeaient de club.
- Les **agents libres passent avant** : payer des millions pendant qu'un joueur équivalent attend sans club n'aurait aucun sens.
- Les clubs interviennent par **ordre de puissance financière**, ce qui reproduit la hiérarchie du marché : les gros servis d'abord, les autres sur ce qui reste.

### Tests

426 tests (contre 404), dont `ai-market.test.ts` (22 tests) : aucun joueur perdu ni dupliqué, masse monétaire conservée, effectif de l'utilisateur intact, plafonds d'achats et de ventes, reconstitution d'un effectif décimé, déterminisme à graine fixée.

## [V0.28] — Transferts sortants

Le marché n'exposait que `offerToFreeAgent`. On pouvait parcourir les 245 joueurs
du championnat, envoyer un scout, resserrer les fourchettes… et **ne jamais en
signer un seul** : les agents libres n'apparaissent qu'à l'intersaison, si bien
que l'onglet Transferts restait une impasse toute l'année. Le scouting de V0.15
produisait une information sans usage. Cette version lui en donne un.

### Ajouté

- **Offres pour joueurs sous contrat** ([club/transfer-offers.ts](../src/engine/club/transfer-offers.ts)) — valorisation, décision du club vendeur, décision du joueur, garde-fous financiers.
- **Deux refus distincts et attribués** — le club (indemnité, profondeur au poste, urgence financière) puis le joueur (salaire, projet sportif, temps de jeu probable, loyauté). Un refus anonyme n'apprend rien : le manager doit savoir quel curseur bouger.
- **Contre-proposition chiffrée** — face à une offre sérieuse (≥ 60 % de sa demande), le vendeur annonce son prix et l'écran propose de s'aligner. En dessous, il se contente d'un refus sec.
- **Délai après refus** — 4 journées si le joueur a dit non, 2 après un lowball, **aucun** quand le vendeur a chiffré sa demande : la négociation reste ouverte tant qu'on discute d'un prix.
- **Estimation de valeur brouillée** ([estimateValue](../src/engine/club/scouting.ts)) — la fourchette se resserre avec la familiarité. Sans rapport de scouting, la valeur est illisible et le curseur d'indemnité part du salaire, une information publique.
- **Colonne Valeur** dans la recherche et **modale de négociation** ([TransferMarketScreen](../src/ui/screens/TransferMarketScreen.tsx)).
- `previewBid` / `submitBid` / `getBidHistory` sur `SeasonSession` : débit de l'acheteur, crédit du vendeur, mise à jour de l'effectif et pénalité de cohésion en cas de recrue à contre-culture.

### Changé

- **Échelle des indemnités recalée** sur la trésorerie du jeu : base cubique au lieu d'une puissance 2,15. Les meilleurs joueurs du championnat valaient moins d'un million face à 39 M€ de trésorerie — on achetait la moitié du Top 14 dès la première journée. Un titulaire solide coûte désormais 2-3 M€, un international 9-12 M€.
- **La couverture au poste se juge par groupe**, via `canCover` (règles de dépannage déjà écrites pour le banc). À poste exact, 61 % des joueurs du championnat étaient les seuls détenteurs du leur, donc intransférables — la mécanique aurait été morte-née.

### Notes de modélisation

- `hidden.ambition` et `hidden.loyaute` existaient depuis le début **sans influencer quoi que ce soit**. Ils pilotent maintenant la décision du joueur : l'ambition pondère le gain de classement, la loyauté freine tout départ.
- L'attrait salarial **sature** (`tanh`). En proportionnel pur, tripler le salaire rapportait +200 points de score : l'argent écrasait le projet sportif, le temps de jeu et la loyauté, et tout le monde signait. Un joueur bien payé l'est déjà assez.
- Le club vendeur ne chiffre sa demande que face à une offre sérieuse. Sinon un euro symbolique aurait donné le tarif de tout le championnat, et le scouting aurait à nouveau perdu son rôle dans la valorisation.
- Un joueur **sans aucune couverture n'est pas à vendre, à aucun prix** — et ce refus s'évalue avant l'examen de l'indemnité, sinon un gros chèque emportait un joueur déclaré non vendable.
- La graine du tirage intègre les termes de l'offre : améliorer sa proposition rebat les dés, reproposer la même chose donnerait le même refus.

### Tests

404 tests (contre 372), dont `transfer-offers.test.ts` (26 tests) et 6 tests d'intégration dans `season-flow.test.ts` : monotonies de la valorisation, refus attribuable, poids d'`ambition` / `loyaute` mesuré sur échantillon, déterminisme à graine fixée, mouvements financiers des deux clubs, non-fuite de la valeur exacte dans le chiffrage.

> Les jalons **V0.16 à V0.27** (direction artistique « broadcast », refonte de l'architecture de l'information, coque HUD fixe, défilement stable) ne sont pas encore consignés ici.

## [V0.15] — Brouillard sur les joueurs (scouting)

Un joueur était un tableau de chiffres exacts : `hidden.potentiel` n'était affiché
nulle part, mais il n'était pas *estimé* non plus. Recruter revenait à lire un
tableau, jamais à faire un pari — et le poste de `SCOUT_PRINCIPAL` n'était qu'un
intitulé. Cette version complète la boucle de V0.14 : former un joueur n'a de
saveur que si l'on ignorait ce qu'il valait.

### Ajouté

- **Connaissance graduelle** ([club/scouting.ts](../src/engine/club/scouting.ts)) — chaque joueur porte une familiarité 0-100 vis-à-vis du club. Attributs et potentiel s'affichent en **fourchettes** qui se resserrent avec l'observation.
- **Quatre sources de connaissance** : son propre effectif (connu dès le premier jour, affiné par les matchs joués), les adversaires affrontés, les cibles mises sous observation, et l'inconnu total.
- **Missions d'observation** — le scout couvre 2 à 5 joueurs simultanément selon sa compétence. Les premières observations apprennent beaucoup, les suivantes affinent.
- **Rapport de scouting** sur la fiche joueur : niveau actuel, potentiel estimé, marge de progression, niveau de certitude et jauge de familiarité.
- **Barres d'attribut incertaines** ([AttributeBar](../src/ui/components/AttributeBar.tsx)) — bande translucide pour la fourchette, repère sur la meilleure estimation, hachures quand le joueur n'a jamais été observé.
- **Colonne Potentiel** dans l'écran Entraînement et le marché des transferts, avec bouton « observer » pour affecter le scout.

### Changé

- L'écran Entraînement n'utilise plus une approximation par l'âge pour la marge de progression : il s'appuie sur l'estimation réelle du scout.
- Le `SCOUT_PRINCIPAL` a enfin un effet : sa compétence détermine la vitesse d'acquisition, la précision des estimations et le nombre de créneaux d'observation.

### Notes de modélisation

- L'estimation est une **fonction pure** de (valeur réelle, familiarité, sel). Une estimation retirée au hasard à chaque rendu aurait permis de « rafraîchir » l'affichage jusqu'à deviner la vraie valeur. Le biais du scout est donc stable : il peut se tromper, mais toujours dans le même sens.
- Le **potentiel d'un joueur mûr est mieux cerné** que celui d'un espoir : à 30 ans, il l'a déjà atteint. Sans cet ajustement, on affichait « 89–99 » pour un pilier de 30 ans, comme s'il pouvait encore exploser.
- La marge annoncée tient compte de l'âge : le potentiel nominal d'un vétéran reste au-dessus de son niveau décliné, et lui promettre « encore un peu de marge » à 33 ans serait un mauvais conseil.
- Un potentiel estimé ne descend jamais sous le niveau déjà atteint — un scout peut se tromper sur la marge, pas sur ce qu'il a sous les yeux.

### Corrigé

- Le manager démarrait sa saison sans rien savoir de **ses propres joueurs** : la connaissance n'était initialisée qu'à la première avancée de journée.

### Tests

372 tests (contre 343), dont `scouting.test.ts` (29 tests) : convergence de l'estimation, stabilité entre deux affichages, plafond de connaissance, sources concurrentes et limite de créneaux.

### Limite connue

Le scouting ne s'applique aujourd'hui qu'aux agents libres : il n'existe pas encore
d'écran pour parcourir les effectifs des autres clubs. La mécanique est en place,
il lui manque une porte d'entrée.

## [V0.14] — Boucle de développement

Le jeu récompensait de **bien sélectionner**, jamais de **construire** :
`season/aging.ts` était le seul endroit du code où les attributs d'un joueur
bougeaient, via une courbe d'âge appliquée au rollover. L'entraînement ne produisait
qu'un bonus tactique valable un match, et les 8 membres du staff n'avaient aucun
effet mécanique. C'est la boucle qui manquait pour tenir sur dix saisons.

### Ajouté

- **Développement des joueurs** ([club/development.ts](../src/engine/club/development.ts)) — chaque intersaison, un joueur reçoit un budget de progression réparti selon son focus d'entraînement. Le budget dépend de cinq facteurs :
  1. **le temps de jeu**, de loin le plus important — un jeune qui ne joue pas ne progresse pas
  2. l'âge (progression jusqu'à ~27 ans, déclin ensuite)
  3. la marge restante jusqu'au potentiel
  4. le `professionnalisme` du joueur, attribut jusque-là inexploité
  5. la qualité du staff **dans le domaine réellement travaillé**
- **Six focus d'entraînement** : Équilibré, Physique, Technique, Spécifique au poste, Mental, Récupération. Le mental progresse à tout âge ; le travail physique ralentit le déclin d'un vétéran.
- **Staff doté d'une compétence** ([club/staff.ts](../src/engine/club/staff.ts)) — note 0-100 corrélée à la réputation du club, salaire associé, et agrégation en qualité d'encadrement par domaine. Les 8 rôles ne sont plus de simples voix.
- **Écran Entraînement** ([TrainingScreen](../src/ui/screens/TrainingScreen.tsx)) — focus par joueur ou pour tout l'effectif, minutes jouées de la saison, appréciation du temps de jeu, et le détail de l'encadrement du club.
- **Bilan d'intersaison** sur le tableau de bord — qui a progressé, qui a décliné, avec le détail attribut par attribut (`Endurance 85→86`) et l'explication du pourquoi.
- **Minutes cumulées par joueur** sur la saison (`seasonPlayerStats.minutes`), qui alimentent le développement. Les remplaçants entrés en jeu comptent : c'est le banc actif de V0.13 qui rend leurs minutes réelles.

### Changé

- `rolloverSeason` accepte des entrées de développement et renvoie des rapports de progression. Sans ces entrées, le vieillissement V0.7 par courbe d'âge reste appliqué (rétrocompatibilité).
- La qualification européenne d'une nouvelle carrière est estimée d'après la réputation du club, à défaut de classement précédent.

### Notes de modélisation

- Le budget de progression est exprimé **par attribut**, non en points totaux. Une première version raisonnait en total réparti sur la vingtaine d'attributs d'un joueur : un espoir à potentiel 88 plafonnait à 57 au bout de huit saisons.
- En **déclin**, le focus désigne ce que le joueur **protège**, pas ce qu'il développe. Réutiliser la répartition de progression faisait perdre *davantage* de vitesse au vétéran qui travaillait sa vitesse.
- Le focus « poste » **pondère** les gestes spécifiques sans geler le reste : n'entraîner qu'eux figeait le plaquage d'un talonneur à vie.

### Tests

343 tests (contre 314), dont `development.test.ts` (29 tests) : dominance du temps de jeu, courbe d'âge, plafond de potentiel, effet de chaque focus, professionnalisme, encadrement par domaine, et lisibilité des rapports.

## [V0.13] — Profondeur du moteur de match

Quatre chantiers qui s'attaquent aux limites structurelles du moteur plutôt qu'à des bugs.
**Calibration : 12/12 cibles atteintes** — dont « points cumulés par match », jamais verte jusqu'ici.

### Ajouté

- **Banc actif** ([engine/match/bench.ts](../src/engine/match/bench.ts)) — les 8 remplaçants étaient purement décoratifs (`session.ts` : « pas de bench actif »). Désormais :
  - fatigue **par joueur**, modulée par l'endurance et par le rôle tenu dans la phase
  - 8 remplacements maximum, pas de retour d'un joueur sorti, couverture de poste vérifiée
  - première ligne spécialiste obligatoire, sinon **mêlées simulées**
  - politique de remplacement automatique déterministe pour les deux camps
  - live moment `BENCH_CALL` à l'heure de jeu (vider le banc / entrée ciblée / garder les cartouches)
  - minutes réellement jouées par joueur (elles étaient codées en dur à 80)
- **Défense de ligne** ([engine/match/goal-line.ts](../src/engine/match/goal-line.ts)) — nouvelle phase `GOAL_LINE`. Franchir les 22 mètres valait auparavant **92 % d'essai sur une seule phase** : le pilonnage, le grattage héroïque et l'en-avant sur la ligne n'existaient pas. La séquence se résout maintenant par attrition (2 à 5 temps), avec essai, pénalité, grattage, en-avant ou tenu. Live moment `GOAL_LINE_STAND`, décliné en attaque et en défense.
- **Discipline** ([engine/match/discipline.ts](../src/engine/match/discipline.ts)) — le moteur ne sifflait que **2,8 pénalités par match** (contre une vingtaine dans la réalité) à taux fixes, et les attributs `discipline` / `agressivite` n'avaient donc aucun effet. Les taux dépendent désormais de la discipline, de l'agressivité et de la fatigue ; le fautif est nommé.
- **Duel porteur / défenseur** ([engine/match/carry.ts](../src/engine/match/carry.ts)) — `openplay.ts` moyennait les sept trois-quarts en un seul nombre : aucun joueur n'existait individuellement. Chaque phase de jeu courant enchaîne maintenant 3 à 5 contacts, chacun opposant un porteur désigné au défenseur de son canal. En découlent des statistiques individuelles réelles (courses, mètres, plaquages, plaquages manqués, défenseurs battus, franchissements, ballons grattés) et un narratif nominatif.
- **Coupe d'Europe** ([engine/season/european-cup.ts](../src/engine/season/european-cup.ts)) — seconde compétition entrelacée au championnat. Qualification selon le classement précédent (6 en coupe majeure, 4 en Challenge), poule de 4 matchs greffés sur des journées de Top 14, puis phases finales. Les adversaires européens sont **générés procéduralement**, ce qui évite d'ajouter une dépendance de licence sur des clubs étrangers. Ces semaines doubles **forcent enfin la rotation d'effectif**.
- **Relégation** ([engine/season/relegation.ts](../src/engine/season/relegation.ts)) — le 14e descend, le 13e dispute un barrage contre le 2e de Pro D2, le champion de Pro D2 monte. L'objectif « maintien » du président a désormais des conséquences.

### Changé

- **Échelle de fatigue rééchelonnée (×2,1)** — la fatigue plafonnait à **37/100** en fin de match : l'échelle n'était exploitée qu'au tiers, et le live moment `FATIGUED_STAR` (seuil 75) était donc **du code mort**. On termine maintenant autour de 75-80 sans banc, 45-50 avec, ce qui rend l'endurance et la gestion du banc réellement décisives.
- Les sous-systèmes reçoivent une fatigue ciblée : mêlée / touche / ruck lisent celle du pack, le buteur la sienne (au lieu d'une moyenne d'équipe unique).
- Les effets de live moment s'appliquent au camp réellement contrôlé par le joueur (ils étaient câblés en dur sur `HOME`, ce qui les rendait inopérants à l'extérieur).
- `applyMatchToPlayerStates` reçoit les vrais remplaçants entrés en jeu (`subIds` était un tableau vide en dur).
- Coefficients de calibration retouchés dans `openplay.ts`, `ruck.ts`, `kicking.ts` et la décision de pénalité.

### Corrigé

- **Fichiers `.js` fantômes dans `tests/`** — `import './fixtures.js'` résolvait un `fixtures.js` compilé et périmé au lieu du `.ts`. Toute la suite de tests tournait donc partiellement contre des fixtures obsolètes. Les artefacts ont été retirés et `.gitignore` empêche leur réapparition. Le projet avait déjà rencontré ce bug en V0.3 côté `src/`.
- `MatchPitch` gère la nouvelle phase `GOAL_LINE` (libellé et glyphe).

### Interface

- **Feuille de statistiques post-match** ([MatchSummary](../src/ui/components/MatchSummary.tsx)) — tableau par équipe : minutes, ballons portés, mètres, défenseurs battus, franchissements, plaquages réussis et manqués, ballons grattés, essais. Défilement horizontal interne, colonne joueur figée. Un encart rappelle les ballons portés à cinq mètres (et combien la défense a repoussés), les pénalités sifflées, les remplacements et l'éventuel passage en mêlées simulées.
- **Panneau Coupe d'Europe** sur le tableau de bord — parcours match par match (gagné / perdu / à venir), bilan de poule, adversaire du jour avec pays et niveau, et l'avertissement de semaine double qui matérialise l'arbitrage de rotation. Bouton pour jouer le match, qui n'avance pas la journée de championnat.
- **Adversaires européens jouables** ([european-opponent.ts](../src/data/european-opponent.ts)) — feuille de match de 23 joueurs générée à la volée, cohérente avec la force du club. Vit dans `data/` pour que le moteur reste pur.
- **Classement enrichi** — badges de qualification européenne (EU / CH) et distinction entre barrage d'accession (13e) et relégation directe (14e). Les seuils sont importés du moteur pour que l'affichage ne puisse pas diverger des règles.
- **Bannière de relégation** sur le tableau de bord quand le club est en position de barrage ou de descente.

### Corrigé (suite)

- **`tsc` émettait du JavaScript à côté des sources** — c'était la cause racine des fichiers fantômes : `npm run build` déposait un `.js` compilé à côté de chaque `.ts`/`.tsx`, et Vite résolvait ensuite `import './Foo.js'` vers ce fichier périmé plutôt que vers la source. Le serveur de dev servait donc du code obsolète. Corrigé par `noEmit` dans [tsconfig.json](../tsconfig.json) ; `tsc` ne sert plus qu'à la vérification de types, Vite assurant la transpilation.
- **Match de coupe perdu en cas de journée simulée** — si le joueur avançait la journée sans disputer son match européen, le match disparaissait purement et simplement. Il est désormais résolu d'office (score dérivé de l'écart de niveau) et la charge de la semaine s'applique quand même à l'effectif.
- **Doublons de villes dans une poule européenne** — deux adversaires pouvaient venir de la même ville, ce qui trahissait la génération procédurale.
- Trois erreurs de types préexistantes dans `career-e2e.test.ts` **bloquaient `npm run build`**.

### Tests

314 tests (contre 189), dont 7 nouveaux fichiers : `bench`, `goal-line`, `discipline`, `carry`, `european-cup`, `relegation`, `competitions-flow`.

## [V0.5] — Polish + UI

### Ajouté
- **Fils humains du Dashboard** ([engine/human/threads.ts](../src/engine/human/threads.ts)) — détection automatique de 5 types de fils cliquables :
  - `PENDING_EVENT` — événements humains en attente de décision
  - `CONFLICT` — relations ≤ -50 entre coéquipiers
  - `LOW_MOOD` — joueur avec mood < 35
  - `MENTOR` — binôme actif (relation ≥ 50 + différence d'âge ≥ 6 ans)
  - `HOT_FORM` — joueur avec mood ≥ 80
- **Narratif de match enrichi** ([engine/match/narrative.ts](../src/engine/match/narrative.ts)) — 4 paragraphes structurés (Match / 1re mi-temps / 2e mi-temps / Performances) avec :
  - Adaptation du ton selon l'écart (démolition / serré / nul)
  - Citations des essais avec minute + nom du joueur
  - Détection de la dominance en mêlée
  - Citations des traits saillants (killer_instinct, créatif…)
- 4 nouveaux tests sur la détection des fils humains

### Changé
- `MatchSummary` affiche désormais le narratif riche avec headline + paragraphes typés

## [V0.4] — Système humain v0

### Ajouté
- **30 traits structurés** ([engine/human/traits.ts](../src/engine/human/traits.ts)) en 5 catégories (Leadership, Mental, Ambition, Relationnel, Style) avec exclusivités, distinction durs/doux, et modifiers numériques
- **Génération de traits par joueur** ([engine/human/trait-generator.ts](../src/engine/human/trait-generator.ts)) — pondération selon stats, déterministe, 5-6 traits cohérents
- **Calcul mood** ([engine/human/mood.ts](../src/engine/human/mood.ts)) avec 7 sources (forme, résultats, statut, relations, contrat, fatigue, reconnaissance)
- **Graphe de relations** ([engine/human/relationships.ts](../src/engine/human/relationships.ts)) — score -100..+100, 5 types, génération initiale (rivalité, mentor potentiel, JIFF, traits compatibles), évolution post-match
- **5 events humains** ([engine/human/events.ts](../src/engine/human/events.ts)) : CONFLIT_VESTIAIRE, DEMANDE_INDIVIDUELLE, MENTOR_PROPOSE, STAR_FATIGUEE, PRESSE_NEGATIVE
- **Détecteur d'events** ([engine/human/event-detector.ts](../src/engine/human/event-detector.ts)) avec anti-spam (1 type tous les 4 rounds)
- **8 staff voix par club** ([engine/club/staff.ts](../src/engine/club/staff.ts)) avec biais (médecin / adjoints / président / etc.)
- **Voix dans les live moments du match** — chaque option pousser par un staff identifié (Adjoint avants pour "verrouiller", Médecin pour "faire sortir", etc.)
- **UI Fiche joueur enrichie** : panneau "Relations clés" avec top 5-6 relations cliquables
- **UI Modal d'event humain** sur le Dashboard
- 13 tests human + 9 tests relationships

### Changé
- `MoodInputs` accepte un `relationsFactors` optionnel (V0.4 phase 2)
- `LiveMomentOption` accepte un `voiceStaffRole` optionnel (V0.4 phase 3)

## [V0.3] — Saison Top 14 + boucle hebdomadaire

### Ajouté
- **14 clubs Top 14** dans [data/clubs.csv](../data/clubs.csv) (Toulouse, UBB, La Rochelle, Toulon, Racing, Stade Français, Clermont, Lyon, Montpellier, Castres, Pau, Bayonne, USAP, Vannes)
- **~250 joueurs nominatifs** dans [data/players.csv](../data/players.csv) avec stars réelles (Dupont, Penaud, Alldritt, Ollivon, Etzebeth, Jalibert, etc.)
- **Calendrier round-robin double** ([engine/season/calendar.ts](../src/engine/season/calendar.ts)) — 26 journées × 7 matchs, shuffle déterministe par seed, alternance home/away (post-process anti-streak)
- **Classement Top 14** ([engine/season/standings.ts](../src/engine/season/standings.ts)) — règles réelles : V=4, N=2, D=0, BO ≥4 essais, BD défaite ≤7 pts
- **SeasonSession** ([engine/game/season-session.ts](../src/engine/game/season-session.ts)) — orchestrateur de saison avec auto-sim des autres matchs
- **Phases finales Top 14** : barrages (3v6, 4v5) → demi-finales → finale (Stade de France) — vainqueur du Brennus désigné
- **Composition manuelle** : sélecteurs auto-swap banc ↔ titularisation
- **Capitaine et buteur** explicites (sélecteurs dédiés, override moteur)
- **Préparation de semaine** : charge entraînement (Légère/Modérée/Forte) + focus tactique (Avants/Mixte/Arrières) → modifie tacticalBonus + fatigue de départ
- **Save de partie en cours** ([data/season-save-repository.ts](../src/data/season-save-repository.ts))
- **Écran Dashboard** ([ui/screens/DashboardScreen.tsx](../src/ui/screens/DashboardScreen.tsx)) avec hero match + calendrier + classement
- **Écran Vestiaire + Fiche joueur** ([ui/screens/SquadScreen.tsx](../src/ui/screens/SquadScreen.tsx))
- **Écran Pre-match** ([ui/screens/PreMatchScreen.tsx](../src/ui/screens/PreMatchScreen.tsx)) avec préparation + composition
- 14 tests calendar + 2 tests régression season-flow

### Corrigé
- **Bug `simulateOtherMatchesOfRound` après `commitPlayerMatch`** : l'ordre était inversé, ce qui faisait simuler les matchs du round suivant (et bloquait le passage en finale après une demi gagnée)
- **Calendrier identique pour tous les seeds** : shuffle initial déterministe ajouté
- **Streaks home/away ≥ 13** : algorithme rebalanceAlternation post-process
- **Fichiers `.js` shadow** dans `src/` masquaient les modifs `.ts`

## [V0.2] — Vertical slice match jouable

### Ajouté
- **Session interactive de match** ([engine/match/session.ts](../src/engine/match/session.ts)) avec live moments
- **5 live moments hardcodés** (Mi-temps, Pénalité, Cadre fatigué, Pression défensive, Crunch time)
- **Attribution joueur** : finisheur d'essai sélectionné (pondéré par finition + vitesse), kicker pour les place kicks
- **Stats individuelles** agrégées (essais, pénalités tentées/réussies)
- **Vue terrain SVG 2D top-down** ([ui/components/PitchView.tsx](../src/ui/components/PitchView.tsx)) avec balle animée
- **Save de match** ([data/match-save-repository.ts](../src/data/match-save-repository.ts)) — seed + decisions, replay déterministe
- **UI complète** (App, MatchScreen, SetupScreen, MatchSummary, LiveMomentModal, PhaseTimeline, Scoreboard)
- **Outils CLI** : `npm run play`, `npm run play:stats`

### Changé
- `simulateMatch` devient un thin wrapper sur `createMatchSession` (auto-résout les décisions avec leur option par défaut)
- `MatchInput.playersById` ajouté pour le moteur pur (pas d'accès DB)

## [V0.1] — Proto moteur match

### Ajouté
- **5 sous-systèmes** : `scrum.ts`, `lineout.ts`, `ruck.ts`, `openplay.ts`, `kicking.ts`
- **Boucle simulate** complète qui produit ~75 phases par match
- **Mêlée V0.2** : modèle de duel technique (poussée + technique + gainage) + dominance cumulative à travers le match
- **Outil de calibrage** ([tools/calibrate.ts](../tools/calibrate.ts)) — 1000 matchs vs cibles V1
- **Discipline architecturale** ([eslint.config.js](../eslint.config.js)) : engine/ pur, no Math.random / new Date
- **RNG déterministe** ([engine/rng.ts](../src/engine/rng.ts)) avec FNV-1a hash pour seeds non-numériques
- 7 tests scrum + 11 tests scrum-dominance + 11 tests simulation
