/**
 * L'arbitre — V0.52.
 *
 * Trois commentaires du moteur l'invoquent depuis la V0.13 — « l'arbitre est
 * plus enclin à siffler en sa faveur », « l'arbitre tend à siffler contre eux »,
 * « on s'expose à la sanction de l'arbitre » — et il n'en existait aucun. Les
 * pénalités tombaient à taux fixe, identiques d'un match à l'autre, quel que
 * soit l'homme au sifflet.
 *
 * Or dans le rugby, l'arbitre est un paramètre que tout le monde prépare. Un
 * arbitre pointilleux au sol interdit le contest ; un arbitre qui laisse jouer
 * la mêlée annule l'avantage d'un pack dominant. On ne joue pas contre les
 * quinze d'en face seulement.
 *
 * ## Par domaine, et pas en sévérité globale
 *
 * Un curseur unique n'aurait ajouté que du bruit : plus ou moins de pénalités,
 * rien à décider. Trois domaines séparés en font une contrainte qu'on peut
 * lire et contre laquelle on peut se préparer — c'est ce que la météo a apporté
 * au plan de match, appliqué à la discipline.
 *
 * ## Nommés, et récurrents
 *
 * Douze arbitres écrits à la main, comme les rivalités et les stades exposés au
 * vent. On les recroise quatre ou cinq fois par saison, et on finit par savoir
 * lequel ne pardonne rien au ruck. Un profil anonyme tiré à chaque rencontre
 * n'aurait rien laissé apprendre.
 */

import type { Rng } from '../rng.js';

// =============================================================================
// Le modèle
// =============================================================================

export interface Referee {
  readonly id: string;
  readonly name: string;
  /**
   * Sévérité par domaine, en multiplicateur de la probabilité de pénalité.
   *
   * 1 = la moyenne du championnat. En dessous il laisse jouer, au-dessus il
   * siffle. Les trois sont indépendants : on peut être intraitable au sol et
   * très permissif en mêlée, ce qui est le cas le plus courant.
   */
  readonly ruck: number;
  readonly scrum: number;
  readonly offside: number;
  /**
   * Propension à sortir un carton plutôt qu'à se contenter d'un rappel à
   * l'ordre, en multiplicateur.
   */
  readonly cards: number;
  /**
   * Biais domicile : part des pénalités qu'il retire aux locaux.
   *
   * 1 = parfaitement neutre. 1,08 = il siffle 8 % de moins contre l'équipe qui
   * reçoit. Le sujet est discuté dans le vrai rugby ; on le modélise petit et
   * on ne le donne qu'à une minorité d'arbitres.
   */
  readonly homeBias: number;
  /** Ce que le dossier d'avant-match en dit, en une phrase. */
  readonly reputation: string;
}

/**
 * Le corps arbitral.
 *
 * Noms fictifs. Les profils sont contrastés à dessein : il faut qu'on sente la
 * différence entre deux désignations, sinon autant n'avoir qu'un arbitre.
 */
export const REFEREES: readonly Referee[] = [
  {
    id: 'ref_bourdet', name: 'Ludovic Bourdet',
    ruck: 1.30, scrum: 0.85, offside: 1.05, cards: 1.15, homeBias: 1.00,
    reputation: 'Intraitable au sol. Le contest lui coûte cher, la mêlée le laisse froid.',
  },
  {
    id: 'ref_vasseur', name: 'Antoine Vasseur',
    ruck: 0.78, scrum: 1.28, offside: 0.95, cards: 0.85, homeBias: 1.00,
    reputation: 'Laisse vivre les rucks et scrute la mêlée. Les piliers le connaissent.',
  },
  {
    id: 'ref_marchetti', name: 'Paolo Marchetti',
    ruck: 1.12, scrum: 1.10, offside: 1.30, cards: 1.05, homeBias: 1.00,
    reputation: 'Obsédé par la ligne de hors-jeu. Une défense montante prend des risques.',
  },
  {
    id: 'ref_delahaye', name: 'Bertrand Delahaye',
    ruck: 0.82, scrum: 0.80, offside: 0.85, cards: 0.70, homeBias: 1.00,
    reputation: 'Laisse jouer. Les matchs qu\'il arbitre s\'emballent vite.',
  },
  {
    id: 'ref_ferrand', name: 'Guillaume Ferrand',
    ruck: 1.22, scrum: 1.18, offside: 1.20, cards: 1.35, homeBias: 1.00,
    reputation: 'Pointilleux partout, et la main leste. Le match sera haché.',
  },
  {
    id: 'ref_nkemba', name: 'Serge Nkemba',
    ruck: 1.00, scrum: 1.00, offside: 1.00, cards: 1.00, homeBias: 1.00,
    reputation: 'Sans manie particulière. On joue au rugby.',
  },
  {
    id: 'ref_taillefer', name: 'Mathieu Taillefer',
    ruck: 1.18, scrum: 0.92, offside: 1.02, cards: 0.90, homeBias: 1.09,
    reputation: 'Sévère au sol, et réputé sensible à l\'ambiance d\'un stade plein.',
  },
  {
    id: 'ref_ollivier', name: 'Yann Ollivier',
    ruck: 0.90, scrum: 1.32, offside: 1.08, cards: 1.10, homeBias: 1.00,
    reputation: 'La mêlée est son domaine. Un pack en difficulté va souffrir.',
  },
  {
    id: 'ref_saldanha', name: 'Rui Saldanha',
    ruck: 1.05, scrum: 0.88, offside: 1.25, cards: 0.95, homeBias: 1.06,
    reputation: 'Attentif au hors-jeu, et volontiers indulgent avec l\'équipe qui reçoit.',
  },
  {
    id: 'ref_castagnet', name: 'Hervé Castagnet',
    ruck: 1.28, scrum: 1.05, offside: 0.88, cards: 1.20, homeBias: 1.00,
    reputation: 'Ne pardonne rien au point de fixation. Mieux vaut ne pas contester.',
  },
  {
    id: 'ref_leblond', name: 'Nicolas Leblond',
    ruck: 0.95, scrum: 0.95, offside: 0.92, cards: 0.80, homeBias: 1.00,
    reputation: 'Discret, constant, rarement décisif. Le meilleur compliment pour un arbitre.',
  },
  {
    id: 'ref_arrieta', name: 'Xabi Arrieta',
    ruck: 1.08, scrum: 1.22, offside: 1.12, cards: 1.25, homeBias: 1.00,
    reputation: 'Exigeant sur la conquête et prompt à sanctionner la récidive.',
  },
];

/** Arbitre neutre, quand aucune désignation n'est connue (match libre, tests). */
export const NEUTRAL_REFEREE: Referee = {
  id: 'ref_neutre', name: 'Arbitre',
  ruck: 1, scrum: 1, offside: 1, cards: 1, homeBias: 1,
  reputation: '',
};

// =============================================================================
// La désignation
// =============================================================================

/**
 * Arbitre désigné pour une rencontre.
 *
 * Déterministe sur (graine, saison, journée, stade), comme la météo : recharger
 * une sauvegarde ne doit pas changer l'homme au sifflet du match qu'on prépare.
 */
export function refereeFor(rng: Rng): Referee {
  return rng.pick(REFEREES);
}

/** Retrouve un arbitre par son identifiant, pour relire une sauvegarde. */
export function refereeById(id: string): Referee {
  return REFEREES.find(r => r.id === id) ?? NEUTRAL_REFEREE;
}

// =============================================================================
// Ce qu'il change
// =============================================================================

export interface RefereeEffects {
  /** Multiplicateur des pénalités sifflées au ruck. */
  readonly ruckPenalty: number;
  /** Multiplicateur des pénalités sifflées en mêlée. */
  readonly scrumPenalty: number;
  /** Multiplicateur des pénalités de hors-jeu et de jeu courant. */
  readonly offsidePenalty: number;
  /** Multiplicateur de la probabilité qu'une pénalité devienne un carton. */
  readonly cardRate: number;
}

export const NEUTRAL_EFFECTS: RefereeEffects = {
  ruckPenalty: 1, scrumPenalty: 1, offsidePenalty: 1, cardRate: 1,
};

/**
 * Effets de l'arbitre pour un camp donné.
 *
 * Le biais domicile ne s'applique qu'aux locaux et ne joue que sur les
 * pénalités, jamais sur les cartons : on peut soupçonner un arbitre de laisser
 * courir une faute chez lui, pas d'y ranger son carton rouge.
 */
export function refereeEffects(
  referee: Referee | undefined,
  side: 'HOME' | 'AWAY',
): RefereeEffects {
  if (referee === undefined) return NEUTRAL_EFFECTS;
  const bias = side === 'HOME' ? 1 / referee.homeBias : 1;
  return {
    ruckPenalty: referee.ruck * bias,
    scrumPenalty: referee.scrum * bias,
    offsidePenalty: referee.offside * bias,
    cardRate: referee.cards,
  };
}

// =============================================================================
// La consigne du manager
// =============================================================================

/**
 * Ce qu'on demande au groupe au sol, pour la semaine.
 *
 * C'est l'arbitrage que l'arbitre impose : contester chaque ballon rapporte des
 * turnovers et coûte des pénalités. Face à un Castagnet, se retenir devient
 * défendable ; face à un Delahaye, s'en priver serait absurde.
 */
export type DisciplinePolicy = 'CONTEST_TOTAL' | 'EQUILIBRE' | 'PAS_DE_CONTEST';

export const POLICY_LABEL: Readonly<Record<DisciplinePolicy, string>> = {
  CONTEST_TOTAL: 'Contester chaque ballon',
  EQUILIBRE: 'Contester à bon escient',
  PAS_DE_CONTEST: 'Ne pas contester au sol',
};

export const POLICY_HINT: Readonly<Record<DisciplinePolicy, string>> = {
  CONTEST_TOTAL: 'Plus de ballons récupérés, nettement plus de pénalités concédées.',
  EQUILIBRE: 'Le réglage par défaut. On conteste quand c\'est jouable.',
  PAS_DE_CONTEST: 'On se relève et on remet la ligne. Peu de fautes, peu de ballons volés.',
};

export interface PolicyEffects {
  /** Multiplicateur des pénalités concédées au sol. */
  readonly penaltyConceded: number;
  /** Multiplicateur des turnovers obtenus au ruck. */
  readonly turnoverWon: number;
}

export function policyEffects(policy: DisciplinePolicy | undefined): PolicyEffects {
  switch (policy) {
    case 'CONTEST_TOTAL':
      return { penaltyConceded: 1.35, turnoverWon: 1.30 };
    case 'PAS_DE_CONTEST':
      return { penaltyConceded: 0.72, turnoverWon: 0.70 };
    default:
      return { penaltyConceded: 1, turnoverWon: 1 };
  }
}

/**
 * Ce que le staff conseille face à cet arbitre.
 *
 * Une recommandation, pas une obligation : le manager peut décider de contester
 * quand même face au plus sévère des arbitres, et d'en assumer le prix.
 */
export function recommendedPolicy(referee: Referee): DisciplinePolicy {
  if (referee.ruck >= 1.20) return 'PAS_DE_CONTEST';
  if (referee.ruck <= 0.85) return 'CONTEST_TOTAL';
  return 'EQUILIBRE';
}
