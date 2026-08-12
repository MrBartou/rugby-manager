/**
 * Le XV de France — V0.58.
 *
 * Une sélection n'était qu'une absence : les trois meilleurs JIFF de chaque
 * club, quarante-deux joueurs pour une équipe de quinze, disparaissaient deux
 * journées et revenaient inchangés.
 *
 * Ce qui est vérifié ici : le groupe est **équilibré** et non pas simplement
 * le classement des mieux notés, il tient compte du temps de jeu et de l'âge,
 * les capes s'accumulent, et une sélection coûte quelque chose au club.
 */

import { describe, expect, it } from 'vitest';
import {
  NO_CAPS,
  SQUAD_SIZE,
  applyCaps,
  internationalFatigue,
  isEligible,
  playWindow,
  reportWindow,
  seedInitialCaps,
  CAPS_PER_SEASON,
  selectNationalSquad,
  selectionNarrative,
  selectionScore,
  type Caps,
} from '../../src/engine/season/national-team.js';
import { createRng } from '../../src/engine/rng.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player, PlayerId, Position } from '../../src/engine/types.js';

const SEASON = 2026;
const BASE = makeSquad('c1' as ClubId, 70).players[0]!;

const joueur = (over: {
  id: string;
  position: Position;
  niveau?: number;
  age?: number;
  jiff?: boolean;
  forme?: number;
}): Player => {
  const n = over.niveau ?? 70;
  return {
    ...BASE,
    id: over.id as PlayerId,
    lastName: over.id.toUpperCase(),
    position: over.position,
    isJiff: over.jiff ?? true,
    birthDate: `${SEASON - (over.age ?? 27)}-01-01`,
    technical: { ...BASE.technical, passe: n, plaquage: n, visionDeJeu: n, conservation: n, deblayage: n },
    physical: { ...BASE.physical, vitesse: n, puissance: n, endurance: n, robustesse: n },
    mental: { ...BASE.mental, decision: n, sangFroid: n, professionnalisme: n },
    dynamic: { ...BASE.dynamic, forme: over.forme ?? 70 },
  };
};

const ALL_POSITIONS: readonly Position[] = [
  'PILIER_GAUCHE', 'TALONNEUR', 'PILIER_DROIT',
  'DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE',
  'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8',
  'DEMI_DE_MELEE', 'OUVREUR',
  'AILIER_GAUCHE', 'CENTRE_INTERIEUR', 'CENTRE_EXTERIEUR', 'AILIER_DROIT',
  'ARRIERE',
];

/** Un championnat plausible : six joueurs par poste, niveaux étagés. */
const CHAMPIONNAT: readonly Player[] = ALL_POSITIONS.flatMap((position, pi) =>
  Array.from({ length: 6 }, (_, i) =>
    joueur({ id: `p${pi}_${i}`, position, niveau: 78 - i * 3 })),
);

const TOUS_TITULAIRES = new Map<PlayerId, number>(
  CHAMPIONNAT.map(p => [p.id, 0.8] as const),
);

const select = (players: readonly Player[] = CHAMPIONNAT, caps: Caps = NO_CAPS) =>
  selectNationalSquad({
    players,
    caps,
    playRatio: new Map(players.map(p => [p.id, 0.8] as const)),
    currentSeason: SEASON,
  });

describe('le groupe est équilibré, pas seulement bien noté', () => {
  it('compte trente-trois joueurs', () => {
    expect(select().players).toHaveLength(SQUAD_SIZE);
  });

  it('emmène des talonneurs et des arrières, pas six troisièmes lignes de plus', () => {
    // Sans quotas, le groupe se remplissait des postes les mieux notés et
    // partait au Tournoi sans première ligne de rechange.
    const byId = new Map(CHAMPIONNAT.map(p => [p.id as string, p] as const));
    const postes = select().players.map(id => byId.get(id as string)!.position);
    const talonneurs = postes.filter(p => p === 'TALONNEUR').length;
    const arrieres = postes.filter(p => p === 'ARRIERE').length;
    const piliers = postes.filter(p => p === 'PILIER_GAUCHE' || p === 'PILIER_DROIT').length;
    expect(talonneurs).toBeGreaterThanOrEqual(3);
    expect(arrieres).toBeGreaterThanOrEqual(2);
    expect(piliers).toBeGreaterThanOrEqual(5);
  });

  it('donne le brassard au plus capé, pas au mieux noté', () => {
    const capes: Caps = new Map([['p8_3' as PlayerId, { caps: 40, firstSeason: 2020, lastSeason: 2025 }]]);
    expect(select(CHAMPIONNAT, capes).captain).toBe('p8_3');
  });

  it('rend la même liste deux fois — une sélection ne se tire pas au sort', () => {
    expect(select().players).toEqual(select().players);
  });
});

describe('ce qui décide d\'une sélection', () => {
  const score = (p: Player, playRatio: number, caps: Caps = NO_CAPS): number =>
    selectionScore({ player: p, caps, playRatio, currentSeason: SEASON });

  it('celui qui joue passe devant celui qui ne joue pas', () => {
    // Le premier critère qu'un sélectionneur énonce en conférence de presse.
    const titulaire = joueur({ id: 'a', position: 'OUVREUR', niveau: 72 });
    const remplaçant = joueur({ id: 'b', position: 'OUVREUR', niveau: 72 });
    expect(score(titulaire, 0.9)).toBeGreaterThan(score(remplaçant, 0.05));
  });

  it('à niveau égal, le trentenaire cède la place', () => {
    const jeune = joueur({ id: 'a', position: 'CENTRE_INTERIEUR', niveau: 74, age: 26 });
    const vétéran = joueur({ id: 'b', position: 'CENTRE_INTERIEUR', niveau: 74, age: 35 });
    expect(score(jeune, 0.7)).toBeGreaterThan(score(vétéran, 0.7));
  });

  it('la forme du moment compte', () => {
    const chaud = joueur({ id: 'a', position: 'AILIER_GAUCHE', niveau: 72, forme: 90 });
    const froid = joueur({ id: 'b', position: 'AILIER_GAUCHE', niveau: 72, forme: 40 });
    expect(score(chaud, 0.7)).toBeGreaterThan(score(froid, 0.7));
  });

  it('les capes rassurent sans donner de droit acquis', () => {
    const capé = joueur({ id: 'a', position: 'ARRIERE', niveau: 68 });
    const meilleur = joueur({ id: 'b', position: 'ARRIERE', niveau: 76 });
    const capes: Caps = new Map([['a' as PlayerId, { caps: 50, firstSeason: 2018, lastSeason: 2025 }]]);
    // Huit points de niveau ne se rattrapent pas avec un passé.
    expect(score(meilleur, 0.7)).toBeGreaterThan(score(capé, 0.7, capes));
  });

  it('écarte un blessé, un étranger et un retraité', () => {
    expect(isEligible(joueur({ id: 'x', position: 'OUVREUR', jiff: false }), SEASON)).toBe(false);
    expect(isEligible({ ...joueur({ id: 'y', position: 'OUVREUR' }), retired: true }, SEASON)).toBe(false);
    const blessé = {
      ...joueur({ id: 'z', position: 'OUVREUR' }),
      dynamic: {
        ...BASE.dynamic,
        injury: { type: 'MUSCULAIRE' as const, startedAt: 4, estimatedReturnAt: 12, hasSequela: false },
      },
    };
    expect(isEligible(blessé, SEASON)).toBe(false);
  });
});

describe('le sélectionneur regarde le pays, pas un championnat', () => {
  it('un joueur de première division passe devant un joueur de seconde', () => {
    // Le défaut trouvé en jeu : le vivier ne contenait que la division jouée,
    // et un manager de Pro D2 voyait le XV de France composé de Pro D2.
    const elite = ALL_POSITIONS.flatMap((position, pi) =>
      Array.from({ length: 3 }, (_, i) =>
        joueur({ id: `elite${pi}_${i}`, position, niveau: 84 - i * 2 })));
    const modeste = ALL_POSITIONS.flatMap((position, pi) =>
      Array.from({ length: 3 }, (_, i) =>
        joueur({ id: `modeste${pi}_${i}`, position, niveau: 52 - i * 2 })));

    const squad = selectNationalSquad({
      players: [...elite, ...modeste],
      caps: NO_CAPS,
      // On ne suit que le championnat modeste : les joueurs d'élite n'ont
      // aucune statistique, et ne doivent pas en être pénalisés.
      playRatio: new Map(modeste.map(p => [p.id, 0.9] as const)),
      currentSeason: SEASON,
    });
    const venusDeLElite = squad.players.filter(id => String(id).startsWith('elite')).length;
    expect(venusDeLElite).toBeGreaterThan(SQUAD_SIZE * 0.75);
  });

  it('mais un remplaçant de son propre championnat reste écarté', () => {
    // L'inconnue vaut un temps de jeu ordinaire ; zéro match constaté reste
    // zéro match constaté.
    const titulaire = joueur({ id: 'a', position: 'OUVREUR', niveau: 70 });
    const banc = joueur({ id: 'b', position: 'OUVREUR', niveau: 70 });
    const s = (id: string, ratio: number) => selectionScore({
      player: id === 'a' ? titulaire : banc,
      caps: NO_CAPS,
      playRatio: ratio,
      currentSeason: SEASON,
    });
    expect(s('a', 0.9)).toBeGreaterThan(s('b', 0));
  });
});

describe('les capes s\'accumulent', () => {
  it('une première sélection est signalée comme telle, une seule fois', () => {
    const squad = select();
    expect(squad.newCaps.length).toBe(SQUAD_SIZE);

    const après = applyCaps(NO_CAPS, squad, 5);
    const encore = selectNationalSquad({
      players: CHAMPIONNAT, caps: après, playRatio: TOUS_TITULAIRES, currentSeason: SEASON + 1,
    });
    // Ceux qui reviennent ne découvrent plus rien.
    const revenants = encore.players.filter(id => squad.players.includes(id));
    expect(encore.newCaps.filter(id => revenants.includes(id))).toHaveLength(0);
  });

  it('compte une cape par match disputé', () => {
    const squad = select();
    const caps = applyCaps(NO_CAPS, squad, 5);
    expect(caps.get(squad.players[0]!)?.caps).toBe(5);
    expect(applyCaps(caps, squad, 2).get(squad.players[0]!)?.caps).toBe(7);
  });

  it('retient la saison de la première et de la dernière', () => {
    const squad = select();
    const caps = applyCaps(NO_CAPS, squad, 2);
    const record = caps.get(squad.players[0]!)!;
    expect(record.firstSeason).toBe(SEASON);
    expect(record.lastSeason).toBe(SEASON);
  });
});

describe('le monde a un passé international', () => {
  it('un cadre international arrive avec des capes, un jeune sans', () => {
    // Sans cela, la première journée d'une carrière annonçait une « première
    // sélection » pour le meilleur joueur du pays.
    const star = joueur({ id: 'star', position: 'DEMI_DE_MELEE', niveau: 93, age: 29 });
    const jeune = joueur({ id: 'jeune', position: 'DEMI_DE_MELEE', niveau: 93, age: 20 });
    const moyen = joueur({ id: 'moyen', position: 'DEMI_DE_MELEE', niveau: 64, age: 29 });
    const caps = seedInitialCaps([star, jeune, moyen], SEASON);
    expect(caps.get('star' as PlayerId)!.caps).toBeGreaterThan(30);
    // Et jamais plus que ce qu'une carrière permet ici : le monde ne joue que
    // sept matchs internationaux par saison.
    expect(caps.get('star' as PlayerId)!.caps).toBeLessThanOrEqual(8 * CAPS_PER_SEASON);
    expect(caps.has('jeune' as PlayerId)).toBe(false);
    // La grande majorité des professionnels ne sont jamais sélectionnés.
    expect(caps.has('moyen' as PlayerId)).toBe(false);
  });

  it('n\'en donne pas à un joueur non qualifié', () => {
    const etranger = joueur({ id: 'e', position: 'OUVREUR', niveau: 90, age: 29, jiff: false });
    expect(seedInitialCaps([etranger], SEASON).size).toBe(0);
  });

  it('et la première sélection redevient un événement rare', () => {
    const caps = seedInitialCaps(CHAMPIONNAT, SEASON);
    const squad = select(CHAMPIONNAT, caps);
    expect(squad.newCaps.length).toBeLessThan(SQUAD_SIZE / 2);
  });
});

describe('la sélection se paie', () => {
  it('un joueur revient plus fatigué d\'un Tournoi que d\'une tournée', () => {
    expect(internationalFatigue(5)).toBeGreaterThan(internationalFatigue(2));
    expect(internationalFatigue(0)).toBe(0);
  });

  it('le Tournoi se joue en cinq matchs, la tournée en deux', () => {
    const rng = createRng('t');
    expect(playWindow({ window: 'TOURNOI', franceStrength: 75, rng })).toHaveLength(5);
    expect(playWindow({ window: 'AUTOMNE', franceStrength: 75, rng })).toHaveLength(2);
  });

  it('une meilleure équipe gagne plus souvent, sans gagner toujours', () => {
    // Un Tournoi que la France remporterait mécaniquement dès qu'elle est la
    // mieux notée n'aurait plus rien d'un tournoi.
    let fortes = 0;
    let faibles = 0;
    for (let i = 0; i < 60; i++) {
      const rng = createRng(`w${i}`);
      fortes += reportWindow('TOURNOI', playWindow({ window: 'TOURNOI', franceStrength: 84, rng })).won;
      faibles += reportWindow('TOURNOI', playWindow({ window: 'TOURNOI', franceStrength: 62, rng })).won;
    }
    expect(fortes).toBeGreaterThan(faibles);
    expect(fortes).toBeLessThan(60 * 5);
  });

  it('nomme les joueurs du club, et distingue les premières sélections', () => {
    const squad = select();
    const mesJoueurs = CHAMPIONNAT.filter(p => squad.players.includes(p.id)).slice(0, 2);
    const texte = selectionNarrative(squad, mesJoueurs)!;
    expect(texte).toContain(mesJoueurs[0]!.lastName);
    expect(texte).toContain('Première sélection');
    // Un club sans sélectionné n'a pas de nouvelle à lire.
    expect(selectionNarrative(squad, [])).toBeUndefined();
  });
});
