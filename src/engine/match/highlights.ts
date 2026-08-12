/**
 * Les temps forts d'une rencontre — V0.57.
 *
 * Un match qu'on ne joue pas soi-même — une journée simulée, la rencontre d'un
 * rival — ne laissait qu'un tableau de phases. Quatre-vingts lignes de journal
 * pour dire ce qu'une minute d'images raconte mieux.
 *
 * Ce module ne résume pas le match : il **choisit** les phases qui l'ont
 * décidé. La nuance compte, parce qu'un résumé invente et qu'une sélection non.
 * Chaque temps fort retenu est une phase réellement jouée, avec sa minute, son
 * score et ses acteurs — on se contente d'écarter les soixante-dix autres.
 *
 * ## Ce qui fait un temps fort
 *
 * Par ordre d'évidence : un essai, un carton, des points au pied, un
 * franchissement, un ballon volé. Puis, si la sélection reste courte, les
 * bascules d'élan — le moment où le match a changé de camp sans que rien de
 * spectaculaire ne se produise. C'est souvent là que tout s'est joué, et c'est
 * exactement ce qu'un tableau de phases ne montre jamais.
 */

import type { MatchResult, PhaseRecord } from './types.js';

/** Nombre de temps forts visés. Au-delà, ce n'est plus un condensé. */
export const HIGHLIGHT_TARGET = 8;

export type HighlightKind =
  | 'ESSAI' | 'CARTON' | 'AU_PIED' | 'FRANCHISSEMENT' | 'TURNOVER' | 'BASCULE';

export interface Highlight {
  readonly phase: PhaseRecord;
  readonly kind: HighlightKind;
  /** Ce qu'on affiche sous le terrain pendant la séquence. */
  readonly caption: string;
  readonly minute: number;
  readonly homeScore: number;
  readonly awayScore: number;
}

const WEIGHT: Readonly<Record<HighlightKind, number>> = {
  ESSAI: 100,
  CARTON: 80,
  AU_PIED: 60,
  FRANCHISSEMENT: 40,
  TURNOVER: 25,
  BASCULE: 15,
};

/**
 * Le score après la phase.
 *
 * `state` est un instantané pris **avant** la phase : lire le score là donnerait
 * un essai affiché avec le score d'avant l'essai, ce qui est précisément le
 * moment qu'on veut montrer.
 */
function scoreAfter(phase: PhaseRecord): { home: number; away: number } {
  const s = phase.state;
  const pts = phase.outcome.pointsScored;
  const tryPoints = phase.outcome.tryScored ? 5 : 0;
  const home = s.homeScore
    + (phase.outcome.tryScored === 'HOME' ? tryPoints : 0)
    + (pts?.team === 'HOME' ? pts.value : 0);
  const away = s.awayScore
    + (phase.outcome.tryScored === 'AWAY' ? tryPoints : 0)
    + (pts?.team === 'AWAY' ? pts.value : 0);
  return { home, away };
}

function classify(phase: PhaseRecord, previous: PhaseRecord | undefined): {
  kind: HighlightKind;
  caption: string;
} | undefined {
  const o = phase.outcome;

  if (o.tryScored) return { kind: 'ESSAI', caption: o.summary };
  if (o.cardIssued) {
    return {
      kind: 'CARTON',
      caption: o.cardIssued.color === 'RED' ? 'Carton rouge' : 'Carton jaune',
    };
  }
  if (o.pointsScored) return { kind: 'AU_PIED', caption: o.summary };

  for (const c of o.contributions ?? []) {
    if ((c.lineBreaks ?? 0) > 0) return { kind: 'FRANCHISSEMENT', caption: o.summary };
  }
  for (const c of o.contributions ?? []) {
    if ((c.turnoversWon ?? 0) > 0) return { kind: 'TURNOVER', caption: o.summary };
  }

  // Bascule d'élan : le match change de camp. On exige un franchissement net du
  // milieu, sans quoi la moindre oscillation deviendrait un temps fort.
  if (previous) {
    const before = previous.state.homeMomentum;
    const after = phase.state.homeMomentum;
    const crossed = (before <= 0 && after > 0) || (before >= 0 && after < 0);
    if (crossed && Math.abs(after - before) >= 18) {
      return { kind: 'BASCULE', caption: o.summary };
    }
  }
  return undefined;
}

/**
 * Les temps forts, dans l'ordre du match.
 *
 * On classe par importance pour ne garder que les meilleurs, puis on remet en
 * ordre chronologique : un condensé qui commence par la fin ne raconte rien.
 */
export function selectHighlights(
  result: MatchResult,
  target = HIGHLIGHT_TARGET,
): readonly Highlight[] {
  const candidates: Highlight[] = [];

  for (let i = 0; i < result.phases.length; i++) {
    const phase = result.phases[i]!;
    const found = classify(phase, result.phases[i - 1]);
    if (!found) continue;
    const score = scoreAfter(phase);
    candidates.push({
      phase,
      kind: found.kind,
      caption: found.caption,
      minute: phase.state.minute,
      homeScore: score.home,
      awayScore: score.away,
    });
  }

  // Les essais et les cartons passent devant, quel que soit leur nombre : un
  // match à six essais se raconte par ses six essais.
  const ranked = [...candidates].sort((a, b) => {
    const w = WEIGHT[b.kind] - WEIGHT[a.kind];
    return w !== 0 ? w : a.minute - b.minute;
  });

  return ranked.slice(0, target).sort((a, b) => a.phase.index - b.phase.index);
}

/**
 * Ce qu'on annonce avant de lancer la séquence.
 *
 * Dit ce qu'on va voir sans le raconter : le condensé doit garder sa surprise,
 * même quand le score est déjà connu.
 */
export function highlightsIntro(highlights: readonly Highlight[]): string {
  if (highlights.length === 0) return 'Rien à retenir de cette rencontre.';
  const essais = highlights.filter(h => h.kind === 'ESSAI').length;
  const cartons = highlights.filter(h => h.kind === 'CARTON').length;
  const parts: string[] = [];
  if (essais > 0) parts.push(`${essais} essai${essais > 1 ? 's' : ''}`);
  if (cartons > 0) parts.push(`${cartons} carton${cartons > 1 ? 's' : ''}`);
  if (parts.length === 0) return `${highlights.length} moments à retenir.`;
  return `${parts.join(', ')} — ${highlights.length} moments à revoir.`;
}
