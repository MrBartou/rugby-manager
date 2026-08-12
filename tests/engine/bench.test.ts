/**
 * Tests du banc actif — V0.13.
 *
 * Couvre : fatigue individuelle, règles de remplacement (quota, retour interdit,
 * couverture de poste, première ligne spécialiste), politique automatique,
 * mêlées simulées, et l'effet mesurable du banc sur la fin de match.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_SUBSTITUTIONS,
  accrueFatigue,
  applySubstitution,
  bestCoverFor,
  canCover,
  createSquadRuntime,
  groupOf,
  hasFrontRowCover,
  mostFatiguedOnField,
  onFieldPack,
  packFatigue,
  planAutoSubstitution,
  playerFatigue,
  recoverBench,
  refreshScrumSafety,
  squadFatigue,
  type SquadRuntime,
} from '../../src/engine/match/bench.js';
import { createMatchSession } from '../../src/engine/match/session.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeMatchInput, makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId } from '../../src/engine/types.js';

// =============================================================================
// Helpers
// =============================================================================

function buildRuntime(niveau = 60): { sq: SquadRuntime; players: Player[] } {
  const { squad, players } = makeSquad('club_home' as ClubId, niveau);
  const byId = new Map<PlayerId, Player>(players.map(p => [p.id, p]));
  const kicker = byId.get(squad.starters.find(s => s.position === 'OUVREUR')!.playerId)!;
  const sq = createSquadRuntime(squad.starters, squad.substitutes, byId, kicker, 0);
  return { sq, players };
}

function playFullMatch(input: ReturnType<typeof makeMatchInput>, seed: string) {
  const session = createMatchSession(input, seed);
  let guard = 0;
  while (guard++ < 1000) {
    const state = session.getState();
    if (state.status === 'finished') break;
    if (state.status === 'awaiting-decision' && state.pendingMoment) {
      session.applyDecision(state.pendingMoment.defaultOptionId);
    } else {
      session.advance();
    }
  }
  return session;
}

// =============================================================================
// Groupes de postes
// =============================================================================

describe('groupes de postes', () => {
  it('classe correctement la première ligne', () => {
    expect(groupOf('PILIER_GAUCHE')).toBe('FRONT_ROW');
    expect(groupOf('TALONNEUR')).toBe('FRONT_ROW');
    expect(groupOf('PILIER_DROIT')).toBe('FRONT_ROW');
  });

  it('la première ligne n\'accepte que des spécialistes', () => {
    const { players } = buildRuntime();
    const troisiemeLigne = players.find(p => p.position === 'NUMERO_8')!;
    const pilier = players.find(p => p.position === 'PILIER_GAUCHE')!;

    expect(canCover(troisiemeLigne, 'PILIER_GAUCHE')).toBe(false);
    expect(canCover(pilier, 'PILIER_DROIT')).toBe(true);
  });

  it('autorise les dépannages usuels (3e ligne ↔ 2e ligne, centre → aile)', () => {
    const { players } = buildRuntime();
    const n8 = players.find(p => p.position === 'NUMERO_8')!;
    const centre = players.find(p => p.position === 'CENTRE_INTERIEUR')!;

    expect(canCover(n8, 'DEUXIEME_LIGNE_GAUCHE')).toBe(true);
    expect(canCover(centre, 'AILIER_GAUCHE')).toBe(true);
    expect(canCover(centre, 'DEMI_DE_MELEE')).toBe(false);
  });
});

// =============================================================================
// Fatigue individuelle
// =============================================================================

describe('fatigue individuelle', () => {
  it('les avants fatiguent plus que les arrières en mêlée', () => {
    const { sq } = buildRuntime();
    for (let i = 0; i < 10; i++) accrueFatigue(sq, 'SCRUM', 2.5);

    const pack = onFieldPack(sq);
    const pilier = pack.find(p => p.position === 'PILIER_GAUCHE')!;
    const ailier = sq.slots.find(s => s.position === 'AILIER_GAUCHE')!.player;

    expect(playerFatigue(sq, pilier.id)).toBeGreaterThan(playerFatigue(sq, ailier.id));
  });

  it('les arrières fatiguent plus que les avants en jeu courant', () => {
    const { sq } = buildRuntime();
    for (let i = 0; i < 20; i++) accrueFatigue(sq, 'OPEN_PLAY', 1.5);

    const pilier = sq.slots.find(s => s.position === 'PILIER_GAUCHE')!.player;
    const ailier = sq.slots.find(s => s.position === 'AILIER_GAUCHE')!.player;

    expect(playerFatigue(sq, ailier.id)).toBeGreaterThan(playerFatigue(sq, pilier.id));
  });

  it('la fatigue est bornée à 100', () => {
    const { sq } = buildRuntime();
    for (let i = 0; i < 500; i++) accrueFatigue(sq, 'SCRUM', 5);
    for (const slot of sq.slots) {
      expect(playerFatigue(sq, slot.player.id)).toBeLessThanOrEqual(100);
    }
  });

  it('les remplaçants récupèrent sur le banc sans passer sous zéro', () => {
    const { sq } = buildRuntime();
    const benchPlayer = sq.bench[0]!.player;
    sq.fatigueByPlayer.set(benchPlayer.id, 20);

    recoverBench(sq, 1.5);
    expect(playerFatigue(sq, benchPlayer.id)).toBeLessThan(20);

    for (let i = 0; i < 200; i++) recoverBench(sq, 1.5);
    expect(playerFatigue(sq, benchPlayer.id)).toBe(0);
  });

  it('la fatigue pack et la fatigue globale divergent après des mêlées', () => {
    const { sq } = buildRuntime();
    for (let i = 0; i < 10; i++) accrueFatigue(sq, 'SCRUM', 2.5);
    expect(packFatigue(sq)).toBeGreaterThan(squadFatigue(sq));
  });

  it('mostFatiguedOnField désigne bien le joueur le plus émoussé', () => {
    const { sq } = buildRuntime();
    const target = sq.slots[3]!.player;
    sq.fatigueByPlayer.set(target.id, 95);
    expect(mostFatiguedOnField(sq)?.player.id).toBe(target.id);
  });
});

// =============================================================================
// Règles de remplacement
// =============================================================================

describe('règles de remplacement', () => {
  it('un remplacement fait entrer le joueur et sortir le titulaire', () => {
    const { sq } = buildRuntime();
    const out = sq.slots.find(s => s.position === 'TALONNEUR')!.player;
    const incoming = sq.bench.find(b => b.player.position === 'TALONNEUR')!.player;

    const res = applySubstitution(sq, {
      offPlayerId: out.id, onPlayerId: incoming.id, minute: 55, reason: 'FATIGUE',
    });

    expect(res.ok).toBe(true);
    expect(sq.slots.some(s => s.player.id === incoming.id)).toBe(true);
    expect(sq.slots.some(s => s.player.id === out.id)).toBe(false);
    expect(sq.bench.some(b => b.player.id === incoming.id)).toBe(false);
  });

  it('interdit le retour d\'un joueur déjà sorti', () => {
    const { sq } = buildRuntime();
    const out = sq.slots.find(s => s.position === 'TALONNEUR')!.player;
    const incoming = sq.bench.find(b => b.player.position === 'TALONNEUR')!.player;

    applySubstitution(sq, { offPlayerId: out.id, onPlayerId: incoming.id, minute: 55, reason: 'FATIGUE' });
    const retour = applySubstitution(sq, {
      offPlayerId: incoming.id, onPlayerId: out.id, minute: 70, reason: 'FATIGUE',
    });

    expect(retour.ok).toBe(false);
  });

  it('refuse un entrant qui ne couvre pas le poste', () => {
    const { sq } = buildRuntime();
    const pilier = sq.slots.find(s => s.position === 'PILIER_GAUCHE')!.player;
    const ouvreurBanc = sq.bench.find(b => b.player.position === 'OUVREUR')!.player;

    const res = applySubstitution(sq, {
      offPlayerId: pilier.id, onPlayerId: ouvreurBanc.id, minute: 55, reason: 'FATIGUE',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('couvre pas');
  });

  it('plafonne à 8 remplacements', () => {
    const { sq } = buildRuntime();
    let done = 0;
    for (let minute = 45; minute < 80 && sq.bench.length > 0; minute++) {
      const plan = planAutoSubstitution(sq, minute);
      if (!plan) {
        // On force de la fatigue pour rendre d'autres remplacements pertinents.
        for (const slot of sq.slots) sq.fatigueByPlayer.set(slot.player.id, 95);
        continue;
      }
      if (applySubstitution(sq, plan).ok) done++;
    }
    expect(done).toBeLessThanOrEqual(MAX_SUBSTITUTIONS);
    expect(sq.substitutions.length).toBeLessThanOrEqual(MAX_SUBSTITUTIONS);
  });

  it('réaffecte le buteur si le buteur sort', () => {
    const { sq } = buildRuntime();
    const kickerBefore = sq.kicker;
    const slot = sq.slots.find(s => s.player.id === kickerBefore.id)!;
    const cover = bestCoverFor(sq, slot.position)!;

    applySubstitution(sq, {
      offPlayerId: kickerBefore.id, onPlayerId: cover.id, minute: 60, reason: 'MANAGER',
    });

    expect(sq.kicker.id).not.toBe(kickerBefore.id);
    expect(sq.slots.some(s => s.player.id === sq.kicker.id)).toBe(true);
  });
});

// =============================================================================
// Première ligne / mêlées simulées
// =============================================================================

describe('première ligne', () => {
  it('le banc de référence couvre bien la première ligne', () => {
    const { sq } = buildRuntime();
    expect(hasFrontRowCover(sq)).toBe(true);
  });

  it('bascule en mêlées simulées s\'il reste moins de 3 premières lignes', () => {
    const { sq } = buildRuntime();
    expect(sq.uncontestedScrums).toBe(false);

    // On retire un pilier du terrain sans le remplacer (blessure sans doublure).
    const idx = sq.slots.findIndex(s => s.position === 'PILIER_DROIT');
    sq.slots.splice(idx, 1);
    refreshScrumSafety(sq);

    expect(sq.uncontestedScrums).toBe(true);
  });
});

// =============================================================================
// Politique automatique
// =============================================================================

describe('politique automatique de remplacement', () => {
  it('ne remplace personne avant la 45e minute', () => {
    const { sq } = buildRuntime();
    for (const slot of sq.slots) sq.fatigueByPlayer.set(slot.player.id, 99);
    expect(planAutoSubstitution(sq, 30)).toBeUndefined();
    expect(planAutoSubstitution(sq, 44)).toBeUndefined();
    expect(planAutoSubstitution(sq, 50)).toBeDefined();
  });

  it('est déterministe : deux appels identiques donnent le même plan', () => {
    const a = buildRuntime().sq;
    const b = buildRuntime().sq;
    for (const sq of [a, b]) {
      for (const slot of sq.slots) sq.fatigueByPlayer.set(slot.player.id, 85);
    }
    expect(planAutoSubstitution(a, 60)).toEqual(planAutoSubstitution(b, 60));
  });

  it('ne remplace pas un joueur frais', () => {
    const { sq } = buildRuntime();
    for (const slot of sq.slots) sq.fatigueByPlayer.set(slot.player.id, 10);
    expect(planAutoSubstitution(sq, 70)).toBeUndefined();
  });
});

// =============================================================================
// Intégration dans le match
// =============================================================================

describe('banc en situation de match', () => {
  it('un match complet consomme le banc et reste déterministe', () => {
    const input = makeMatchInput({ homeNiveau: 62, awayNiveau: 58 });
    const a = simulateMatch(input, 'seed_bench');
    const b = simulateMatch(input, 'seed_bench');

    expect(a.homeSubstitutions.length).toBeGreaterThan(0);
    expect(a.homeSubstitutions).toEqual(b.homeSubstitutions);
    expect(a.homeScore).toBe(b.homeScore);
  });

  it('les remplacements ont lieu en seconde période', () => {
    const input = makeMatchInput({ homeNiveau: 62, awayNiveau: 58 });
    const result = simulateMatch(input, 'seed_minutes');
    for (const sub of result.homeSubstitutions) {
      expect(sub.minute).toBeGreaterThanOrEqual(45);
      expect(sub.minute).toBeLessThanOrEqual(80);
    }
  });

  it('un joueur remplacé a moins de 80 minutes au compteur', () => {
    const input = makeMatchInput({ homeNiveau: 62, awayNiveau: 58 });
    const result = simulateMatch(input, 'seed_minutes');
    const firstSub = result.homeSubstitutions[0]!;

    expect(result.individualStats.get(firstSub.offPlayerId)!.minutesPlayed).toBeLessThan(80);
    expect(result.individualStats.get(firstSub.onPlayerId)!.minutesPlayed).toBeGreaterThan(0);
    expect(result.individualStats.get(firstSub.onPlayerId)!.minutesPlayed).toBeLessThan(80);
  });

  it('le banc réduit nettement la fatigue de fin de match', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const noBench = {
      ...input,
      home: { ...input.home, squad: { ...input.home.squad, substitutes: [] } },
      away: { ...input.away, squad: { ...input.away.squad, substitutes: [] } },
    };

    const withBench = playFullMatch(input, 'seed_fatigue').getState();
    const without = playFullMatch(noBench, 'seed_fatigue').getState();

    expect(without.homeFatigue).toBeGreaterThan(withBench.homeFatigue + 15);
  });

  it('sans banc, aucun remplacement et pas de crash', () => {
    const input = makeMatchInput({ homeNiveau: 60, awayNiveau: 60 });
    const noBench = {
      ...input,
      home: { ...input.home, squad: { ...input.home.squad, substitutes: [] } },
      away: { ...input.away, squad: { ...input.away.squad, substitutes: [] } },
    };
    const result = simulateMatch(noBench, 'seed_nobench');
    expect(result.homeSubstitutions).toHaveLength(0);
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
  });
});
