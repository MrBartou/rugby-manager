/**
 * Les temps forts d'une rencontre — V0.57.
 *
 * Ce qui est testé : la sélection retient bien ce qui a décidé du match, elle
 * reste courte, elle raconte dans l'ordre, et — le point qui compte — elle
 * n'invente rien. Chaque temps fort est une phase réellement jouée, avec le
 * score tel qu'il était **après** elle.
 */

import { describe, expect, it } from 'vitest';
import {
  HIGHLIGHT_TARGET,
  highlightsIntro,
  selectHighlights,
} from '../../src/engine/match/highlights.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeSquad } from './fixtures.js';
import type { MatchInput, MatchResult, PhaseRecord } from '../../src/engine/match/types.js';
import type { ClubId, MatchId, Player, PlayerId } from '../../src/engine/types.js';

function buildInput(seed: string): MatchInput {
  const h = makeSquad(`h_${seed}` as ClubId, 74);
  const a = makeSquad(`a_${seed}` as ClubId, 62);
  const byId = new Map<PlayerId, Player>();
  for (const p of [...h.players, ...a.players]) byId.set(p.id, p);
  const plan = { occupation: 'MEDIANE', defensiveLine: 'RIDEAU', setPiecesFocus: ['NONE'] } as const;
  return {
    matchId: seed as MatchId,
    home: { squad: h.squad, tacticalPlan: plan, liveMoments: [] },
    away: { squad: a.squad, tacticalPlan: plan, liveMoments: [] },
    playersById: byId,
    weather: 'SEC',
    fieldCondition: 'BON',
    homeAdvantageBonus: 1,
    homeFans: 'BEAUCOUP',
  };
}

const RESULTS: readonly MatchResult[] = ['a', 'b', 'c', 'd', 'e'].map(
  s => simulateMatch(buildInput(s), `hl_${s}`),
);

describe('la sélection reste un condensé', () => {
  it('ne dépasse jamais la cible, sur aucun match', () => {
    for (const r of RESULTS) {
      expect(selectHighlights(r).length).toBeLessThanOrEqual(HIGHLIGHT_TARGET);
    }
  });

  it('trouve toujours quelque chose à montrer', () => {
    // Un match de rugby sans un seul moment saillant n'existe pas — si la
    // sélection revient vide, c'est le classement qui est cassé.
    for (const r of RESULTS) {
      expect(selectHighlights(r).length).toBeGreaterThan(0);
    }
  });

  it('raconte dans l\'ordre du match', () => {
    for (const r of RESULTS) {
      const h = selectHighlights(r);
      for (let i = 1; i < h.length; i++) {
        expect(h[i]!.phase.index).toBeGreaterThan(h[i - 1]!.phase.index);
      }
    }
  });
});

describe('elle n\'invente rien', () => {
  it('chaque temps fort est une phase réellement jouée', () => {
    for (const r of RESULTS) {
      const jouees = new Set<PhaseRecord>(r.phases);
      for (const h of selectHighlights(r)) {
        expect(jouees.has(h.phase)).toBe(true);
      }
    }
  });

  it('affiche le score d\'après la phase, pas celui d\'avant', () => {
    // C'est tout l'enjeu : un essai montré avec le score d'avant l'essai est
    // précisément le moment qu'on cherchait à faire voir, raté.
    for (const r of RESULTS) {
      for (const h of selectHighlights(r)) {
        if (h.phase.outcome.tryScored === 'HOME') {
          expect(h.homeScore).toBe(h.phase.state.homeScore + 5);
        }
        if (h.phase.outcome.tryScored === 'AWAY') {
          expect(h.awayScore).toBe(h.phase.state.awayScore + 5);
        }
      }
    }
  });

  it('le score final du dernier temps fort ne dépasse jamais le score du match', () => {
    for (const r of RESULTS) {
      for (const h of selectHighlights(r)) {
        expect(h.homeScore).toBeLessThanOrEqual(r.homeScore);
        expect(h.awayScore).toBeLessThanOrEqual(r.awayScore);
      }
    }
  });
});

describe('elle retient d\'abord ce qui compte', () => {
  it('un essai passe toujours avant une bascule d\'élan', () => {
    for (const r of RESULTS) {
      const essaisJoues = r.phases.filter(p => p.outcome.tryScored).length;
      const essaisRetenus = selectHighlights(r).filter(h => h.kind === 'ESSAI').length;
      // Tant qu'il reste de la place, aucun essai n'est écarté.
      if (essaisJoues <= HIGHLIGHT_TARGET) {
        expect(essaisRetenus).toBe(essaisJoues);
      }
    }
  });

  it('annonce ce qu\'on va voir sans raconter le match', () => {
    const h = selectHighlights(RESULTS[0]!);
    const texte = highlightsIntro(h);
    expect(texte.length).toBeGreaterThan(0);
    // Pas de score dans l'annonce : le condensé garde sa surprise.
    expect(texte).not.toMatch(/\d+\s*[–-]\s*\d+/);
  });

  it('se tait poliment quand il n\'y a rien', () => {
    expect(highlightsIntro([])).toContain('Rien à retenir');
  });
});
