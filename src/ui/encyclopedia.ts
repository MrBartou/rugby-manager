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
    definition:
      'Joueur Issu des Filières de Formation : un joueur formé au moins trois ans dans un club français avant ses vingt et un ans.',
    whatItMeans:
      'Votre feuille de match doit en compter un nombre minimum. Un effectif bâti sur des recrues étrangères vous expose à une sanction en fin de saison, quel que soit votre classement.',
    keywords: ['jiff', 'formation', 'quota', 'français'],
  },
  {
    id: 'salary-cap',
    term: 'Salary cap',
    topic: 'ARGENT',
    definition:
      'Le plafond que la masse salariale de votre effectif ne doit pas dépasser sur une saison.',
    whatItMeans:
      'Dépasser reste possible : c\'est en fin de saison que la commission regarde. Selon l\'ampleur, vous écopez d\'un avertissement, d\'une amende, d\'un retrait de points ou d\'une interdiction de recruter.',
    gameNote:
      'Le plafond diffère selon l\'étage : douze millions en Top 14, cinq en Pro D2. Une tolérance de 3 % évite de sanctionner un dépassement d\'un euro.',
    keywords: ['cap', 'plafond', 'masse salariale', 'salaire'],
  },
  {
    id: 'dncg',
    term: 'La commission',
    topic: 'REGLEMENT',
    definition:
      'L\'instance qui contrôle les comptes et les effectifs de tous les clubs à la fin de chaque saison.',
    whatItMeans:
      'Elle regarde l\'effectif **d\'avant-mercato**, donc la saison que vous venez de jouer : dégraisser en juillet ne rattrape rien. La récidive aggrave la sanction l\'année suivante.',
    keywords: ['dncg', 'commission', 'sanction', 'contrôle'],
  },
  {
    id: 'bonus',
    term: 'Points de bonus',
    topic: 'COMPETITION',
    definition:
      'Points de classement gagnés au-delà de la victoire : un bonus offensif pour trois essais d\'écart, un bonus défensif pour une défaite de sept points ou moins.',
    whatItMeans:
      'Quatre points pour une victoire, deux pour un nul. Le bonus décide des saisons : jouer pour le cinquième essai quand la victoire est acquise, ou verrouiller une défaite courte, sont deux vraies décisions de fin de match.',
    keywords: ['bonus', 'offensif', 'défensif', 'points', 'classement'],
  },
  {
    id: 'phases-finales',
    term: 'Phases finales',
    topic: 'COMPETITION',
    definition:
      'Après la saison régulière, les six premiers jouent le titre : les deux premiers attendent en demi-finale, les quatre suivants disputent un barrage.',
    whatItMeans:
      'Finir deuxième plutôt que troisième vaut un match de moins et une semaine de repos. C\'est la différence la plus rentable du classement.',
    gameNote:
      'À égalité au coup de sifflet final, le mieux classé de la saison régulière passe : il n\'y a pas de prolongation.',
    keywords: ['barrage', 'demi-finale', 'finale', 'phases finales', 'top 6'],
  },
  {
    id: 'joker-medical',
    term: 'Joker médical',
    topic: 'EFFECTIF',
    definition:
      'Le droit de signer un remplaçant hors période de mercato quand un joueur est absent longtemps.',
    whatItMeans:
      'Il ne s\'ouvre que sur une blessure de longue durée, une seule fois par blessé, et le joker ne peut pas être meilleur que celui qu\'il remplace : c\'est un pansement, pas une fenêtre de recrutement déguisée.',
    keywords: ['joker', 'médical', 'blessure', 'remplacer'],
  },
  {
    id: 'mercato',
    term: 'Fenêtres de mercato',
    topic: 'EFFECTIF',
    definition:
      'Les deux périodes où un joueur sous contrat peut changer de club : la fin du marché d\'été, et la trêve hivernale.',
    whatItMeans:
      'Hors de ces fenêtres, seuls les joueurs sans club se signent. Repérer une cible en mars ne sert à rien avant l\'été : d\'où la liste de suivi.',
    gameNote:
      'La fenêtre d\'hiver s\'ouvre à mi-parcours du championnat que vous jouez : elle ne tombe donc pas à la même journée en Top 14 et en Pro D2.',
    keywords: ['mercato', 'fenêtre', 'transfert', 'marché'],
  },
  {
    id: 'jiff-feuille',
    term: 'Feuille de match',
    topic: 'EFFECTIF',
    definition:
      'Les vingt-trois joueurs retenus pour une rencontre : quinze titulaires et huit remplaçants.',
    whatItMeans:
      'Le banc n\'est pas une réserve : les huit remplacements se jouent, et la première ligne doit pouvoir être remplacée sous peine de mêlées simulées, qui vous privent d\'une arme.',
    keywords: ['feuille', 'banc', 'remplaçant', 'vingt-trois'],
  },
  {
    id: 'barrage-accession',
    term: 'Barrage d\'accession',
    topic: 'COMPETITION',
    definition:
      'Le match entre le treizième de Top 14 et le deuxième de Pro D2 pour la dernière place dans l\'élite.',
    whatItMeans:
      'Finir treizième ne sauve pas : il reste un match à gagner, à domicile, contre un club lancé. Le quatorzième descend directement.',
    keywords: ['barrage', 'accession', 'relégation', 'descente', 'montée'],
  },
  {
    id: 'note',
    term: 'Note de match',
    topic: 'EFFECTIF',
    definition:
      'La note sur dix attribuée à chaque joueur après une rencontre.',
    whatItMeans:
      'Elle situe la performance dans la distribution de son poste : six est la médiane d\'un joueur à ce poste, sept et demi le niveau des dix pour cent les meilleurs. Un pilier à 7 a donc fait un très bon match, même sans avoir marqué.',
    gameNote:
      'On ne compare pas un pilier à un ailier : chacun est jugé sur ce que son poste produit réellement.',
    keywords: ['note', 'homme du match', 'performance'],
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
