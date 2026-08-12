/**
 * Tests du scouting — V0.15.
 *
 * L'enjeu : faire du recrutement un pari informé plutôt qu'une lecture de tableau.
 * Deux propriétés sont critiques — l'estimation doit **converger** vers la vérité
 * quand la connaissance monte, et rester **stable** entre deux affichages.
 */

import { describe, expect, it } from 'vitest';
import {
  CERTAINTY_LABEL,
  CLUB_MISSION_COST,
  EMPTY_SCOUTING,
  MAX_FAMILIARITY,
  OWN_SQUAD_BASE_FAMILIARITY,
  advanceScouting,
  assignClubScout,
  assignScout,
  certaintyFor,
  currentAbility,
  estimateAttribute,
  estimatePotential,
  familiarityFromOwnSquad,
  familiarityFromScoutingRound,
  knowledgeOf,
  scoutingSlots,
  unassignClubScout,
  unassignScout,
  upsideLabel,
  usedSlots,
  type ScoutingState,
} from '../../src/engine/club/scouting.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId } from '../../src/engine/types.js';

function player(overrides: Partial<Player> = {}): Player {
  const { players } = makeSquad('club_home' as ClubId, 60);
  return { ...players.find(p => p.position === 'CENTRE_INTERIEUR')!, ...overrides };
}

// =============================================================================
// Estimation d'attribut
// =============================================================================

describe('estimation d\'un attribut', () => {
  it('ne révèle rien à familiarité nulle', () => {
    const e = estimateAttribute(78, 0, 'x');
    expect(e.certainty).toBe('INCONNU');
    expect(e.display).toBe('?');
  });

  it('donne la valeur exacte à familiarité maximale', () => {
    const e = estimateAttribute(78, 100, 'x');
    expect(e.display).toBe('78');
    expect(e.min).toBe(78);
    expect(e.max).toBe(78);
  });

  it('resserre la fourchette quand la familiarité monte', () => {
    const widths = [10, 35, 60, 85, 99].map(f => {
      const e = estimateAttribute(70, f, 'w');
      return e.max - e.min;
    });
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]!).toBeLessThanOrEqual(widths[i - 1]!);
    }
    expect(widths[widths.length - 1]!).toBeLessThan(widths[0]!);
  });

  it('encadre la vraie valeur dans la grande majorité des cas', () => {
    let inside = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const trueValue = 20 + (i % 70);
      const e = estimateAttribute(trueValue, 45, `p_${i}`);
      if (trueValue >= e.min && trueValue <= e.max) inside++;
    }
    expect(inside / n).toBeGreaterThan(0.9);
  });

  it('est stable : deux appels identiques donnent le même résultat', () => {
    // Critique pour l'UI — une estimation retirée à chaque rendu permettrait de
    // « rafraîchir » l'affichage jusqu'à deviner la vraie valeur.
    const a = estimateAttribute(64, 40, 'joueur_42_vitesse');
    const b = estimateAttribute(64, 40, 'joueur_42_vitesse');
    expect(a).toEqual(b);
  });

  it('donne des biais différents selon l\'attribut', () => {
    const vitesse = estimateAttribute(64, 35, 'joueur_42_vitesse');
    const passe = estimateAttribute(64, 35, 'joueur_42_passe');
    expect(vitesse.point === passe.point && vitesse.min === passe.min).toBe(false);
  });

  it('reste dans les bornes 1-99', () => {
    for (const value of [1, 5, 50, 95, 99]) {
      const e = estimateAttribute(value, 12, `b_${value}`);
      expect(e.min).toBeGreaterThanOrEqual(1);
      expect(e.max).toBeLessThanOrEqual(99);
    }
  });
});

// =============================================================================
// Estimation du potentiel
// =============================================================================

describe('estimation du potentiel', () => {
  it('est plus incertaine que celle d\'un attribut visible', () => {
    const p = player({ hidden: { ...player().hidden, potentiel: 85 } });
    const pot = estimatePotential(p, 50);
    const attr = estimateAttribute(85, 50, 'cmp');
    expect(pot.max - pot.min).toBeGreaterThan(attr.max - attr.min);
  });

  it('ne descend jamais sous le niveau déjà atteint', () => {
    // Un scout peut se tromper sur la marge, pas sur ce qu'il a sous les yeux.
    const p = player({ hidden: { ...player().hidden, potentiel: 62 } });
    for (const familiarity of [10, 30, 55, 80]) {
      const e = estimatePotential(p, familiarity);
      expect(e.min).toBeGreaterThanOrEqual(Math.round(currentAbility(p)));
    }
  });

  it('converge vers le vrai potentiel avec la connaissance', () => {
    const p = player({ hidden: { ...player().hidden, potentiel: 88 } });
    const vague = estimatePotential(p, 15);
    const sur = estimatePotential(p, 96);
    expect(Math.abs(sur.point - 88)).toBeLessThan(Math.abs(vague.point - 88) + 1);
    expect(sur.max - sur.min).toBeLessThan(vague.max - vague.min);
  });

  it('reste stable entre deux consultations', () => {
    const p = player({ hidden: { ...player().hidden, potentiel: 80 } });
    expect(estimatePotential(p, 42)).toEqual(estimatePotential(p, 42));
  });
});

// =============================================================================
// Niveaux de certitude
// =============================================================================

describe('certitude', () => {
  it('progresse par paliers cohérents', () => {
    expect(certaintyFor(0)).toBe('INCONNU');
    expect(certaintyFor(15)).toBe('VAGUE');
    expect(certaintyFor(45)).toBe('APPROXIMATIF');
    expect(certaintyFor(70)).toBe('FIABLE');
    expect(certaintyFor(95)).toBe('CERTAIN');
  });

  it('dispose d\'un libellé pour chaque niveau', () => {
    for (const level of ['INCONNU', 'VAGUE', 'APPROXIMATIF', 'FIABLE', 'CERTAIN'] as const) {
      expect(CERTAINTY_LABEL[level].length).toBeGreaterThan(3);
    }
  });

  it('n\'annonce pas de marge à un joueur en fin de carrière', () => {
    // Le potentiel nominal d'un vétéran reste au-dessus de son niveau décliné :
    // sans garde-fou, on lui promettait « encore un peu de marge » à 33 ans.
    const veteran = player({ birthDate: '1993-01-01', hidden: { ...player().hidden, potentiel: 92 } });
    expect(upsideLabel(veteran, 90, 2026)).toMatch(/fin de carrière/i);
    const trentenaire = player({ birthDate: '1996-01-01', hidden: { ...player().hidden, potentiel: 92 } });
    expect(upsideLabel(trentenaire, 90, 2026)).toMatch(/déclin/i);
  });

  it('le potentiel d\'un joueur mûr est mieux cerné que celui d\'un espoir', () => {
    const p = player({ hidden: { ...player().hidden, potentiel: 80 } });
    const jeune = { ...p, birthDate: '2007-01-01' };
    const mur = { ...p, birthDate: '1994-01-01' };
    const largeurJeune = (e => e.max - e.min)(estimatePotential(jeune, 70, 2026));
    const largeurMur = (e => e.max - e.min)(estimatePotential(mur, 70, 2026));
    expect(largeurMur).toBeLessThan(largeurJeune);
  });

  it('nuance le jugement quand la connaissance est faible', () => {
    const jeune = player({
      birthDate: '2006-01-01',
      hidden: { ...player().hidden, potentiel: 90 },
    });
    expect(upsideLabel(jeune, 0)).toBe('Non évalué');
    expect(upsideLabel(jeune, 20)).toMatch(/peut-être/i);
    expect(upsideLabel(jeune, 92)).not.toMatch(/peut-être|sans doute/i);
  });
});

// =============================================================================
// Acquisition de connaissance
// =============================================================================

describe('acquisition de connaissance', () => {
  it('un joueur de l\'effectif est connu dès le départ', () => {
    expect(familiarityFromOwnSquad(0, 50)).toBeGreaterThanOrEqual(OWN_SQUAD_BASE_FAMILIARITY);
  });

  it('jouer avec un joueur améliore sa connaissance', () => {
    expect(familiarityFromOwnSquad(20, 50)).toBeGreaterThan(familiarityFromOwnSquad(2, 50));
  });

  it('un bon scout apprend plus vite', () => {
    expect(familiarityFromScoutingRound(0, 90)).toBeGreaterThan(familiarityFromScoutingRound(0, 25));
  });

  it('les premières observations apprennent le plus', () => {
    const premier = familiarityFromScoutingRound(0, 60) - 0;
    const tardif = familiarityFromScoutingRound(80, 60) - 80;
    expect(premier).toBeGreaterThan(tardif);
  });

  it('ne dépasse jamais le plafond de connaissance', () => {
    let f = 0;
    for (let i = 0; i < 60; i++) f = familiarityFromScoutingRound(f, 99);
    expect(f).toBeLessThanOrEqual(MAX_FAMILIARITY);
    expect(familiarityFromOwnSquad(500, 99)).toBeLessThanOrEqual(MAX_FAMILIARITY);
  });
});

// =============================================================================
// Missions d'observation
// =============================================================================

describe('missions d\'observation', () => {
  const ids = (n: number): PlayerId[] =>
    Array.from({ length: n }, (_, i) => `p_${i}` as PlayerId);

  it('le nombre de créneaux dépend de la qualité du scout', () => {
    expect(scoutingSlots(90)).toBeGreaterThan(scoutingSlots(40));
  });

  it('respecte la limite de créneaux', () => {
    let state: ScoutingState = EMPTY_SCOUTING;
    const slots = scoutingSlots(40);
    for (const id of ids(slots + 3)) state = assignScout(state, id, 40);
    expect(state.assignments).toHaveLength(slots);
  });

  it('n\'assigne pas deux fois le même joueur', () => {
    let state: ScoutingState = EMPTY_SCOUTING;
    state = assignScout(state, 'p_1' as PlayerId, 90);
    state = assignScout(state, 'p_1' as PlayerId, 90);
    expect(state.assignments).toHaveLength(1);
  });

  it('permet de libérer un créneau', () => {
    let state: ScoutingState = EMPTY_SCOUTING;
    state = assignScout(state, 'p_1' as PlayerId, 90);
    state = unassignScout(state, 'p_1' as PlayerId);
    expect(state.assignments).toHaveLength(0);
  });

  it('une cible observée devient progressivement connue', () => {
    let state: ScoutingState = assignScout(EMPTY_SCOUTING, 'cible' as PlayerId, 70);
    const before = knowledgeOf(state, 'cible' as PlayerId).familiarity;
    for (let round = 0; round < 6; round++) {
      state = advanceScouting(state, {
        ownSquadIds: [],
        matchesPlayedByPlayer: new Map(),
        facedOpponentIds: [],
        scoutQuality: 70,
      });
    }
    const after = knowledgeOf(state, 'cible' as PlayerId);
    expect(after.familiarity).toBeGreaterThan(before);
    expect(after.source).toBe('MISSION');
  });

  it('affronter une équipe laisse une impression sur ses joueurs', () => {
    const state = advanceScouting(EMPTY_SCOUTING, {
      ownSquadIds: [],
      matchesPlayedByPlayer: new Map(),
      facedOpponentIds: ['adv' as PlayerId],
      scoutQuality: 55,
    });
    const k = knowledgeOf(state, 'adv' as PlayerId);
    expect(k.familiarity).toBeGreaterThan(0);
    expect(k.source).toBe('ADVERSAIRE');
  });

  it('l\'effectif prime sur les autres sources', () => {
    let state: ScoutingState = assignScout(EMPTY_SCOUTING, 'mien' as PlayerId, 70);
    state = advanceScouting(state, {
      ownSquadIds: ['mien' as PlayerId],
      matchesPlayedByPlayer: new Map([['mien' as PlayerId, 10]]),
      facedOpponentIds: ['mien' as PlayerId],
      scoutQuality: 70,
    });
    expect(knowledgeOf(state, 'mien' as PlayerId).source).toBe('EFFECTIF');
  });

  it('un joueur jamais croisé reste inconnu', () => {
    const state = advanceScouting(EMPTY_SCOUTING, {
      ownSquadIds: [],
      matchesPlayedByPlayer: new Map(),
      facedOpponentIds: [],
      scoutQuality: 60,
    });
    expect(knowledgeOf(state, 'inconnu' as PlayerId).familiarity).toBe(0);
    expect(estimatePotential(player(), 0).display).toBe('?');
  });
});

describe('mission sur un club — V0.43', () => {
  const CLUB = 'toulouse' as ClubId;
  const AUTRE = 'vannes' as ClubId;
  const roster = ['p1', 'p2', 'p3'].map(id => id as PlayerId);

  it('mobilise deux créneaux, contre un seul pour un joueur', () => {
    // C'est là que se paie l'ampleur : observer une équipe entière plutôt que
    // continuer à suivre ses pistes de recrutement.
    const state = assignClubScout(EMPTY_SCOUTING, CLUB, 60);
    expect(usedSlots(state)).toBe(CLUB_MISSION_COST);
    expect(state.clubAssignments).toEqual([CLUB]);
  });

  it('refuse la mission quand les créneaux manquent', () => {
    // Scout à 40 → 2 créneaux ; un joueur déjà suivi n'en laisse qu'un.
    const avecJoueur = assignScout(EMPTY_SCOUTING, 'p9' as PlayerId, 40);
    expect(assignClubScout(avecJoueur, CLUB, 40)).toBe(avecJoueur);
  });

  it('empêche d\'ajouter un joueur quand un club occupe tout', () => {
    const state = assignClubScout(EMPTY_SCOUTING, CLUB, 40);
    expect(assignScout(state, 'p9' as PlayerId, 40)).toBe(state);
  });

  it('ne double pas une mission déjà en cours et sait la lever', () => {
    let state = assignClubScout(EMPTY_SCOUTING, CLUB, 85);
    expect(assignClubScout(state, CLUB, 85)).toBe(state);
    state = unassignClubScout(state, CLUB);
    expect(usedSlots(state)).toBe(0);
    expect(unassignClubScout(state, AUTRE)).toBe(state);
  });

  it('fait progresser tout l\'effectif observé', () => {
    // Sans cela, le dossier d'avant-match ne se dé-brouillait qu'en affrontant
    // l'équipe : on ne pouvait rien préparer avant de l'avoir déjà jouée.
    let state = assignClubScout(EMPTY_SCOUTING, CLUB, 70);
    state = advanceScouting(state, {
      ownSquadIds: [], matchesPlayedByPlayer: new Map(), facedOpponentIds: [],
      scoutQuality: 70, scoutedClubRosters: new Map([[CLUB, roster]]),
    });
    for (const id of roster) {
      expect(knowledgeOf(state, id).familiarity).toBeGreaterThan(0);
      expect(knowledgeOf(state, id).source).toBe('MISSION');
    }
  });

  it('n\'écrase pas la connaissance de son propre effectif', () => {
    let state = advanceScouting(EMPTY_SCOUTING, {
      ownSquadIds: roster, matchesPlayedByPlayer: new Map(), facedOpponentIds: [],
      scoutQuality: 70,
    });
    state = assignClubScout(state, CLUB, 70);
    state = advanceScouting(state, {
      ownSquadIds: roster, matchesPlayedByPlayer: new Map(), facedOpponentIds: [],
      scoutQuality: 70, scoutedClubRosters: new Map([[CLUB, roster]]),
    });
    expect(knowledgeOf(state, roster[0]!).source).toBe('EFFECTIF');
  });

  it('reste inoffensif quand aucun effectif n\'est fourni', () => {
    // Une sauvegarde peut porter une mission sur un club que l'appelant ne
    // résout pas encore.
    const state = advanceScouting(assignClubScout(EMPTY_SCOUTING, CLUB, 70), {
      ownSquadIds: [], matchesPlayedByPlayer: new Map(), facedOpponentIds: [],
      scoutQuality: 70,
    });
    expect(state.clubAssignments).toEqual([CLUB]);
  });
});
