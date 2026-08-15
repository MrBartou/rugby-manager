/**
 * Les clauses du contrat : V0.64.
 *
 * Un contrat n'avait que deux chiffres, un salaire et une durée. Négocier
 * revenait donc à pousser un curseur : soit on payait assez, soit non. Il n'y
 * avait rien à échanger, et un manager pauvre n'avait aucun moyen de signer
 * autrement qu'en payant le prix fort.
 *
 * Ce module ajoute ce qui manque pour qu'une négociation ait plusieurs sorties :
 * des primes, un salaire qui monte avec les années, une année en option, et une
 * clause libératoire. `releaseClause` et `performanceBonus` avaient été déclarés
 * dès la V0.1 et retirés en V0.60 parce que personne ne les lisait. Ils
 * reviennent ici branchés, et ils reviennent avec le reste.
 *
 * ## Ce qu'une clause vaut n'est pas ce qu'elle coûte
 *
 * C'est la règle qui tient tout le module. Une prime de match à 4 000 € coûte
 * au club 4 000 € par titularisation, mais ne vaut, pour le joueur qui la
 * signe, que ce qu'il croit pouvoir en toucher : un remplaçant qui compte
 * jouer huit matchs ne l'échange pas contre le même salaire garanti qu'un
 * cadre qui en jouera vingt-cinq. Et même à espérance égale, une prime vaut
 * moins qu'un salaire, parce qu'elle peut ne pas tomber.
 *
 * De cet écart naissent les vraies décisions du mercato : charger les primes
 * pour signer au-dessus de ses moyens et payer plus tard si l'équipe marche,
 * ou tout garantir et dormir tranquille.
 */

import type { Contract, Player, PlayerId } from '../types.js';

// =============================================================================
// Le contenu d'une clause
// =============================================================================

/*
 * Les trois formes de clause sont déclarées dans `engine/types.ts`, avec le
 * contrat qui les porte : elles voyagent dans les sauvegardes, et un type de
 * données sauvegardé n'a qu'un seul domicile. Ce qu'elles veulent dire se lit
 * ici.
 *
 * `ContractBonuses` : trois déclencheurs, choisis parce que le jeu sait déjà les
 * compter. Un match disputé, un essai marqué, une sélection honorée. Une prime
 * de titre aurait été un quatrième champ à écrire et à ne jamais payer, faute
 * d'un endroit qui sache dire « il a gagné le Top 14 » au moment où on solde les
 * comptes.
 *
 * `ContractOption` : l'année en option appartient à l'un ou à l'autre, et c'est
 * toute la différence. Au club, c'est une assurance qu'il lève si le joueur a
 * tenu ses promesses ; au joueur, c'est une porte de sortie qu'il garde ouverte.
 * Les deux se paient, dans des sens opposés.
 *
 * `SellOnClause` : le pourcentage à la revente vit sur le contrat du joueur et
 * non sur la transaction qui l'a créé, parce qu'il doit lui survivre. C'est le
 * transfert suivant qui le déclenche, des années plus tard.
 */

/** Plafond de la part à la revente : au-delà, plus personne n'achète. */
export const MAX_SELL_ON = 0.30;

// =============================================================================
// Le salaire en vigueur
// =============================================================================

/**
 * Le salaire réellement dû pour une saison donnée.
 *
 * `annualSalary` reste le salaire de la première année : sans cela, toute
 * sauvegarde antérieure et tout code qui lit le champ directement changeraient
 * de sens du jour au lendemain. La progression s'applique par-dessus, une fois
 * par année écoulée depuis la signature.
 */
export function salaryForSeason(contract: Contract, season: number): number {
  const progression = contract.salaryProgression ?? 0;
  if (progression === 0) return contract.annualSalary;
  const years = Math.max(0, Math.min(season, contract.endSeason) - contract.startSeason);
  return Math.round(contract.annualSalary * (1 + progression) ** years);
}

/**
 * Le salaire moyen sur la durée du contrat.
 *
 * C'est le chiffre qui compte pour juger une offre : un joueur signe un contrat
 * entier, pas sa première année. Un salaire progressif se négocie précisément
 * parce que les deux camps le lisent ainsi, le club en trésorerie immédiate et
 * le joueur en total encaissé.
 */
export function averageSalary(contract: Contract): number {
  const years = Math.max(1, contract.endSeason - contract.startSeason + 1);
  let total = 0;
  for (let i = 0; i < years; i++) {
    total += salaryForSeason(contract, contract.startSeason + i);
  }
  return Math.round(total / years);
}

// =============================================================================
// Ce que les primes coûtent au club
// =============================================================================

export interface BonusEarnings {
  /** Matchs disputés sur la saison, remplacements compris. */
  readonly matches: number;
  readonly tries: number;
  readonly caps: number;
}

/** Ce que le club doit à un joueur au titre de ses primes, sur une saison. */
export function bonusPayout(contract: Contract, earnings: BonusEarnings): number {
  const b = contract.bonuses;
  if (!b) return 0;
  return Math.round(
    (b.perMatch ?? 0) * Math.max(0, earnings.matches)
    + (b.perTry ?? 0) * Math.max(0, earnings.tries)
    + (b.perCap ?? 0) * Math.max(0, earnings.caps),
  );
}

/** Ce qu'un joueur a fait dans le match qu'on vient de jouer. */
export interface MatchdayParticipation {
  readonly played: boolean;
  readonly tries: number;
}

export interface MatchdayBonusLine {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly amount: number;
}

/**
 * Les primes dues au soir d'un match.
 *
 * On les paie journée par journée, et non en une fois à la clôture : une prime
 * qui tombe six mois après le match n'apprend rien au manager sur ce qu'elle lui
 * coûte, et le budget qu'il tenait toute la saison se serait effondré d'un coup
 * au mois de juin. Payée le jour même, elle se lit dans le bilan à côté de la
 * recette du match qu'elle a accompagné.
 */
export function matchdayBonusPayout(
  roster: readonly Player[],
  participation: ReadonlyMap<PlayerId, MatchdayParticipation>,
): { readonly total: number; readonly lines: readonly MatchdayBonusLine[] } {
  const lines: MatchdayBonusLine[] = [];
  let total = 0;
  for (const p of roster) {
    const part = participation.get(p.id);
    if (!part) continue;
    const amount = bonusPayout(p.contract, {
      matches: part.played ? 1 : 0,
      tries: part.tries,
      caps: 0,
    });
    if (amount <= 0) continue;
    total += amount;
    lines.push({ playerId: p.id, playerName: p.lastName, amount });
  }
  return { total, lines };
}

/**
 * Ce que le club doit prévoir : les primes d'un effectif entier sur une saison.
 *
 * Sert à la masse salariale prévisionnelle, là où un club prudent doit voir le
 * pire cas plutôt que la ligne du salaire garanti.
 */
export function projectedBonusCost(
  players: readonly Player[],
  expectedEarnings: (player: Player) => BonusEarnings,
): number {
  let total = 0;
  for (const p of players) {
    if (p.retired || p.freeAgent) continue;
    total += bonusPayout(p.contract, expectedEarnings(p));
  }
  return total;
}

// =============================================================================
// Ce que les primes valent au joueur
// =============================================================================

/**
 * Décote appliquée à une prime par rapport à un euro garanti.
 *
 * Un joueur prudent préfère de loin le salaire ; un ambitieux mise sur lui-même
 * et accepte l'échange à un taux presque équitable. La fourchette (0,45 à 0,85)
 * est resserrée à dessein : au-delà, charger les primes deviendrait une
 * martingale qui permettrait de signer tout le championnat sans masse salariale.
 */
export function bonusConfidence(player: Player): number {
  const ambition = player.hidden.ambition / 100;
  const nerve = player.mental.sangFroid / 100;
  return 0.45 + (ambition * 0.6 + nerve * 0.4) * 0.4;
}

/**
 * Ce que le joueur attend de jouer, de marquer et d'être sélectionné.
 *
 * On n'a pas le droit de lui donner ses vraies statistiques futures : il ne les
 * connaît pas. Il estime à partir de ce qu'il est aujourd'hui, et il se trompe
 * dans le sens de l'optimisme, comme tout le monde.
 */
export function expectedEarningsForPlayer(input: {
  readonly player: Player;
  /** Part des matchs qu'il pense disputer, 0 à 1. */
  readonly expectedPlayRatio: number;
  readonly roundsInSeason: number;
  /** Sélections déjà obtenues : un international en rejouera. */
  readonly capsLastSeason?: number;
}): BonusEarnings {
  const matches = Math.round(input.roundsInSeason * clamp01(input.expectedPlayRatio));
  // Un essai tous les cinq matchs pour un ailier, un tous les vingt pour un
  // pilier. Le taux vient des marqueurs du championnat mesurés en V0.58, pas
  // d'une intuition : la mesure disait 86 mètres par saison là où on en avait
  // supposé 1 400, et depuis on mesure.
  const tryRate = TRY_RATE_BY_ROLE[roleOf(input.player)];
  return {
    matches,
    tries: Math.round(matches * tryRate),
    caps: Math.min(6, input.capsLastSeason ?? 0),
  };
}

/**
 * La valeur qu'un joueur donne à l'ensemble d'un contrat, en euros de salaire
 * garanti.
 *
 * C'est le chiffre unique que la négociation compare à ses attentes. Tout ce
 * que le club ajoute au contrat passe par ici : c'est le seul endroit où la
 * question « combien vaut cette clause » reçoit une réponse, et donc le seul
 * endroit à corriger le jour où elle se révèle fausse.
 */
export function perceivedContractValue(input: {
  readonly player: Player;
  readonly contract: Contract;
  readonly earnings: BonusEarnings;
  /** Valeur marchande du joueur, pour juger la clause libératoire. */
  readonly marketValue: number;
}): number {
  const { player, contract, earnings, marketValue } = input;

  let value = averageSalary(contract);

  // Les primes, décotées par ce que le joueur croit en toucher.
  value += bonusPayout(contract, earnings) * bonusConfidence(player);

  // La prime à la signature est du garanti immédiat, mais elle ne se touche
  // qu'une fois : elle se répartit sur la durée.
  const years = Math.max(1, contract.endSeason - contract.startSeason + 1);
  value += (contract.signingBonus ?? 0) / years;

  // Une clause libératoire est une liberté qu'on lui accorde : plus elle est
  // basse par rapport à sa valeur, plus elle vaut cher à ses yeux. Au-dessus du
  // double de sa valeur, elle ne veut plus rien dire et ne rapporte rien.
  if (contract.releaseClause !== undefined && marketValue > 0) {
    const ratio = contract.releaseClause / marketValue;
    const freedom = Math.max(0, Math.min(1, (2 - ratio) / 1.4));
    value += averageSalary(contract) * freedom * 0.12;
  }

  // L'année en option penche du côté de celui qui la tient.
  if (contract.option) {
    const weight = contract.option.holder === 'JOUEUR' ? 0.08 : -0.07;
    value += averageSalary(contract) * weight;
  }

  return Math.round(value);
}

// =============================================================================
// La clause libératoire
// =============================================================================

/**
 * L'offre atteint-elle la clause ?
 *
 * Si oui, le club vendeur n'a plus voix au chapitre : c'est tout l'intérêt de la
 * clause, et c'est ce qui en fait une concession coûteuse au moment de signer.
 * Reste le joueur, qui garde la sienne.
 */
export function releaseClauseMet(contract: Contract, fee: number): boolean {
  return contract.releaseClause !== undefined && fee >= contract.releaseClause;
}

/**
 * La clause que le club acceptera d'écrire, en partant de la valeur du joueur.
 *
 * Jamais en dessous de sa valeur : un club qui brade son propre joueur par
 * contrat ne défend plus rien. Le multiplicateur est le levier de négociation.
 */
export function clampReleaseClause(marketValue: number, requested: number): number {
  const floor = Math.round(marketValue * 1.1);
  return Math.max(floor, Math.round(requested / 10_000) * 10_000);
}

// =============================================================================
// L'année en option et le pourcentage à la revente
// =============================================================================

/** Lève l'option : le contrat gagne ses années, au salaire convenu. */
export function exerciseOption(contract: Contract, season: number): Contract {
  if (!contract.option || contract.optionExercised) return contract;
  return {
    ...contract,
    endSeason: Math.max(contract.endSeason, season) + contract.option.years,
    annualSalary: contract.option.annualSalary,
    startSeason: Math.max(contract.startSeason, season),
    optionExercised: true,
  };
}

/** L'option est-elle encore décidable cette saison ? */
export function optionPending(contract: Contract, season: number): boolean {
  return contract.option !== undefined
    && !contract.optionExercised
    && contract.endSeason === season;
}

/** Ce que l'ancien club touche sur une revente. */
export function sellOnDue(contract: Contract, fee: number): number {
  if (!contract.sellOn) return 0;
  return Math.round(fee * Math.max(0, Math.min(MAX_SELL_ON, contract.sellOn.percent)));
}

// =============================================================================
// Helpers internes
// =============================================================================

type Role = 'AVANT' | 'CHARNIERE' | 'TROIS_QUARTS';

const TRY_RATE_BY_ROLE: Record<Role, number> = {
  AVANT: 0.06,
  CHARNIERE: 0.09,
  TROIS_QUARTS: 0.20,
};

function roleOf(player: Player): Role {
  switch (player.position) {
    case 'DEMI_DE_MELEE':
    case 'OUVREUR':
      return 'CHARNIERE';
    case 'CENTRE_INTERIEUR':
    case 'CENTRE_EXTERIEUR':
    case 'AILIER_GAUCHE':
    case 'AILIER_DROIT':
    case 'ARRIERE':
      return 'TROIS_QUARTS';
    default:
      return 'AVANT';
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
