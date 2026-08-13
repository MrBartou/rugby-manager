/**
 * Les tests internationaux joués par le moteur (V0.63).
 *
 * Le défaut corrigé : un match international était un score estimé à partir de
 * l'écart de force. Un international revenait de tournée sans avoir rien fait :
 * pas un essai, pas un plaquage, et une cape même s'il n'avait jamais quitté la
 * tribune.
 *
 * Ce qui est vérifié ici : les deux feuilles sont réglementaires, la sélection
 * adverse dure d'une saison à l'autre, le match se joue vraiment, et le groupe
 * tourne d'un test au suivant.
 */

import { describe, expect, it } from 'vitest';
import {
  buildFranceSheet,
  buildInternationalMatchInput,
  buildNationSquad,
  FRANCE_NATIONAL_CLUB,
} from '../../src/engine/season/national-opponent.js';
import { AUTUMN_OPPONENTS, NATIONS } from '../../src/engine/season/national-team.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { makeSquad } from './fixtures.js';
import type { ClubId, Player } from '../../src/engine/types.js';

const SEASON = 2026;

/** Un vivier de trente-trois joueurs français, tous postes couverts. */
function groupe(): readonly Player[] {
  const premier = makeSquad('fr' as ClubId, 76).players;
  const second = makeSquad('fr2' as ClubId, 72).players;
  return [...premier, ...second].slice(0, 33);
}

describe('la sélection adverse', () => {
  it('aligne vingt-trois joueurs, quinze plus huit', () => {
    const irlande = buildNationSquad({
      nation: NATIONS[0]!, currentSeason: SEASON, careerStartSeason: SEASON,
    });
    expect(irlande.squad.starters).toHaveLength(15);
    expect(irlande.squad.substitutes).toHaveLength(8);
    expect(irlande.players).toHaveLength(23);
    expect(irlande.squad.starters.filter(s => s.captainArmband)).toHaveLength(1);
  });

  it('est la même équipe l\'année suivante, vieillie d\'un an', () => {
    const cette = buildNationSquad({
      nation: NATIONS[0]!, currentSeason: SEASON, careerStartSeason: SEASON,
    });
    const suivante = buildNationSquad({
      nation: NATIONS[0]!, currentSeason: SEASON + 1, careerStartSeason: SEASON,
    });
    const communs = cette.players.filter(p => suivante.players.some(q => q.id === p.id));
    expect(communs.length).toBeGreaterThanOrEqual(18);
  });

  it('ne recrute pas ses joueurs dans le mauvais hémisphère', () => {
    // Les adversaires d'automne viennent du Sud : leurs patronymes n'existaient
    // pas avant la V0.63.
    const nz = AUTUMN_OPPONENTS.find(n => n.id === 'NZL')!;
    const squad = buildNationSquad({
      nation: nz, currentSeason: SEASON, careerStartSeason: SEASON,
    });
    const irlande = buildNationSquad({
      nation: NATIONS[0]!, currentSeason: SEASON, careerStartSeason: SEASON,
    });
    const nomsNz = new Set(squad.players.map(p => p.lastName));
    const nomsIrl = new Set(irlande.players.map(p => p.lastName));
    expect([...nomsNz].some(n => nomsIrl.has(n))).toBe(false);
  });
});

describe('le XV de France', () => {
  it('couvre les quinze postes et un banc de huit, sans doublon', () => {
    const sheet = buildFranceSheet({
      ranked: groupe(), clubId: FRANCE_NATIONAL_CLUB, matchIndex: 0,
    });
    expect(sheet.squad.starters).toHaveLength(15);
    expect(sheet.squad.substitutes).toHaveLength(8);
    expect(new Set(sheet.matchdayIds).size).toBe(23);
    expect(new Set(sheet.squad.starters.map(s => s.position)).size).toBe(15);
  });

  it('fait tourner d\'un test à l\'autre', () => {
    const ranked = groupe();
    const premier = buildFranceSheet({ ranked, clubId: FRANCE_NATIONAL_CLUB, matchIndex: 0 });
    const second = buildFranceSheet({ ranked, clubId: FRANCE_NATIONAL_CLUB, matchIndex: 1 });
    // Un groupe de trente-trois qui jouerait cinq fois le même XV n'aurait
    // aucune raison d'être de trente-trois.
    expect(second.starterIds).not.toEqual(premier.starterIds);
  });
});

describe('le match se joue vraiment', () => {
  it('produit un score et des performances individuelles', () => {
    const ranked = groupe();
    const sheet = buildFranceSheet({ ranked, clubId: FRANCE_NATIONAL_CLUB, matchIndex: 0 });
    const input = buildInternationalMatchInput({
      nation: NATIONS[4]!,             // l'Italie, pour que la France soit favorite
      france: sheet,
      francePlayers: ranked,
      nationSquad: buildNationSquad({
        nation: NATIONS[4]!, currentSeason: SEASON, careerStartSeason: SEASON,
      }),
      atHome: true,
      matchId: 'intl_test',
    });
    const result = simulateMatch(input, 'graine');

    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    // Les titulaires ont joué : c'est toute la différence avec un score estimé.
    const minutes = sheet.starterIds
      .map(id => result.individualStats.get(id)?.minutesPlayed ?? 0);
    expect(minutes.every(m => m > 0)).toBe(true);
    expect(result.narrativeSummary.length).toBeGreaterThan(0);
  });

  it('reste déterministe à graine égale', () => {
    const ranked = groupe();
    const build = (): ReturnType<typeof buildInternationalMatchInput> => {
      const sheet = buildFranceSheet({ ranked, clubId: FRANCE_NATIONAL_CLUB, matchIndex: 0 });
      return buildInternationalMatchInput({
        nation: NATIONS[1]!,
        france: sheet,
        francePlayers: ranked,
        nationSquad: buildNationSquad({
          nation: NATIONS[1]!, currentSeason: SEASON, careerStartSeason: SEASON,
        }),
        atHome: false,
        matchId: 'intl_det',
      });
    };
    const a = simulateMatch(build(), 'g');
    const b = simulateMatch(build(), 'g');
    expect([a.homeScore, a.awayScore]).toEqual([b.homeScore, b.awayScore]);
  });

  it('une équipe nettement supérieure gagne le plus souvent', () => {
    // Sans cela, la force d'une nation ne voudrait rien dire.
    let victoires = 0;
    const ranked = groupe();
    for (let i = 0; i < 12; i++) {
      const sheet = buildFranceSheet({ ranked, clubId: FRANCE_NATIONAL_CLUB, matchIndex: i });
      const input = buildInternationalMatchInput({
        nation: { id: 'FAI', name: 'Nation faible', strength: 52 },
        france: sheet,
        francePlayers: ranked,
        nationSquad: buildNationSquad({
          nation: { id: 'FAI', name: 'Nation faible', strength: 52 },
          currentSeason: SEASON,
          careerStartSeason: SEASON,
        }),
        atHome: true,
        matchId: `intl_${i}`,
      });
      const r = simulateMatch(input, `g${i}`);
      if (r.homeScore > r.awayScore) victoires++;
    }
    expect(victoires).toBeGreaterThanOrEqual(9);
  });
});
