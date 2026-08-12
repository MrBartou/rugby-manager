/**
 * Composition des matchs auto-simulés — V0.31.
 *
 * `makeMatchInputFromSeed` tirait ses compositions du CSV brut. Conséquences
 * silencieuses : un joueur transféré continuait de jouer pour son ancien club,
 * un blessé était aligné comme si de rien n'était, et tout le mercato des clubs
 * IA n'avait strictement aucun effet sur le terrain.
 */

import { describe, expect, it } from 'vitest';
import {
  autoLineupForClub,
  buildSeedData,
  makeMatchInputFromSeed,
  rosterForClub,
} from '@/data/seed.js';
import type { ClubId, Player, PlayerId } from '@/engine/types.js';

const CLUBS_CSV = [
  'id,name,shortName,city,tier,tacticalIdentity,stadiumCapacity,annualBudget,reputation',
  'alpha,Alpha RC,ALP,Ville A,GROS_BUDGET,MIXTE,20000,30000000,80',
  'beta,Beta RC,BET,Ville B,BUDGET_MOYEN,MIXTE,15000,20000000,60',
].join('\n');

const POSTES = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/** Deux joueurs par poste et par club : de quoi remplacer un absent. */
const PLAYERS_CSV = [
  'clubId,firstName,lastName,position,birthYear,niveau,isJiff',
  ...['alpha', 'beta'].flatMap(club =>
    POSTES.flatMap((pos, i) => [
      `${club},Un,${club}${pos}A${i},${pos},1996,72,true`,
      `${club},Deux,${club}${pos}B${i},${pos},1998,64,true`,
    ]),
  ),
].join('\n');

const SEED = buildSeedData(CLUBS_CSV, PLAYERS_CSV);

/** Stock de joueurs modifiable, comme la couche d'overrides du jeu. */
function makeStore(): {
  provider: (clubId: string) => readonly Player[];
  patch: (id: string, change: (p: Player) => Player) => void;
} {
  const overrides = new Map<string, Player>();
  return {
    provider: (clubId: string) => {
      const base = ['alpha', 'beta'].flatMap(c => rosterForClub(SEED, c));
      return base
        .map(p => overrides.get(p.id as string) ?? p)
        .filter(p => p.clubId === (clubId as ClubId) && !p.retired && !p.freeAgent);
    },
    patch: (id, change) => {
      const source = ['alpha', 'beta']
        .flatMap(c => rosterForClub(SEED, c))
        .find(p => (p.id as string) === id)!;
      overrides.set(id, change(overrides.get(id) ?? source));
    },
  };
}

function starterIds(clubId: string, provider: (c: string) => readonly Player[]): string[] {
  const input = makeMatchInputFromSeed(SEED, {
    homeClubId: 'alpha', awayClubId: 'beta', rosterProvider: provider,
  });
  const side = clubId === 'alpha' ? input.home : input.away;
  return side.squad.starters.map(s => s.playerId as string);
}

describe('composition d\'un match auto-simulé', () => {
  it('écarte un joueur blessé', () => {
    const store = makeStore();
    const titulaire = starterIds('alpha', store.provider)[0]!;

    store.patch(titulaire, p => ({
      ...p,
      dynamic: { ...p.dynamic, injury: { type: 'LIGAMENTAIRE', startedAt: 1, estimatedReturnAt: 12, hasSequela: false } },
    }));

    expect(starterIds('alpha', store.provider)).not.toContain(titulaire);
  });

  it('écarte un joueur suspendu', () => {
    const store = makeStore();
    const titulaire = starterIds('beta', store.provider)[0]!;

    store.patch(titulaire, p => ({
      ...p,
      dynamic: { ...p.dynamic, suspendedUntilRound: 9 },
    }));

    expect(starterIds('beta', store.provider)).not.toContain(titulaire);
  });

  it('fait jouer un joueur transféré pour son nouveau club', () => {
    const store = makeStore();
    const transféré = starterIds('alpha', store.provider)[0]!;

    store.patch(transféré, p => ({ ...p, clubId: 'beta' as ClubId }));

    expect(starterIds('alpha', store.provider)).not.toContain(transféré);
    // Il doit être disponible pour Beta — titulaire ou non selon son niveau.
    expect(store.provider('beta').some(p => (p.id as string) === transféré)).toBe(true);
  });

  it('aligne toujours quinze joueurs malgré les absences', () => {
    const store = makeStore();
    for (const id of starterIds('alpha', store.provider).slice(0, 5)) {
      store.patch(id, p => ({
        ...p,
        dynamic: { ...p.dynamic, injury: { type: 'FRACTURE', startedAt: 1, estimatedReturnAt: 20, hasSequela: false } },
      }));
    }
    expect(starterIds('alpha', store.provider)).toHaveLength(15);
  });

  it('l\'auto-compo suit le même effectif réel', () => {
    const store = makeStore();
    const titulaire = autoLineupForClub(SEED, 'alpha', new Set(), store.provider)
      .starters[0]!.playerId;

    store.patch(titulaire, p => ({
      ...p,
      dynamic: { ...p.dynamic, injury: { type: 'COMMOTION', startedAt: 1, estimatedReturnAt: 6, hasSequela: false } },
    }));

    const après = autoLineupForClub(SEED, 'alpha', new Set(), store.provider);
    expect(après.starters.map(s => s.playerId)).not.toContain(titulaire);
  });

  it('sans fournisseur, retombe sur les données du CSV', () => {
    const input = makeMatchInputFromSeed(SEED, { homeClubId: 'alpha', awayClubId: 'beta' });
    expect(input.home.squad.starters).toHaveLength(15);
    expect(input.away.squad.starters).toHaveLength(15);
  });
});

/**
 * Ce que la v0.60 y ajoute.
 *
 * Trois défauts au même endroit : l'auto-composition ne savait pas qu'un joueur
 * pouvait être parti en sélection, son repli piochait dans l'effectif brut au
 * lieu des disponibles (donc réalignait les blessés dès qu'un poste manquait de
 * candidat), et elle posait deux brassards de capitaine.
 */
describe('les absents restent absents', () => {
  const compo = (unavailable: ReadonlySet<string>) => makeMatchInputFromSeed(SEED, {
    homeClubId: 'alpha',
    awayClubId: 'beta',
    unavailable: unavailable as ReadonlySet<PlayerId>,
  });

  it('un international parti en sélection ne joue pas avec son club', () => {
    const titulaire = compo(new Set()).home.squad.starters[0]!.playerId as string;
    const après = compo(new Set([titulaire])).home;

    expect(après.squad.starters.map(s => s.playerId as string)).not.toContain(titulaire);
    expect(après.squad.substitutes.map(s => s.playerId as string)).not.toContain(titulaire);
  });

  it('et l\'absence vaut pour les deux camps, pas seulement le nôtre', () => {
    const titulaire = compo(new Set()).away.squad.starters[0]!.playerId as string;
    expect(compo(new Set([titulaire])).away.squad.starters.map(s => s.playerId as string))
      .not.toContain(titulaire);
  });

  it('le repli sur un poste dégarni ne rappelle pas un blessé', () => {
    // Effectif réduit à seize joueurs, dont le seul arrière est sur le flanc :
    // le repli doit sortir un valide de son poste, jamais rappeler le blessé.
    const base = rosterForClub(SEED, 'alpha');
    const seize = POSTES
      .map(pos => base.find(p => p.position === pos)!)
      .concat(base.filter(p => p.position === 'AILIER_GAUCHE')[1]!);
    const arrière = seize.find(p => p.position === 'ARRIERE')!;
    const provider = (clubId: string): readonly Player[] => (
      clubId === 'alpha'
        ? seize.map(p => (p.id === arrière.id
          ? { ...p, dynamic: { ...p.dynamic, injury: { type: 'FRACTURE' as const, startedAt: 1, estimatedReturnAt: 20, hasSequela: false } } }
          : p))
        : rosterForClub(SEED, clubId)
    );

    const alignés = starterIds('alpha', provider);
    expect(alignés).toHaveLength(15);
    expect(alignés).not.toContain(arrière.id as string);
  });
});

describe('un seul capitaine sur le terrain', () => {
  it('l\'auto-composition pose un brassard, pas deux', () => {
    const input = makeMatchInputFromSeed(SEED, { homeClubId: 'alpha', awayClubId: 'beta' });
    for (const side of [input.home, input.away]) {
      expect(side.squad.starters.filter(s => s.captainArmband)).toHaveLength(1);
    }
  });

  it('et aucun remplaçant ne porte le sien', () => {
    const input = makeMatchInputFromSeed(SEED, { homeClubId: 'alpha', awayClubId: 'beta' });
    expect(input.home.squad.substitutes.some(s => s.captainArmband)).toBe(false);
  });
});
