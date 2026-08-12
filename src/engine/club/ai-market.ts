/**
 * Mercato des clubs IA — V0.29.
 *
 * Jusqu'ici le championnat était figé : un effectif adverse en 2031 était le
 * même qu'en 2025, aux retraites et aux jeunes près. Le manager pouvait acheter
 * ses concurrents, jamais l'inverse entre eux — le monde ne bougeait que quand
 * il le touchait.
 *
 * Ce module fait vivre le marché entre clubs IA pendant l'intersaison.
 *
 * ## Principe : les mêmes lois pour tous
 *
 * L'IA passe par `resolveTransferOffer`, exactement comme le joueur. Un barème
 * parallèle « pour l'IA » aurait divergé du jour où l'un des deux serait ajusté,
 * et produit des transferts que le manager ne pourrait pas reproduire — la pire
 * forme d'opacité dans un jeu de management.
 *
 * ## Ce que l'IA ne fait pas
 *
 * Elle ne touche **jamais** à l'effectif du club utilisateur. Vendre un de ses
 * joueurs sans son accord serait une décision prise à sa place ; c'est le rôle
 * des offres entrantes (`transfer-market.ts`), qu'il accepte ou refuse.
 */

import type { Rng } from '../rng.js';
import { createRng } from '../rng.js';
import { ALL_POSITIONS, type Club, type ClubId, type Player, type PlayerId } from '../types.js';
import type { TransferWindowId } from '../season/transfer-window.js';
import { canCover } from '../match/bench.js';
import { approximateOverall } from './development.js';
import { expectedMarketSalary } from './contracts.js';
import { computeAnnualPayroll } from './finances.js';
import { salaryCapFor } from './regulations.js';
import {
  askingPriceFor,
  estimateMarketValue,
  perceivedRank,
  resolveTransferOffer,
} from './transfer-offers.js';

// =============================================================================
// Réglages
// =============================================================================

/**
 * Effectif en dessous duquel un club refuse de vendre qui que ce soit : un XV
 * plus un remplaçant.
 *
 * Ce plancher n'est qu'un filet de sécurité grossier — la vraie protection est
 * la couverture **par poste**, qu'`evaluateClubOffer` refuse de casser. Calé
 * trop haut (20), il bloquait la totalité du marché : les effectifs du
 * championnat comptent 17 joueurs, aucun club n'aurait jamais pu vendre.
 */
const MIN_SQUAD_SIZE = 16;

/** Part de la trésorerie qu'un club accepte d'engager sur un mercato. */
const SPEND_RATIO = 0.45;

/** Nombre maximum de recrues par club et par intersaison. */
const MAX_SIGNINGS_PER_CLUB = 3;

/**
 * Nombre maximum de départs payants par club et par intersaison.
 *
 * Sans ce plafond, le meilleur effectif du championnat servait de supermarché :
 * quatre cadres de Toulouse partaient le même été parce qu'ils constituaient
 * mécaniquement la meilleure amélioration disponible pour tout le monde. Un
 * club ne se démantèle pas parce qu'il est bon.
 */
const MAX_SALES_PER_CLUB = 2;

/**
 * Écart de niveau minimum pour qu'une cible soit jugée digne d'un transfert
 * quand le poste est **déjà pourvu**. Sans ce seuil, les clubs échangeaient des
 * joueurs équivalents en boucle : du mouvement pour rien, qui donne l'illusion
 * d'un marché vivant sans en être un.
 */
const MIN_UPGRADE = 4;

/**
 * Écart toléré quand le poste est **dégarni** (une ou zéro doublure).
 *
 * Négatif à dessein : un club qui n'a personne derrière son titulaire prend une
 * doublure un peu moins bonne, il ne reste pas les mains vides en attendant le
 * joueur idéal. Sans cette distinction, seules les superstars changeaient de
 * club — deux transferts par intersaison sur tout un championnat.
 */
const DEPTH_TOLERANCE = -6;

/** Nombre de besoins qu'un club examine par intersaison. */
const NEEDS_CONSIDERED = 6;

/** Longueur de la liste de cibles explorée pour un besoin donné. */
const SHORTLIST_SIZE = 8;

/**
 * Effectif que chaque club IA cherche à atteindre.
 *
 * Sans cet objectif, l'intersaison était un carnage : tous les contrats du
 * championnat expirant la même année, `expireContracts` versait près de 200
 * joueurs à la rue d'un coup, les effectifs IA tombaient à une douzaine de
 * joueurs et n'en sortaient jamais — personne, côté IA, ne re-signait qui que
 * ce soit. Un mercato n'a aucun sens dans un championnat qui se vide.
 */
const TARGET_SQUAD_SIZE = 26;

/**
 * Écart de niveau que l'on accepte de concéder pour prendre un agent libre
 * plutôt qu'un joueur sous contrat. Zéro indemnité vaut bien quelques points.
 */
const FREE_AGENT_TOLERANCE = 4;

// =============================================================================
// Diagnostic d'effectif
// =============================================================================

export interface SquadNeed {
  readonly clubId: ClubId;
  /** Poste représentatif du besoin (celui qu'on cherchera à renforcer). */
  readonly position: Player['position'];
  /** Meilleur niveau actuellement disponible pour ce poste. */
  readonly bestAvailable: number;
  /** Nombre de joueurs capables de tenir le poste. */
  readonly cover: number;
  /** Plus le score est haut, plus le besoin est criant. */
  readonly severity: number;
}

/**
 * Repère les postes où un club est en souffrance.
 *
 * Deux formes de faiblesse, cumulées dans `severity` : un poste **mal couvert**
 * (une blessure et l'équipe est démunie) et un poste **faible en niveau** par
 * rapport à ce que le club vaut par ailleurs. Un club solide qui a un trou à
 * l'ouverture doit le sentir autant qu'un club faible partout.
 */
export function diagnoseSquad(
  clubId: ClubId,
  roster: readonly Player[],
  leagueAverageByPosition: ReadonlyMap<string, number>,
  /**
   * Joueurs indisponibles pour la suite de la saison. En cours d'exercice, un
   * cadre absent trois mois ne couvre rien : c'est même la première raison
   * pour laquelle un club se présente au mercato d'hiver.
   */
  unavailableIds?: ReadonlySet<PlayerId>,
  /**
   * Pression exercée sur le club (V0.30). Ajoutée à la gravité de **chaque**
   * poste, elle fait remonter des besoins qu'un club serein ignorerait.
   *
   * C'est ce qui rend un mercato d'hiver possible : à mi-saison, les effectifs
   * sont sains et aucun poste n'atteint le seuil, si bien que la fenêtre restait
   * désespérément vide. Un club qui rate sa saison, lui, cherche partout.
   */
  urgency = 0,
): readonly SquadNeed[] {
  const active = roster.filter(
    p => !p.retired && !p.freeAgent && !unavailableIds?.has(p.id),
  );
  const needs: SquadNeed[] = [];

  for (const position of ALL_POSITIONS) {
    // Deux mesures distinctes, et les confondre fausse tout : le **titulaire**
    // se juge au poste exact — c'est lui qui joue là — tandis que la
    // **couverture** s'apprécie par groupe, puisqu'un centre dépanne à
    // l'ouverture. En prenant le meilleur du groupe comme titulaire, un bon
    // ailier masquait un arrière médiocre et le club ne voyait jamais le trou.
    const holders = active.filter(p => p.position === position);
    const able = active.filter(p => canCover(p, position));

    const bestAvailable = holders.length === 0
      ? 0
      : Math.max(...holders.map(approximateOverall));

    const leagueAverage = leagueAverageByPosition.get(position) ?? 60;

    // Un poste sans titulaire crédible pèse bien plus lourd qu'un poste
    // simplement perfectible : c'est une équipe qu'on ne peut pas aligner.
    const coverGap = able.length === 0 ? 40 : able.length === 1 ? 16 : able.length === 2 ? 5 : 0;
    const levelGap = Math.max(0, leagueAverage - bestAvailable);

    const severity = coverGap + levelGap + urgency;
    if (severity <= 0) continue;

    needs.push({ clubId, position, bestAvailable, cover: able.length, severity });
  }

  return needs.sort((a, b) => b.severity - a.severity);
}

/**
 * Niveau moyen du titulaire de chaque poste, tous clubs confondus.
 *
 * Au poste exact, comme `diagnoseSquad` : la référence à laquelle un club se
 * compare doit se mesurer de la même façon que ce qu'il possède.
 */
export function leagueAverageByPosition(
  rosterByClub: ReadonlyMap<ClubId, readonly Player[]>,
): ReadonlyMap<string, number> {
  const out = new Map<string, number>();

  for (const position of ALL_POSITIONS) {
    const bests: number[] = [];
    for (const roster of rosterByClub.values()) {
      const holders = roster.filter(p => !p.retired && !p.freeAgent && p.position === position);
      if (holders.length > 0) bests.push(Math.max(...holders.map(approximateOverall)));
    }
    out.set(position, bests.length === 0 ? 60 : bests.reduce((s, v) => s + v, 0) / bests.length);
  }

  return out;
}

// =============================================================================
// Résultat
// =============================================================================

/**
 * Nature du mouvement — trois choses très différentes que l'affichage doit
 * séparer. Une intersaison compte quelques transferts payants et parfois des
 * dizaines de prolongations : les mélanger noierait l'information.
 */
export type AiMoveKind =
  /** Indemnité versée à un club vendeur. */
  | 'TRANSFERT'
  /** Joueur libre récupéré par un autre club. */
  | 'RECRUE_LIBRE'
  /** Le club re-signe son propre joueur en fin de contrat. */
  | 'PROLONGATION'
  /**
   * V0.46 — joueur libéré pour repasser sous le plafond salarial.
   *
   * Distinct d'un transfert : le club ne touche rien, il se sépare d'un salaire.
   */
  | 'DEPART_LIBRE';

export interface AiTransfer {
  readonly kind: AiMoveKind;
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly position: Player['position'];
  readonly overall: number;
  readonly fromClubId: ClubId;
  readonly fromClubName: string;
  readonly toClubId: ClubId;
  readonly toClubName: string;
  readonly fee: number;
  readonly annualSalary: number;
  readonly years: number;
  /** Vrai quand le joueur était sans club : aucune indemnité versée. */
  readonly wasFreeAgent: boolean;
}

export interface AiMarketResult {
  /** Joueurs après mercato — même longueur qu'en entrée, contrats et clubs à jour. */
  readonly players: readonly Player[];
  /** Trésoreries mises à jour (indemnités débitées et créditées). */
  readonly balanceByClub: ReadonlyMap<ClubId, number>;
  /** Transferts conclus, du plus cher au moins cher. */
  readonly transfers: readonly AiTransfer[];
}

export interface AiMarketInput {
  readonly players: readonly Player[];
  readonly clubs: readonly Club[];
  /** Club de l'utilisateur : intouchable, ni vendeur ni acheteur. */
  readonly playerClubId: ClubId;
  readonly balanceByClub: ReadonlyMap<ClubId, number>;
  /** Saison qui commence. */
  readonly currentSeason: number;
  /** Classement final de la saison écoulée, du 1er au dernier. */
  readonly rankedClubIds: readonly ClubId[];
  readonly seed: string;
  /**
   * V0.30 — nature de la fenêtre. L'été, on reconstruit un effectif ; l'hiver,
   * on répare une saison. Les deux ne se jouent pas du tout de la même façon.
   */
  readonly window?: TransferWindowId;
  /**
   * V0.30 — joueurs hors service pour le reste de la saison (blessures longues,
   * suspensions). Ils cessent de compter comme couverture au poste, ce qui est
   * précisément ce qui envoie un club au mercato d'hiver.
   */
  readonly unavailableIds?: ReadonlySet<PlayerId>;
  /**
   * V0.46 — étage du championnat, donc plafond applicable.
   *
   * Sans lui, seul le club de l'utilisateur était contraint par le salary cap :
   * les clubs IA pouvaient empiler les salaires sans limite, et la règle qui
   * devait façonner tous les effectifs ne pesait que sur un seul.
   */
  readonly division?: 'TOP14' | 'PRO_D2';
  /**
   * V0.47 — clubs sous interdiction de recrutement.
   *
   * La sanction ne servait à rien tant qu'elle ne frappait que l'utilisateur :
   * un club IA sanctionné continuait de signer comme si de rien n'était.
   */
  readonly transferBannedClubs?: ReadonlySet<ClubId>;
}

/** Réglages qui distinguent les deux fenêtres. */
interface WindowRules {
  readonly maxSignings: number;
  readonly maxSales: number;
  readonly needsConsidered: number;
  /** Prolonger et compléter l'effectif n'a de sens qu'à l'intersaison. */
  readonly replenish: boolean;
  /** Part de la trésorerie engagée. */
  readonly spendRatio: number;
  /**
   * Le retard au classement compte-t-il ? En été, tout le monde se renforce de
   * toute façon (prolongations, complément d'effectif, six besoins examinés).
   * En hiver, seuls les clubs en difficulté bougent — et c'est exactement ce
   * qu'on observe dans un vrai marché de janvier.
   */
  readonly urgencyDriven: boolean;
}

const WINDOW_RULES: Readonly<Record<TransferWindowId, WindowRules>> = {
  ESTIVAL: {
    maxSignings: MAX_SIGNINGS_PER_CLUB,
    maxSales: MAX_SALES_PER_CLUB,
    needsConsidered: NEEDS_CONSIDERED,
    replenish: true,
    spendRatio: SPEND_RATIO,
    urgencyDriven: false,
  },
  // L'hiver, un club colmate. Il ne prolonge pas (aucun contrat n'expire en
  // janvier), ne reconstruit pas son effectif, et n'engage qu'un seul renfort —
  // mais il faut qu'il ait de quoi le payer. À 20 % de la trésorerie, aucun
  // joueur de niveau Top 14 n'était accessible et la fenêtre restait vide.
  HIVERNAL: {
    maxSignings: 1,
    maxSales: 1,
    // Le club balaie tous les postes, mais ne signera qu'une fois. Se limiter à
    // ses trois points faibles le condamnait à l'inaction : ce sont justement
    // les postes où un club sous pression est déjà bon, donc où le renfort est
    // hors de prix. Un club aux abois cherche là où il *peut* se renforcer.
    needsConsidered: ALL_POSITIONS.length,
    replenish: false,
    spendRatio: 0.35,
    urgencyDriven: true,
  },
};

/**
 * Points de gravité ajoutés par place perdue face aux attentes.
 *
 * Calibré pour qu'un club deux ou trois places en dessous de son rang naturel
 * reste tranquille, et qu'un prétendant relégable se mette réellement à
 * chercher.
 */
const URGENCY_PER_RANK = 3.5;

/**
 * Retard au classement en dessous duquel un club ne s'affole pas.
 *
 * Calé haut à dessein : à 3, dix clubs sur quatorze se jugeaient en crise à la
 * trêve et le marché d'hiver devenait plus agité que celui d'été — l'inverse de
 * la réalité. Il faut une saison franchement ratée, pas une déception.
 */
const URGENCY_TOLERANCE = 5;

/**
 * Convertit la pression en surenchère salariale : `urgency / diviseur` s'ajoute
 * au multiplicateur de salaire. À 21 points de pression, un club propose ~1,5
 * fois le salaire de référence — le prix à payer pour convaincre un joueur de
 * rejoindre une équipe en difficulté en cours de saison.
 */
const URGENCY_SALARY_DIVISOR = 50;

// =============================================================================
// Mercato
// =============================================================================

/**
 * Déroule une intersaison de transferts entre clubs IA.
 *
 * Les clubs agissent **par ordre de puissance financière**, ce qui reproduit la
 * hiérarchie réelle du marché : les gros servis d'abord, les autres sur ce qui
 * reste. Chaque club traite ses besoins du plus criant au moins urgent.
 */
/**
 * Le mercato des deux divisions, dans la foulée : v0.60.
 *
 * L'intersaison ne faisait tourner le marché que dans la division du manager,
 * alors que le vieillissement et les retraites frappent tout le monde. Le
 * championnat qu'on ne joue pas perdait des joueurs chaque saison sans jamais
 * en recevoir, et se vidait au fil des années.
 *
 * Une seule passe sur l'ensemble des clubs ne réglerait rien : le plafond
 * salarial n'est pas le même en Top 14 et en Pro D2, et `runAiMarket` en prend
 * un seul. On enchaîne donc une passe par division, la seconde partant des
 * effectifs et des trésoreries que la première a laissés.
 */
export function runAiMarketAcrossDivisions(input: {
  readonly base: Omit<AiMarketInput, 'clubs' | 'division' | 'seed'>;
  readonly seed: string;
  /** Clubs de chaque division, dans l'ordre où le marché doit se jouer. */
  readonly byDivision: readonly {
    readonly division: 'TOP14' | 'PRO_D2';
    readonly clubs: readonly Club[];
  }[];
}): AiMarketResult {
  let players = input.base.players;
  let balances = input.base.balanceByClub;
  const transfers: AiTransfer[] = [];

  for (const { division, clubs } of input.byDivision) {
    if (clubs.length === 0) continue;
    const pass = runAiMarket({
      ...input.base,
      players,
      balanceByClub: balances,
      clubs,
      division,
      seed: `${input.seed}_${division}`,
    });
    players = pass.players;
    balances = pass.balanceByClub;
    transfers.push(...pass.transfers);
  }

  return { players, balanceByClub: balances, transfers };
}

export function runAiMarket(input: AiMarketInput): AiMarketResult {
  const windowId = input.window ?? 'ESTIVAL';
  const rules = WINDOW_RULES[windowId];
  const rng = createRng(`ai_market_${input.seed}_${input.currentSeason}_${windowId}`);

  // État mutable local : on travaille sur des index, puis on ressort la liste.
  const playerById = new Map<PlayerId, Player>(input.players.map(p => [p.id, p]));
  const balances = new Map<ClubId, number>(input.balanceByClub);
  const clubById = new Map<ClubId, Club>(input.clubs.map(c => [c.id, c]));
  const transfers: AiTransfer[] = [];
  const alreadyMoved = new Set<PlayerId>();
  const sales = new Map<ClubId, number>();

  /** Budget mercato restant, figé au départ : dépenser ses recettes de vente
   *  le jour même produirait des enchaînements invraisemblables. */
  const budgets = new Map<ClubId, number>();
  const signings = new Map<ClubId, number>();

  // Un club interdit de recrutement ne participe pas au marché — il peut encore
  // perdre des joueurs, mais il n'en enregistre aucun.
  const banned = input.transferBannedClubs ?? new Set<ClubId>();
  const aiClubs = input.clubs.filter(c => c.id !== input.playerClubId && !banned.has(c.id));
  for (const club of aiClubs) {
    budgets.set(club.id, Math.max(0, (balances.get(club.id) ?? 0) * rules.spendRatio));
    signings.set(club.id, 0);
  }

  const rosterOf = (clubId: ClubId): Player[] =>
    [...playerById.values()].filter(p => p.clubId === clubId && !p.retired && !p.freeAgent);

  const rankOf = (clubId: ClubId): number => {
    const index = input.rankedClubIds.indexOf(clubId);
    return index >= 0 ? index + 1 : input.clubs.length;
  };

  const byReputation = [...input.clubs].sort((a, b) => b.reputation - a.reputation);
  const reputationRankOf = (clubId: ClubId): number =>
    byReputation.findIndex(c => c.id === clubId) + 1;

  /** Ce que vaut un club aux yeux d'un joueur : son classement et sa stature. */
  const attractivenessOf = (clubId: ClubId): number =>
    perceivedRank(rankOf(clubId), reputationRankOf(clubId));

  // Ordre d'intervention : le plus gros portefeuille ouvre le bal.
  const order = [...aiClubs].sort((a, b) => (budgets.get(b.id) ?? 0) - (budgets.get(a.id) ?? 0));

  const averages = leagueAverageByPosition(
    new Map(input.clubs.map(c => [c.id, rosterOf(c.id)])),
  );

  /**
   * Retard d'un club sur le rang que sa réputation laissait espérer.
   *
   * La réputation sert de référence plutôt que le budget : c'est elle qui porte
   * l'attente du public et du board, donc la pression réelle sur le club.
   */
  const urgencyOf = (clubId: ClubId): number => {
    if (!rules.urgencyDriven) return 0;
    const expected = reputationRankOf(clubId);
    const actual = rankOf(clubId);
    const behind = actual - expected - URGENCY_TOLERANCE;
    return behind > 0 ? behind * URGENCY_PER_RANK : 0;
  };

  // ---- 0. Dégraissage ------------------------------------------------------
  //
  // V0.46 — un club au-dessus du plafond ne peut plus recruter, mais rien ne
  // l'obligeait à redescendre : il restait bloqué en infraction saison après
  // saison, et le plafond se contentait de geler son mercato au lieu de
  // façonner son effectif.
  //
  // Il libère donc ses plus gros salaires jusqu'à repasser sous la barre. On
  // vise le salaire, pas le niveau : c'est de la masse salariale qu'il faut
  // enlever, et c'est ce qui donne au plafond son effet réel — les meilleurs
  // joueurs des clubs les plus dépensiers arrivent sur le marché.
  //
  // Uniquement à l'intersaison : le plafond s'apprécie sur l'exercice, comme la
  // commission qui sanctionne. Dégraisser en janvier faisait libérer les mêmes
  // cadres deux fois par saison — constaté en jeu, Toulouse relâchait Dupont,
  // Ntamack et Baille à la journée 13 puis de nouveau à l'intersaison.
  const capOf = input.division ?? 'TOP14';
  const trimmable = input.clubs.filter(c => c.id !== input.playerClubId);
  for (const club of rules.replenish ? trimmable : []) {
    let roster = rosterOf(club.id);
    let payroll = computeAnnualPayroll(roster);
    const cap = salaryCapFor(capOf);
    let released = 0;

    // On ne vide pas un effectif : au-delà de trois départs, le club préfère
    // payer l'amende plutôt que de se retrouver à quinze joueurs.
    while (payroll > cap && released < 3 && roster.length > MIN_SQUAD_SIZE) {
      const costliest = [...roster]
        .filter(p => !alreadyMoved.has(p.id))
        .sort((a, b) => b.contract.annualSalary - a.contract.annualSalary)[0];
      if (!costliest) break;

      playerById.set(costliest.id, {
        ...costliest,
        clubId: 'libre' as ClubId,
        freeAgent: true,
      });
      alreadyMoved.add(costliest.id);
      transfers.push({
        kind: 'DEPART_LIBRE',
        playerId: costliest.id,
        playerName: `${costliest.firstName} ${costliest.lastName}`,
        fromClubId: club.id,
        fromClubName: club.name,
        toClubId: 'libre' as ClubId,
        toClubName: 'Sans club',
        fee: 0,
        overall: Math.round(approximateOverall(costliest)),
        position: costliest.position,
        annualSalary: costliest.contract.annualSalary,
        years: 0,
        wasFreeAgent: false,
      });

      released++;
      roster = rosterOf(club.id);
      payroll = computeAnnualPayroll(roster);
    }
  }

  // ---- 1. Renouvellements --------------------------------------------------
  // Un club regarnit d'abord son propre vestiaire. Le faire après les recrues
  // vedettes conduirait à des clubs qui s'offrent un international avec douze
  // joueurs sous contrat — l'ordre porte ici tout le réalisme.
  //
  // Sans objet en janvier : aucun contrat n'expire en cours de saison.
  for (const club of rules.replenish ? order : []) {
    const renewals = replenishSquad({
      club,
      playerById,
      currentSeason: input.currentSeason,
      ownPlayersFirst: true,
      rng,
      division: capOf,
    });
    transfers.push(...renewals);
    for (const r of renewals) alreadyMoved.add(r.playerId);
  }

  // ---- 2. Recrutement ciblé -------------------------------------------------
  for (const buyer of order) {
    const urgency = urgencyOf(buyer.id);
    const needs = diagnoseSquad(buyer.id, rosterOf(buyer.id), averages, input.unavailableIds, urgency)
      .slice(0, rules.needsConsidered);

    for (const need of needs) {
      if ((signings.get(buyer.id) ?? 0) >= rules.maxSignings) break;

      const done = attemptSigning({
        buyer,
        need,
        playerById,
        balances,
        budgets,
        clubById,
        rosterOf,
        rankOf: attractivenessOf,
        playerClubId: input.playerClubId,
        currentSeason: input.currentSeason,
        totalClubs: input.clubs.length,
        alreadyMoved,
        sales,
        division: input.division ?? 'TOP14',
        maxSales: rules.maxSales,
        urgency,
        rng,
      });

      if (done) {
        transfers.push(done);
        alreadyMoved.add(done.playerId);
        signings.set(buyer.id, (signings.get(buyer.id) ?? 0) + 1);
      }
    }
  }

  // ---- 3. Complément d'effectif --------------------------------------------
  // Ce qui reste sur le marché sert à combler les effectifs encore trop courts,
  // y compris avec des joueurs venus d'ailleurs.
  for (const club of rules.replenish ? order : []) {
    const fillers = replenishSquad({
      club,
      playerById,
      currentSeason: input.currentSeason,
      ownPlayersFirst: false,
      rng,
      division: capOf,
    });
    transfers.push(...fillers);
    for (const f of fillers) alreadyMoved.add(f.playerId);
  }

  return {
    players: input.players.map(p => playerById.get(p.id) ?? p),
    balanceByClub: balances,
    transfers: transfers.sort((a, b) => b.fee - a.fee),
  };
}

// =============================================================================
// Une signature
// =============================================================================

interface SigningContext {
  readonly buyer: Club;
  readonly need: SquadNeed;
  readonly playerById: Map<PlayerId, Player>;
  readonly balances: Map<ClubId, number>;
  readonly budgets: Map<ClubId, number>;
  readonly clubById: Map<ClubId, Club>;
  readonly rosterOf: (clubId: ClubId) => Player[];
  readonly rankOf: (clubId: ClubId) => number;
  /** Départs payants déjà consentis par chaque club cette fenêtre. */
  readonly sales: Map<ClubId, number>;
  readonly division: 'TOP14' | 'PRO_D2';
  readonly maxSales: number;
  /** Pression subie par l'acheteur : elle abaisse son exigence de niveau. */
  readonly urgency: number;
  readonly playerClubId: ClubId;
  readonly currentSeason: number;
  readonly totalClubs: number;
  /** Joueurs déjà transférés durant cette intersaison. */
  readonly alreadyMoved: ReadonlySet<PlayerId>;
  readonly rng: Rng;
}

/**
 * Cherche et conclut une recrue pour un besoin donné.
 *
 * Les agents libres sont examinés en premier : ils ne coûtent aucune indemnité,
 * et un club qui laisse traîner un joueur libre utile pendant qu'il dépense des
 * millions ailleurs se comporte de façon incompréhensible.
 */
function attemptSigning(ctx: SigningContext): AiTransfer | undefined {
  const { buyer, need, playerById, budgets, rosterOf, rng } = ctx;

  const budget = budgets.get(buyer.id) ?? 0;
  const roster = rosterOf(buyer.id);
  const payroll = computeAnnualPayroll(roster);

  // Deux contraintes distinctes, et c'est la plus serrée qui commande :
  //  - le **budget** dit ce que le club peut payer ;
  //  - le **plafond** dit ce que la Ligue autorise.
  // Un club déjà au-dessus du plafond n'a plus de marge du tout : il doit
  // vendre avant de recruter, exactement comme le club de l'utilisateur.
  const budgetHeadroom = buyer.annualBudget - payroll;
  const capHeadroom = salaryCapFor(ctx.division) - payroll;
  const salaryHeadroom = Math.min(budgetHeadroom, capHeadroom);
  if (salaryHeadroom <= 0) return undefined;

  // Un poste dégarni cherche un corps, un poste pourvu cherche un titulaire.
  // Un club sous pression se contente de moins : il lui faut du renfort tout de
  // suite, pas le joueur idéal.
  const threshold = need.cover <= 1
    ? DEPTH_TOLERANCE
    : Math.max(1, MIN_UPGRADE - ctx.urgency / URGENCY_PER_RANK);

  /**
   * Un club fermé — plafond de ventes atteint ou effectif au plancher — n'a
   * personne à vendre. L'écarter ici plutôt qu'au moment de conclure est
   * essentiel : sinon la liste de cibles se remplit de ses joueurs, qui sont
   * les meilleurs disponibles, et s'épuise sans qu'aucune offre n'aboutisse.
   */
  const sellerIsOpen = (clubId: ClubId): boolean =>
    (ctx.sales.get(clubId) ?? 0) < ctx.maxSales
    && ctx.rosterOf(clubId).length > MIN_SQUAD_SIZE;

  const candidates = [...playerById.values()].filter(p =>
    !p.retired
    && p.clubId !== buyer.id
    // Un joueur déjà transféré cette intersaison est posé : sans ce verrou, il
    // pouvait enchaîner deux clubs dans la même fenêtre, ce qui n'a aucun sens
    // et fausse en plus le décompte des indemnités.
    && !ctx.alreadyMoved.has(p.id)
    // L'effectif de l'utilisateur est hors d'atteinte : ses ventes lui appartiennent.
    && (p.freeAgent || p.clubId !== ctx.playerClubId)
    && (p.freeAgent || sellerIsOpen(p.clubId))
    && canCover(p, need.position)
    && approximateOverall(p) >= need.bestAvailable + threshold
    && expectedMarketSalary(p, ctx.currentSeason) <= salaryHeadroom,
  );

  if (candidates.length === 0) return undefined;

  // Le meilleur joueur accessible, pas le meilleur joueur : viser une cible
  // manifestement hors budget ferait échouer tous les clubs modestes.
  const affordable = candidates.filter(p =>
    p.freeAgent || estimateMarketValue(p, ctx.currentSeason) <= budget,
  );
  if (affordable.length === 0) return undefined;

  const byLevel = (a: Player, b: Player) => approximateOverall(b) - approximateOverall(a);
  const freeAgents = affordable.filter(p => p.freeAgent).sort(byLevel);
  const contracted = affordable.filter(p => !p.freeAgent).sort(byLevel);

  // Un agent libre de valeur comparable est toujours le meilleur choix : il ne
  // coûte aucune indemnité. Payer des millions pendant qu'un joueur équivalent
  // attend sans club serait incompréhensible de la part d'un club sérieux.
  const bestFree = freeAgents[0];
  const bestPaid = contracted[0];
  const preferFree = bestFree !== undefined
    && (bestPaid === undefined
      || approximateOverall(bestFree) >= approximateOverall(bestPaid) - FREE_AGENT_TOLERANCE);

  // Liste de cibles, pas un nom unique. Un prix hors budget, un vendeur à l'os
  // ou un joueur qui décline ne doit pas faire abandonner le poste : le club
  // descend sa liste. Sans cette boucle, une seule tentative par besoin suffisait
  // à assécher le marché — un ou deux transferts par intersaison sur 14 clubs,
  // alors qu'une quarantaine de candidats étaient disponibles.
  const shortlist = [
    ...(preferFree ? freeAgents : []),
    ...(preferFree ? contracted : [...contracted, ...freeAgents]),
  ].slice(0, SHORTLIST_SIZE);

  // Un peu de bruit dans l'ordre : sans lui, tous les clubs convoitent les mêmes
  // joueurs dans le même ordre et le marché est parfaitement prévisible.
  if (shortlist.length > 2 && rng.nextBool(0.5)) {
    const head = shortlist.splice(0, 1)[0]!;
    shortlist.splice(Math.min(shortlist.length, rng.nextInt(1, 3)), 0, head);
  }

  for (const target of shortlist) {
    const done = tryTarget(ctx, target, budget, salaryHeadroom);
    if (done) return done;
  }
  return undefined;
}

// =============================================================================
// Garnissage d'effectif
// =============================================================================

/**
 * Signe des agents libres jusqu'à atteindre un effectif viable.
 *
 * Aucune indemnité n'est versée : ces joueurs n'appartiennent à personne. Seule
 * la masse salariale limite l'opération, ce qui suffit à empêcher un club
 * modeste de ramasser tout le marché.
 *
 * `ownPlayersFirst` sert au tour de renouvellement : un club re-signe ses
 * propres joueurs en fin de contrat avant de regarder ailleurs — c'est ce que
 * fait n'importe quel club, et ça évite un grand mélange général chaque été.
 */
function replenishSquad(args: {
  readonly club: Club;
  readonly playerById: Map<PlayerId, Player>;
  readonly currentSeason: number;
  readonly ownPlayersFirst: boolean;
  readonly rng: Rng;
  /** V0.46 — étage, donc plafond applicable au complément d'effectif. */
  readonly division: 'TOP14' | 'PRO_D2';
}): AiTransfer[] {
  const { club, playerById, currentSeason, ownPlayersFirst, rng } = args;
  const signed: AiTransfer[] = [];

  const squad = (): Player[] =>
    [...playerById.values()].filter(p => p.clubId === club.id && !p.retired && !p.freeAgent);

  // La marge est la plus serrée des deux : le budget du club et le plafond de la
  // Ligue. Sans le second, un club qui vient de libérer ses gros salaires pour
  // repasser sous la barre les re-signait dans la foulée, et se retrouvait à les
  // relâcher de nouveau la saison suivante — une boucle absurde observée en
  // mesure sur six saisons.
  let headroom = Math.min(
    club.annualBudget - computeAnnualPayroll(squad()),
    salaryCapFor(args.division) - computeAnnualPayroll(squad()),
  );

  while (squad().length < TARGET_SQUAD_SIZE) {
    const pool = [...playerById.values()].filter(p =>
      p.freeAgent
      && !p.retired
      && (!ownPlayersFirst || p.clubId === club.id)
      && expectedMarketSalary(p, currentSeason) <= headroom,
    );
    if (pool.length === 0) break;

    // Priorité au poste le plus dégarni, puis au meilleur joueur qui le tient :
    // remplir avec trois ouvreurs pendant qu'il manque un pilier ne servirait
    // à rien.
    const current = squad();
    const scarcity = (p: Player): number => current.filter(q => canCover(q, p.position)).length;
    pool.sort((a, b) => {
      const gap = scarcity(a) - scarcity(b);
      if (gap !== 0) return gap;
      return approximateOverall(b) - approximateOverall(a);
    });

    const target = pool[0]!;
    const salary = Math.round(expectedMarketSalary(target, currentSeason) * (1 + rng.next() * 0.1));
    if (salary > headroom) break;

    const years = rng.nextInt(2, 4);
    playerById.set(target.id, {
      ...target,
      clubId: club.id,
      freeAgent: false,
      contract: { startSeason: currentSeason, endSeason: currentSeason + years, annualSalary: salary },
    });
    headroom -= salary;

    signed.push({
      // Le joueur retrouve son club d'origine : c'est une prolongation, pas un
      // transfert. La distinction porte tout l'affichage du mercato.
      kind: target.clubId === club.id ? 'PROLONGATION' : 'RECRUE_LIBRE',
      playerId: target.id,
      playerName: `${target.firstName} ${target.lastName}`,
      position: target.position,
      overall: Math.round(approximateOverall(target)),
      fromClubId: target.clubId,
      fromClubName: target.clubId === club.id ? club.name : 'Sans club',
      toClubId: club.id,
      toClubName: club.name,
      fee: 0,
      annualSalary: salary,
      years,
      wasFreeAgent: true,
    });
  }

  return signed;
}

/** Tente une cible précise. Renvoie `undefined` dès qu'un verrou se referme. */
function tryTarget(
  ctx: SigningContext,
  target: Player,
  budget: number,
  salaryHeadroom: number,
): AiTransfer | undefined {
  const { buyer, playerById, balances, budgets, clubById, rosterOf, rankOf, rng } = ctx;

  // Un club sous pression met le paquet sur le salaire, et c'est indispensable :
  // il est mal classé, donc peu attirant sportivement, et un joueur ne quitte
  // pas un leader pour un candidat à la descente sans contrepartie. Sans cette
  // surenchère, chaque offre du mercato d'hiver se heurtait au refus du joueur.
  //
  // La base est le **plus élevé** du tarif du marché et du salaire actuel :
  // proposer 1,2 fois le marché à un joueur déjà mieux payé que le marché,
  // c'était lui proposer une baisse.
  const floor = Math.max(
    expectedMarketSalary(target, ctx.currentSeason),
    target.contract.annualSalary,
  );
  const premium = 1.05 + rng.next() * 0.2 + ctx.urgency / URGENCY_SALARY_DIVISOR;
  const salary = Math.round(floor * premium);
  if (salary > salaryHeadroom) return undefined;
  const years = rng.nextInt(2, 4);

  // ---- Agent libre : pas d'indemnité, pas de club vendeur -------------------
  if (target.freeAgent) {
    const signed: Player = {
      ...target,
      clubId: buyer.id,
      freeAgent: false,
      contract: {
        startSeason: ctx.currentSeason,
        endSeason: ctx.currentSeason + years,
        annualSalary: salary,
      },
    };
    playerById.set(target.id, signed);
    return {
      kind: 'RECRUE_LIBRE',
      playerId: target.id,
      playerName: `${target.firstName} ${target.lastName}`,
      position: target.position,
      overall: Math.round(approximateOverall(target)),
      fromClubId: target.clubId,
      fromClubName: 'Sans club',
      toClubId: buyer.id,
      toClubName: buyer.name,
      fee: 0,
      annualSalary: salary,
      years,
      wasFreeAgent: true,
    };
  }

  // ---- Joueur sous contrat --------------------------------------------------
  const seller = clubById.get(target.clubId);
  if (!seller) return undefined;

  // Un club qui s'est déjà délesté deux fois ferme boutique pour cet été.
  if ((ctx.sales.get(seller.id) ?? 0) >= ctx.maxSales) return undefined;

  const sellingRoster = rosterOf(seller.id);
  // Un club déjà à l'os ne se déleste pas davantage : `evaluateClubOffer` protège
  // le poste, pas la taille globale de l'effectif.
  if (sellingRoster.length <= MIN_SQUAD_SIZE) return undefined;

  const decisionInput = {
    offer: {
      playerId: target.id,
      fromClubId: seller.id,
      toClubId: buyer.id,
      fee: 0,
      annualSalary: salary,
      years,
    },
    player: target,
    sellingClub: seller,
    sellingRoster,
    currentSeason: ctx.currentSeason,
    sellingBalance: balances.get(seller.id) ?? 0,
  };

  // L'IA ne marchande pas à l'aveugle : elle sait ce que le vendeur demande et
  // paie ce prix, ou renonce. Simuler un aller-retour de négociation ne
  // changerait que le nombre d'itérations, jamais l'issue.
  const price = askingPriceFor(decisionInput);
  if (price > budget) return undefined;

  const resolution = resolveTransferOffer(
    {
      ...decisionInput,
      offer: { ...decisionInput.offer, fee: price },
      buyerRank: rankOf(buyer.id),
      currentRank: rankOf(seller.id),
      buyerRoster: rosterOf(buyer.id),
      totalClubs: ctx.totalClubs,
    },
    rng,
  );

  if (!resolution.accepted || !resolution.player) return undefined;

  playerById.set(target.id, resolution.player);
  ctx.sales.set(seller.id, (ctx.sales.get(seller.id) ?? 0) + 1);
  balances.set(buyer.id, (balances.get(buyer.id) ?? 0) - price);
  balances.set(seller.id, (balances.get(seller.id) ?? 0) + price);
  budgets.set(buyer.id, budget - price);

  return {
    kind: 'TRANSFERT',
    playerId: target.id,
    playerName: `${target.firstName} ${target.lastName}`,
    position: target.position,
    overall: Math.round(approximateOverall(target)),
    fromClubId: seller.id,
    fromClubName: seller.name,
    toClubId: buyer.id,
    toClubName: buyer.name,
    fee: price,
    annualSalary: salary,
    years,
    wasFreeAgent: false,
  };
}
