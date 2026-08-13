/**
 * L'encyclopédie : V0.62.
 *
 * Le troisième pilier du projet, « accessible comme un bon livre », visait le
 * fan de rugby qui n'a jamais touché à un jeu de management. Or le jeu lui
 * lance à la figure « JIFF », « salary cap », « bonus offensif », « joker
 * médical » et « fenêtre de mercato » sans jamais définir aucun de ces mots.
 * Ce sont pourtant les règles qui décident de sa saison.
 *
 * ## Ce qu'une entrée doit faire
 *
 * Dire ce que le mot veut dire **et** ce qu'il implique pour le manager. Une
 * définition de dictionnaire ne sert à rien ici : savoir qu'un JIFF est un
 * joueur issu des filières de formation ne dit pas qu'il faut en aligner
 * quatorze sur une feuille de match, ni ce qui arrive quand on n'y arrive pas.
 *
 * Les entrées disent aussi ce que **ce jeu-ci** en fait quand il s'écarte du
 * règlement réel : mieux vaut l'annoncer que laisser un connaisseur découvrir
 * l'écart et croire à un bug.
 */

export type GlossaryTopic =
  | 'REGLEMENT'
  | 'COMPETITION'
  | 'EFFECTIF'
  | 'ARGENT';

export interface GlossaryEntry {
  readonly id: string;
  readonly term: string;
  readonly topic: GlossaryTopic;
  /** Ce que le mot désigne, en une phrase. */
  readonly definition: string;
  /** Ce que ça change pour le manager, concrètement. */
  readonly whatItMeans: string;
  /** Écart assumé avec le règlement réel, quand il y en a un. */
  readonly gameNote?: string;
  /**
   * Ce qu'il faut retenir si l'on ne lit qu'une ligne.
   *
   * Un lecteur qui ouvre un glossaire cherche rarement à s'instruire : il
   * cherche à débloquer une décision. La phrase courte passe donc avant le
   * paragraphe, pas après.
   */
  readonly inShort: string;
  /** Entrées voisines, celles qu'on lira juste après. */
  readonly seeAlso?: readonly string[];
  /** Mots-clés qui déclenchent cette entrée dans une recherche. */
  readonly keywords: readonly string[];
}

export const GLOSSARY_TOPIC_LABEL: Readonly<Record<GlossaryTopic, string>> = {
  REGLEMENT: 'Règlement',
  COMPETITION: 'Compétition',
  EFFECTIF: 'Effectif',
  ARGENT: 'Argent',
};

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'jiff',
    term: 'JIFF',
    topic: 'REGLEMENT',
    inShort: 'Un joueur formé en France. Il vous en faut un minimum sur chaque feuille de match.',
    definition:
      'Joueur Issu des Filières de Formation : un joueur formé au moins trois ans dans un club français avant ses vingt et un ans.',
    whatItMeans:
      'Votre feuille de match doit en compter un nombre minimum. Un effectif bâti sur des recrues étrangères vous expose à une sanction en fin de saison, quel que soit votre classement.',
    seeAlso: ['dncg', 'jiff-feuille'],
    keywords: ['jiff', 'formation', 'quota', 'français'],
  },
  {
    id: 'salary-cap',
    term: 'Salary cap',
    topic: 'ARGENT',
    inShort: 'Le plafond de votre masse salariale. Le dépasser se paie en fin de saison.',
    definition:
      'Le plafond que la masse salariale de votre effectif ne doit pas dépasser sur une saison.',
    whatItMeans:
      'Dépasser reste possible : c\'est en fin de saison que la commission regarde. Selon l\'ampleur, vous écopez d\'un avertissement, d\'une amende, d\'un retrait de points ou d\'une interdiction de recruter.',
    gameNote:
      'Douze millions en Top 14, cinq en Pro D2. Une tolérance de 3 % évite de sanctionner un dépassement d\'un euro.',
    seeAlso: ['dncg', 'mercato'],
    keywords: ['cap', 'plafond', 'masse salariale', 'salaire'],
  },
  {
    id: 'dncg',
    term: 'La commission',
    topic: 'REGLEMENT',
    inShort: 'Elle contrôle vos comptes chaque été, et sanctionne sur la saison que vous venez de jouer.',
    definition:
      'L\'instance qui contrôle les comptes et les effectifs de tous les clubs à la fin de chaque saison.',
    whatItMeans:
      'Elle regarde l\'effectif d\'avant-mercato, donc la saison que vous venez de jouer : dégraisser en juillet ne rattrape rien. La récidive aggrave la sanction l\'année suivante.',
    seeAlso: ['salary-cap', 'jiff'],
    keywords: ['dncg', 'commission', 'sanction', 'contrôle', 'amende'],
  },
  {
    id: 'bonus',
    term: 'Points de bonus',
    topic: 'COMPETITION',
    inShort: 'Un point de plus pour trois essais d\'écart, ou pour une défaite de sept points ou moins.',
    definition:
      'Points de classement gagnés au-delà de la victoire : un bonus offensif pour trois essais d\'écart, un bonus défensif pour une défaite de sept points ou moins.',
    whatItMeans:
      'Quatre points pour une victoire, deux pour un nul. Le bonus décide des saisons : aller chercher le cinquième essai quand la victoire est acquise, ou verrouiller une défaite courte, sont deux vraies décisions de fin de match.',
    seeAlso: ['phases-finales', 'essai'],
    keywords: ['bonus', 'offensif', 'défensif', 'points', 'classement'],
  },
  {
    id: 'essai',
    term: 'Essai, transformation, pénalité',
    topic: 'COMPETITION',
    inShort: 'Cinq points l\'essai, deux la transformation, trois la pénalité ou le drop.',
    definition:
      'Les quatre façons de marquer : l\'essai vaut cinq points, la transformation qui le suit deux, la pénalité et le drop trois chacun.',
    whatItMeans:
      'C\'est l\'arithmétique de toutes vos fins de match. Sept points d\'écart, c\'est un essai transformé : d\'où le seuil du bonus défensif, et d\'où le choix entre taper les trois points ou aller en touche pour en chercher sept.',
    seeAlso: ['bonus'],
    keywords: ['essai', 'transformation', 'pénalité', 'drop', 'points', 'marquer'],
  },
  {
    id: 'phases-finales',
    term: 'Phases finales',
    topic: 'COMPETITION',
    inShort: 'Les six premiers jouent le titre. Les deux premiers commencent en demi-finale.',
    definition:
      'Après la saison régulière, les six premiers jouent le titre : les deux premiers attendent en demi-finale, les quatre suivants disputent un barrage.',
    whatItMeans:
      'Finir deuxième plutôt que troisième vaut un match de moins et une semaine de repos. C\'est la différence la plus rentable du classement.',
    gameNote:
      'À égalité au coup de sifflet final, le mieux classé de la saison régulière passe : il n\'y a pas de prolongation.',
    seeAlso: ['bonus', 'barrage-accession'],
    keywords: ['barrage', 'demi-finale', 'finale', 'phases finales', 'top 6', 'brennus'],
  },
  {
    id: 'barrage-accession',
    term: 'Barrage d\'accession',
    topic: 'COMPETITION',
    inShort: 'Le treizième de Top 14 défend sa place contre le deuxième de Pro D2.',
    definition:
      'Le match entre le treizième de Top 14 et le deuxième de Pro D2 pour la dernière place dans l\'élite.',
    whatItMeans:
      'Finir treizième ne sauve pas : il reste un match à gagner, à domicile, contre un club lancé. Le quatorzième descend directement.',
    seeAlso: ['phases-finales'],
    keywords: ['barrage', 'accession', 'relégation', 'descente', 'montée', 'pro d2'],
  },
  {
    id: 'joker-medical',
    term: 'Joker médical',
    topic: 'EFFECTIF',
    inShort: 'Un remplaçant signé hors mercato, quand un joueur est absent longtemps.',
    definition:
      'Le droit de signer un remplaçant hors période de mercato quand un joueur est absent longtemps.',
    whatItMeans:
      'Il ne s\'ouvre que sur une blessure de longue durée, une seule fois par blessé, et le joker ne peut pas être meilleur que celui qu\'il remplace : c\'est un pansement, pas une fenêtre de recrutement déguisée.',
    seeAlso: ['mercato', 'blessure'],
    keywords: ['joker', 'médical', 'blessure', 'remplacer'],
  },
  {
    id: 'mercato',
    term: 'Fenêtres de mercato',
    topic: 'EFFECTIF',
    inShort: 'Deux périodes par saison pour recruter sous contrat. Les joueurs libres, eux, se signent toute l\'année.',
    definition:
      'Les deux périodes où un joueur sous contrat peut changer de club : la fin du marché d\'été, et la trêve hivernale.',
    whatItMeans:
      'Hors de ces fenêtres, seuls les joueurs sans club se signent. Repérer une cible en mars ne sert à rien avant l\'été : d\'où la liste de suivi, qui garde un joueur à l\'œil sans consommer d\'observation.',
    gameNote:
      'La fenêtre d\'hiver s\'ouvre à mi-parcours du championnat que vous jouez : elle ne tombe donc pas à la même journée en Top 14 et en Pro D2.',
    seeAlso: ['salary-cap', 'scouting', 'joker-medical'],
    keywords: ['mercato', 'fenêtre', 'transfert', 'marché', 'suivi'],
  },
  {
    id: 'jiff-feuille',
    term: 'Feuille de match',
    topic: 'EFFECTIF',
    inShort: 'Vingt-trois joueurs : quinze titulaires, huit remplaçants qui entreront vraiment.',
    definition:
      'Les vingt-trois joueurs retenus pour une rencontre : quinze titulaires et huit remplaçants.',
    whatItMeans:
      'Le banc n\'est pas une réserve : les huit remplacements se jouent, et la première ligne doit pouvoir être remplacée sous peine de mêlées simulées, qui vous privent d\'une arme.',
    seeAlso: ['jiff', 'postes', 'melee'],
    keywords: ['feuille', 'banc', 'remplaçant', 'vingt-trois', 'compo'],
  },
  {
    id: 'postes',
    term: 'Les numéros',
    topic: 'EFFECTIF',
    inShort: 'Du 1 au 8, les avants. Du 9 au 15, les trois-quarts. Le numéro dit le poste.',
    definition:
      'Au rugby, le numéro du maillot désigne le poste : 1 à 3 la première ligne, 4 et 5 la deuxième, 6 à 8 la troisième, 9 et 10 la charnière, 11 à 15 les trois-quarts et l\'arrière.',
    whatItMeans:
      'Aligner un joueur hors de son poste coûte cher sur le terrain. Le liseré de couleur sur la composition vous dit d\'un coup d\'œil si chacun est à sa place, à un poste voisin, ou hors de son registre.',
    seeAlso: ['jiff-feuille', 'note'],
    keywords: ['poste', 'numéro', 'pilier', 'ouvreur', 'ailier', 'compo'],
  },
  {
    id: 'melee',
    term: 'Mêlée et touche',
    topic: 'COMPETITION',
    inShort: 'Les deux remises en jeu où un pack dominant fait la différence.',
    definition:
      'La mêlée redémarre le jeu après une faute mineure ; la touche le redémarre après une sortie en dehors du terrain.',
    whatItMeans:
      'Ce sont vos deux sources de munitions. Un pack qui gagne ses mêlées récupère des pénalités et fatigue l\'adversaire ; une touche sûre vous permet de jouer le maul près de la ligne plutôt que de taper les trois points.',
    seeAlso: ['essai', 'jiff-feuille'],
    keywords: ['mêlée', 'touche', 'maul', 'pack', 'lancer'],
  },
  {
    id: 'forme',
    term: 'Forme et fatigue',
    topic: 'EFFECTIF',
    inShort: 'Deux états différents : la forme est un niveau du moment, la fatigue s\'accumule.',
    definition:
      'La forme dit dans quel état un joueur aborde la rencontre ; la fatigue mesure l\'usure accumulée par les minutes jouées.',
    whatItMeans:
      'Un joueur fatigué décline en fin de match et se blesse plus facilement. C\'est ce qui rend le banc et la rotation nécessaires sur une saison de vingt-six journées, et ce que votre adjoint surveille si vous lui confiez les remplacements.',
    seeAlso: ['jiff-feuille', 'blessure'],
    keywords: ['forme', 'fatigue', 'rotation', 'repos', 'usure'],
  },
  {
    id: 'moral',
    term: 'Moral',
    topic: 'EFFECTIF',
    inShort: 'Ce qu\'un joueur pense de sa situation. Il se gagne surtout en temps de jeu.',
    definition:
      'L\'état d\'esprit d\'un joueur, nourri par son temps de jeu, les résultats, son rôle annoncé et ses relations dans le vestiaire.',
    whatItMeans:
      'Un joueur au moral bas produit moins et finit par demander à partir. Le temps de jeu pèse plus que tout le reste : promettre un rôle qu\'on ne tient pas coûte plus cher que de ne rien promettre.',
    seeAlso: ['forme', 'note'],
    keywords: ['moral', 'vestiaire', 'mécontentement', 'promesse'],
  },
  {
    id: 'blessure',
    term: 'Blessure',
    topic: 'EFFECTIF',
    inShort: 'Une absence chiffrée en journées. Au-delà d\'un certain seuil, elle ouvre le joker médical.',
    definition:
      'Une indisponibilité provoquée par un match ou un entraînement, avec une date de retour estimée.',
    whatItMeans:
      'Vous payez son salaire pendant qu\'il ne joue pas, et il compte dans votre masse salariale. Une absence longue ouvre le droit au joker médical, seule façon de recruter hors mercato.',
    seeAlso: ['joker-medical', 'forme', 'salary-cap'],
    keywords: ['blessure', 'infirmerie', 'absence', 'indisponible'],
  },
  {
    id: 'scouting',
    term: 'Scouting',
    topic: 'EFFECTIF',
    inShort: 'Observer un joueur pour connaître sa vraie valeur. Sans cela, vous ne voyez qu\'une fourchette.',
    definition:
      'L\'observation d\'un joueur par vos recruteurs, qui affine peu à peu ce que vous savez de lui.',
    whatItMeans:
      'Un joueur peu observé s\'affiche en fourchette : « 68–81 » plutôt qu\'un chiffre. C\'est volontaire, et c\'est pourquoi le comparateur refuse de départager deux fourchettes qui se chevauchent : le jeu ne vous ment pas sur ce qu\'il ne sait pas.',
    seeAlso: ['mercato', 'potentiel'],
    keywords: ['scouting', 'recruteur', 'observer', 'fourchette', 'suivi'],
  },
  {
    id: 'potentiel',
    term: 'Potentiel',
    topic: 'EFFECTIF',
    inShort: 'Le plafond qu\'un joueur peut atteindre. Il ne l\'atteindra qu\'en jouant.',
    definition:
      'Le niveau maximal qu\'un joueur peut espérer atteindre au cours de sa carrière.',
    whatItMeans:
      'La progression se paie en minutes : un espoir qui ne joue pas ne progresse pas, quel que soit son potentiel. C\'est tout l\'intérêt du prêt, qui lui donne du temps de jeu ailleurs.',
    seeAlso: ['scouting', 'pret', 'moral'],
    keywords: ['potentiel', 'espoir', 'jeune', 'progression', 'formation'],
  },
  {
    id: 'pret',
    term: 'Prêt',
    topic: 'EFFECTIF',
    inShort: 'Envoyer un jeune jouer ailleurs une saison. Il progresse, vous vous en privez.',
    definition:
      'L\'envoi d\'un joueur dans un autre club pour une saison, à charge pour ce club de le faire jouer.',
    whatItMeans:
      'C\'est un arbitrage, pas un rangement : vous gagnez un joueur formé dans un an et vous en perdez un tout de suite. Le club d\'accueil prend en charge une part du salaire, négociée à la signature.',
    seeAlso: ['potentiel', 'mercato'],
    keywords: ['prêt', 'loan', 'jeune', 'temps de jeu'],
  },
  {
    id: 'note',
    term: 'Note de match',
    topic: 'EFFECTIF',
    inShort: 'Six est la moyenne du poste, sept et demi le niveau des dix pour cent les meilleurs.',
    definition:
      'La note sur dix attribuée à chaque joueur après une rencontre.',
    whatItMeans:
      'Elle situe la performance dans la distribution de son poste. Un pilier à 7 a donc fait un très bon match, même sans avoir marqué : on ne juge pas un avant sur les essais.',
    gameNote:
      'On ne compare pas un pilier à un ailier : chacun est jugé sur ce que son poste produit réellement dans ce moteur, qui a été mesuré pour l\'occasion.',
    seeAlso: ['postes', 'moral'],
    keywords: ['note', 'homme du match', 'performance', 'moyenne'],
  },
  {
    id: 'objectif',
    term: 'Objectif du board',
    topic: 'ARGENT',
    inShort: 'Ce que le président attend de vous cette saison. Le manquer deux fois coûte la place.',
    definition:
      'Le classement, et parfois les exigences annexes, que la direction vous fixe en début de saison.',
    whatItMeans:
      'Il est jugé une fois l\'an. L\'atteindre nourrit la confiance du président, le manquer l\'entame : deux échecs consécutifs vous mettent dehors, et vous repartez alors sans club.',
    seeAlso: ['dncg', 'salary-cap'],
    keywords: ['objectif', 'board', 'président', 'confiance', 'limogeage'],
  },
];

/**
 * Les entrées qui répondent à une recherche.
 *
 * On cherche dans le terme et dans les mots-clés, pas dans les définitions :
 * un mot fréquent comme « joueur » remonterait sinon toute l'encyclopédie, ce
 * qui revient à ne rien chercher du tout.
 */
export function searchGlossary(query: string): readonly GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return GLOSSARY;
  return GLOSSARY.filter(entry =>
    entry.term.toLowerCase().includes(q)
    || entry.keywords.some(k => k.includes(q)));
}

/** Les entrées d'un thème, dans l'ordre du glossaire. */
export function entriesByTopic(
  entries: readonly GlossaryEntry[] = GLOSSARY,
): readonly { readonly topic: GlossaryTopic; readonly entries: readonly GlossaryEntry[] }[] {
  const ordre: readonly GlossaryTopic[] = ['REGLEMENT', 'COMPETITION', 'EFFECTIF', 'ARGENT'];
  return ordre
    .map(topic => ({ topic, entries: entries.filter(e => e.topic === topic) }))
    .filter(groupe => groupe.entries.length > 0);
}

/** Une entrée par son identifiant, pour suivre un renvoi. */
export function entryById(id: string): GlossaryEntry | undefined {
  return GLOSSARY.find(e => e.id === id);
}

/**
 * L'entrée à ouvrir depuis un écran donné.
 *
 * L'encyclopédie s'ouvre là où la question se pose : sur l'écran des
 * transferts, on cherche le mercato ; sur celui du règlement, le plafond
 * salarial. Un glossaire qu'il faut parcourir depuis le début à chaque fois
 * n'est pas contextuel, c'est une annexe.
 */
export const SCREEN_ENTRY_POINT: Readonly<Record<string, string>> = {
  transfers: 'mercato',
  finances: 'salary-cap',
  standings: 'bonus',
  squad: 'jiff',
  training: 'jiff-feuille',
  dashboard: 'bonus',
};
