/**
 * Génération de récit narratif post-match — V0.5.
 *
 * Référence : 13-gestion-projet.md V0.5 (narratif amélioré).
 *
 * Produit un texte multi-paragraphes en exploitant les phases du match :
 *   - Intro (équipes, contexte serré ou démo)
 *   - 1re mi-temps (essais, dominance set-pieces, moments forts)
 *   - 2e mi-temps (retour, événements clés)
 *   - Conclusion (résultat, performances individuelles, décisions)
 */

import type { Club, Player, PlayerId } from '../types.js';
import type {
  IndividualMatchStats,
  PhaseRecord,
} from './types.js';

interface NarrativeInputs {
  readonly phases: readonly PhaseRecord[];
  readonly homeScore: number;
  readonly awayScore: number;
  readonly homeClub?: Club;
  readonly awayClub?: Club;
  readonly playersById: ReadonlyMap<PlayerId, Player>;
  readonly individualStats: ReadonlyMap<PlayerId, IndividualMatchStats>;
}

interface ParaPart {
  readonly tag: string;        // ex : "Ouverture", "1re mi-temps"
  readonly text: string;
}

function teamName(club: Club | undefined, fallback: string): string {
  return club?.name ?? fallback;
}

function teamShort(club: Club | undefined, fallback: string): string {
  return club?.shortName ?? fallback;
}

function findStarTrio(stats: ReadonlyMap<PlayerId, IndividualMatchStats>, playersById: ReadonlyMap<PlayerId, Player>) {
  // Top 3 essayeurs + meilleur buteur + grand artisan (plaquages V0.5+ — pour V0.5 c'est essais/buts)
  const tries: { player: Player; tries: number }[] = [];
  const kickers: { player: Player; made: number; attempts: number }[] = [];
  for (const [pid, s] of stats) {
    const p = playersById.get(pid);
    if (!p) continue;
    if (s.tries > 0) tries.push({ player: p, tries: s.tries });
    if (s.placeKicks.attempted > 0) {
      kickers.push({ player: p, made: s.placeKicks.made, attempts: s.placeKicks.attempted });
    }
  }
  tries.sort((a, b) => b.tries - a.tries);
  kickers.sort((a, b) => b.made - a.made);
  return { tries, kickers };
}

function describeTry(phase: PhaseRecord, playersById: ReadonlyMap<PlayerId, Player>): string {
  const scorerId = phase.outcome.keyPlayerId;
  const scorer = scorerId ? playersById.get(scorerId) : undefined;
  const minute = phase.state.minute;
  const team = phase.outcome.tryScored;
  if (scorer) {
    return `${minute}' essai de ${scorer.firstName} ${scorer.lastName} (${team})`;
  }
  return `${minute}' essai pour ${team}`;
}

function describeOpening(home: string, away: string, homeScore: number, awayScore: number, totalTries: number): ParaPart {
  const diff = homeScore - awayScore;
  let opener: string;
  if (diff === 0) {
    opener = `Match nul ${homeScore}-${awayScore} entre ${home} et ${away}.`;
  } else if (Math.abs(diff) >= 21) {
    const winner = diff > 0 ? home : away;
    const loser = diff > 0 ? away : home;
    opener = `${winner} a écrasé ${loser} ${homeScore}-${awayScore} sans laisser le moindre suspense.`;
  } else if (Math.abs(diff) >= 10) {
    const winner = diff > 0 ? home : away;
    opener = `${winner} s'impose ${homeScore}-${awayScore} de manière maîtrisée.`;
  } else {
    const winner = diff > 0 ? home : away;
    opener = `Victoire serrée de ${winner} ${homeScore}-${awayScore} dans un match accroché jusqu'au bout.`;
  }
  let tryCount = '';
  if (totalTries === 0) {
    tryCount = ' Pas un seul essai inscrit, signe d\'un match verrouillé.';
  } else if (totalTries >= 8) {
    tryCount = ` Festival offensif avec ${totalTries} essais cumulés.`;
  } else if (totalTries >= 6) {
    tryCount = ` ${totalTries} essais au total, du beau rugby.`;
  } else {
    tryCount = ` ${totalTries} essai${totalTries > 1 ? 's' : ''} dans la partie.`;
  }
  return { tag: 'Match', text: opener + tryCount };
}

function describeFirstHalf(
  inputs: NarrativeInputs,
  homeName: string,
  awayName: string,
): ParaPart {
  const halfPhases = inputs.phases.filter(p => p.state.minute < 40);
  const homeTries = halfPhases.filter(p => p.outcome.tryScored === 'HOME').length;
  const awayTries = halfPhases.filter(p => p.outcome.tryScored === 'AWAY').length;
  const lastFirstHalf = halfPhases[halfPhases.length - 1];
  const halfScore = lastFirstHalf
    ? `${lastFirstHalf.state.homeScore + (lastFirstHalf.outcome.tryScored === 'HOME' ? 5 : 0) + (lastFirstHalf.outcome.pointsScored?.team === 'HOME' ? lastFirstHalf.outcome.pointsScored.value : 0)}-${lastFirstHalf.state.awayScore + (lastFirstHalf.outcome.tryScored === 'AWAY' ? 5 : 0) + (lastFirstHalf.outcome.pointsScored?.team === 'AWAY' ? lastFirstHalf.outcome.pointsScored.value : 0)}`
    : '0-0';

  const lines: string[] = [];
  if (homeTries === 0 && awayTries === 0) {
    lines.push(`Première mi-temps verrouillée, score à la pause : ${halfScore}.`);
  } else {
    lines.push(`À la pause : ${halfScore}.`);
    const tries = halfPhases.filter(p => p.outcome.tryScored).slice(0, 3);
    for (const t of tries) {
      lines.push(describeTry(t, inputs.playersById) + '.');
    }
  }
  // Mêlée dominante
  const scrumPhases = halfPhases.filter(p => p.type === 'SCRUM');
  const dominatedScrums = scrumPhases.filter(p => p.outcome.summary.includes('dominée') || p.outcome.summary.includes('gros push'));
  if (dominatedScrums.length >= 2) {
    const dominant = dominatedScrums[0]?.state.possession === 'HOME' ? homeName : awayName;
    lines.push(`Le pack de ${dominant} a fait la loi en mêlée.`);
  }
  // V0.9 — touche : maul pénétrant détecté
  const mauls = halfPhases.filter(p => p.outcome.summary.includes('maul pénétrant'));
  if (mauls.length >= 2) {
    const dominant = mauls[0]?.outcome.possessionAfter === 'HOME' ? homeName : awayName;
    lines.push(`${dominant} a fait mal au maul pénétrant.`);
  }
  return { tag: '1re mi-temps', text: lines.join(' ') };
}

function describeSecondHalf(
  inputs: NarrativeInputs,
  homeName: string,
  awayName: string,
): ParaPart {
  const halfPhases = inputs.phases.filter(p => p.state.minute >= 40);
  const tries = halfPhases.filter(p => p.outcome.tryScored).slice(0, 4);
  const lines: string[] = [];

  if (tries.length === 0) {
    lines.push('Seconde période sans essai, gestion et défense des deux côtés.');
  } else {
    lines.push('Le match s\'est animé en seconde période.');
    for (const t of tries) {
      lines.push(describeTry(t, inputs.playersById) + '.');
    }
  }
  // Tournant
  const turnover = halfPhases.find(p => p.outcome.summary.includes('turnover'));
  if (turnover && halfPhases.length > 30) {
    const team = turnover.outcome.possessionAfter === 'HOME' ? homeName : awayName;
    lines.push(`Un turnover crucial pour ${team} a fait basculer la dynamique.`);
  }
  return { tag: '2e mi-temps', text: lines.join(' ') };
}

function describePerformances(inputs: NarrativeInputs): ParaPart {
  const { tries, kickers } = findStarTrio(inputs.individualStats, inputs.playersById);
  const lines: string[] = [];
  if (tries.length > 0) {
    const top = tries[0]!;
    if (top.tries >= 2) {
      lines.push(`${top.player.firstName} ${top.player.lastName} a inscrit ${top.tries} essais — homme du match probable.`);
    } else {
      const others = tries.slice(0, 3).map(t => `${t.player.lastName} (${t.tries})`).join(', ');
      lines.push(`Marqueurs : ${others}.`);
    }
  }
  if (kickers.length > 0) {
    const k = kickers[0]!;
    const pct = k.attempts > 0 ? Math.round((k.made / k.attempts) * 100) : 0;
    if (k.attempts >= 4) {
      lines.push(`${k.player.lastName} ${k.made}/${k.attempts} au pied (${pct}%).`);
    }
  }
  // Traits saillants
  const tryScorers = tries.slice(0, 3);
  for (const ts of tryScorers) {
    const traits = ts.player.traits as readonly string[];
    if (traits.includes('killer_instinct') && ts.tries >= 1) {
      lines.push(`L'instinct de tueur de ${ts.player.lastName} a parlé.`);
      break;
    }
    if (traits.includes('creatif') && ts.tries >= 1) {
      lines.push(`La créativité de ${ts.player.lastName} a fait la différence.`);
      break;
    }
  }
  // V0.9 — cartons et discipline
  let yellow = 0, red = 0;
  let firstRedPlayer: string | undefined;
  for (const phase of inputs.phases) {
    const card = phase.outcome.cardIssued;
    if (!card) continue;
    if (card.color === 'YELLOW') yellow++;
    else if (card.color === 'RED') {
      red++;
      if (!firstRedPlayer) {
        const p = inputs.playersById.get(card.playerId);
        firstRedPlayer = p ? `${p.firstName} ${p.lastName}` : undefined;
      }
    }
  }
  if (red > 0) {
    lines.push(`Carton rouge${firstRedPlayer ? ` pour ${firstRedPlayer}` : ''} : un tournant disciplinaire majeur.`);
  } else if (yellow > 0) {
    lines.push(`${yellow} carton${yellow > 1 ? 's' : ''} jaune${yellow > 1 ? 's' : ''} de chaque côté de l'arbitrage.`);
  }

  // V0.13 — les duels individuels produisent désormais de vraies statistiques
  // (mètres, défenseurs battus, plaquages, grattages) : on en tire des faits de
  // match plutôt que des formules génériques.
  for (const line of describeIndividualFeats(inputs)) lines.push(line);

  return { tag: 'Performances', text: lines.join(' ') };
}

/**
 * V0.13 — faits saillants tirés des statistiques individuelles.
 *
 * Chaque phrase est adossée à un chiffre réellement produit par le moteur : c'est
 * ce qui distingue un récit d'un gabarit.
 */
function describeIndividualFeats(inputs: NarrativeInputs): string[] {
  const out: string[] = [];

  let bestCarrier: { player: Player; meters: number; beaten: number } | undefined;
  let bestTackler: { player: Player; tackles: number } | undefined;
  let bestPoacher: { player: Player; turnovers: number } | undefined;
  let bestBreaker: { player: Player; breaks: number } | undefined;

  for (const [pid, stats] of inputs.individualStats) {
    const player = inputs.playersById.get(pid);
    if (!player) continue;

    if (stats.metersWithBall > 0 && (!bestCarrier || stats.metersWithBall > bestCarrier.meters)) {
      bestCarrier = { player, meters: stats.metersWithBall, beaten: stats.defendersBeaten };
    }
    if (stats.tackles > 0 && (!bestTackler || stats.tackles > bestTackler.tackles)) {
      bestTackler = { player, tackles: stats.tackles };
    }
    if (stats.turnoversWon > 0 && (!bestPoacher || stats.turnoversWon > bestPoacher.turnovers)) {
      bestPoacher = { player, turnovers: stats.turnoversWon };
    }
    if (stats.lineBreaks > 0 && (!bestBreaker || stats.lineBreaks > bestBreaker.breaks)) {
      bestBreaker = { player, breaks: stats.lineBreaks };
    }
  }

  if (bestCarrier && bestCarrier.meters >= 15) {
    const beaten = bestCarrier.beaten >= 2
      ? `, ${bestCarrier.beaten} défenseurs battus`
      : '';
    out.push(
      `${bestCarrier.player.firstName} ${bestCarrier.player.lastName} a été le meilleur porteur de balle (${bestCarrier.meters} m${beaten}).`,
    );
  }
  if (bestBreaker && bestBreaker.breaks >= 2) {
    out.push(`${bestBreaker.player.lastName} a franchi le rideau à ${bestBreaker.breaks} reprises.`);
  }
  if (bestTackler && bestTackler.tackles >= 5) {
    out.push(`Abattage défensif de ${bestTackler.player.lastName} : ${bestTackler.tackles} plaquages.`);
  }
  if (bestPoacher && bestPoacher.turnovers >= 2) {
    out.push(`${bestPoacher.player.lastName} a gratté ${bestPoacher.turnovers} ballons décisifs.`);
  }

  return out;
}

// =============================================================================
// Entrée publique
// =============================================================================

export function buildRichNarrative(inputs: NarrativeInputs): {
  readonly headline: string;
  readonly paragraphs: readonly ParaPart[];
} {
  const homeName = teamName(inputs.homeClub, 'Domicile');
  const awayName = teamName(inputs.awayClub, 'Extérieur');
  const homeShort = teamShort(inputs.homeClub, 'HOME');
  const awayShort = teamShort(inputs.awayClub, 'AWAY');
  const totalTries = inputs.phases.filter(p => p.outcome.tryScored).length;

  // Headline = score final
  const winner = inputs.homeScore > inputs.awayScore ? homeName : inputs.awayScore > inputs.homeScore ? awayName : null;
  const headline = winner
    ? `${homeShort} ${inputs.homeScore} — ${inputs.awayScore} ${awayShort} (${winner} l'emporte)`
    : `${homeShort} ${inputs.homeScore} — ${inputs.awayScore} ${awayShort} (match nul)`;

  const paragraphs: ParaPart[] = [
    describeOpening(homeName, awayName, inputs.homeScore, inputs.awayScore, totalTries),
    describeFirstHalf(inputs, homeName, awayName),
    describeSecondHalf(inputs, homeName, awayName),
    describePerformances(inputs),
  ].filter(p => p.text.trim().length > 0);

  return { headline, paragraphs };
}
