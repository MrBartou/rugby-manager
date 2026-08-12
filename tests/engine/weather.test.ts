/**
 * La météo — V0.51.
 *
 * `weather` était un champ **obligatoire** de `MatchInput`, implémenté au seul
 * jeu au pied placé et valant `'SEC'` en dur : aucun match de carrière n'a
 * jamais été joué sous la pluie. Même chose pour `fieldCondition`, qui agit sur
 * la poussée en mêlée et valait toujours `'BON'`.
 *
 * Ce qui est testé ici : la pluie change réellement un match — et elle le change
 * dans le bon sens, mesuré sur des rencontres entières, pas seulement dans les
 * coefficients.
 */

import { describe, expect, it } from 'vitest';
import {
  CLEAR_WEATHER,
  WEATHER_LABEL,
  generateWeather,
  monthOfRound,
  weatherEffects,
  weatherHint,
  type Weather,
} from '../../src/engine/match/weather.js';
import { simulateMatch } from '../../src/engine/match/simulate.js';
import { createRng } from '../../src/engine/rng.js';
import { makeMatchInput } from './fixtures.js';

describe('il pleut quand il doit pleuvoir', () => {
  /** Part de matchs non secs sur une journée donnée, tous stades confondus. */
  const badShare = (round: number, club = 'toulouse', n = 400): number => {
    let bad = 0;
    for (let i = 0; i < n; i++) {
      const w = generateWeather({ round, homeClubId: club, rng: createRng(`w${round}_${i}`) });
      if (w.weather !== 'SEC') bad++;
    }
    return bad / n;
  };

  it('septembre est presque toujours sec, janvier beaucoup moins', () => {
    expect(badShare(1)).toBeLessThan(0.2);
    expect(badShare(14)).toBeGreaterThan(badShare(1) + 0.2);
  });

  it('les journées d\'hiver tombent bien en hiver', () => {
    expect(monthOfRound(1)).toBe(9);
    const months = Array.from({ length: 26 }, (_, i) => monthOfRound(i + 1));
    expect(months).toContain(12);
    expect(months).toContain(1);
  });

  it('un stade exposé prend plus de vent qu\'un autre', () => {
    let ventLaRochelle = 0;
    let ventToulouse = 0;
    for (let i = 0; i < 400; i++) {
      if (generateWeather({ round: 14, homeClubId: 'la_rochelle', rng: createRng(`a${i}`) })
        .weather === 'VENT') ventLaRochelle++;
      if (generateWeather({ round: 14, homeClubId: 'toulouse', rng: createRng(`a${i}`) })
        .weather === 'VENT') ventToulouse++;
    }
    expect(ventLaRochelle).toBeGreaterThan(ventToulouse);
  });

  it('le terrain suit le ciel', () => {
    for (let i = 0; i < 200; i++) {
      const w = generateWeather({ round: 14, homeClubId: 'clermont', rng: createRng(`f${i}`) });
      if (w.weather === 'PLUIE' || w.weather === 'EXTREME') {
        expect(w.fieldCondition).toBe('GRAS');
      }
    }
  });

  it('reste déterministe : même journée, même stade, même graine, même temps', () => {
    const a = generateWeather({ round: 12, homeClubId: 'pau', rng: createRng('fixe') });
    const b = generateWeather({ round: 12, homeClubId: 'pau', rng: createRng('fixe') });
    expect(a).toEqual(b);
  });

  it('garde les conditions extrêmes rares', () => {
    let extreme = 0;
    for (let round = 1; round <= 26; round++) {
      for (let i = 0; i < 100; i++) {
        if (generateWeather({ round, homeClubId: 'toulouse', rng: createRng(`e${round}_${i}`) })
          .weather === 'EXTREME') extreme++;
      }
    }
    expect(extreme / (26 * 100)).toBeLessThan(0.06);
  });
});

describe('ce que le ciel impose', () => {
  it('ne change rien par temps sec', () => {
    expect(weatherEffects('SEC')).toEqual(CLEAR_WEATHER);
  });

  it('la pluie fait lâcher des ballons et pousse au jeu au pied', () => {
    const pluie = weatherEffects('PLUIE');
    expect(pluie.handlingFactor).toBeGreaterThan(1);
    expect(pluie.kickTendency).toBeGreaterThan(1);
    expect(pluie.tryFactor).toBeLessThan(1);
  });

  it('le vent gêne la touche et dissuade de jouer au pied', () => {
    const vent = weatherEffects('VENT');
    expect(vent.lineoutMalus).toBeGreaterThan(weatherEffects('PLUIE').lineoutMalus);
    expect(vent.kickTendency).toBeLessThan(1);
  });

  it('les conditions extrêmes cumulent tout, en pire', () => {
    const ext = weatherEffects('EXTREME');
    const pluie = weatherEffects('PLUIE');
    expect(ext.handlingFactor).toBeGreaterThan(pluie.handlingFactor);
    expect(ext.tryFactor).toBeLessThan(pluie.tryFactor);
  });

  it('nomme chaque temps et dit ce qu\'il implique', () => {
    for (const w of ['SEC', 'PLUIE', 'VENT', 'EXTREME'] as const) {
      expect(WEATHER_LABEL[w].length).toBeGreaterThan(3);
      expect(weatherHint(w, 'BON').length).toBeGreaterThan(25);
    }
  });
});

describe('la pluie change vraiment un match', () => {
  /** Essais par match sur N rencontres à conditions imposées. */
  const triesPerMatch = (weather: Weather, n = 400): number => {
    let tries = 0;
    for (let i = 0; i < n; i++) {
      const input = makeMatchInput({
        homeNiveau: 70,
        awayNiveau: 70,
        matchId: `w_${weather}_${i}`,
        weather,
        ...(weather === 'PLUIE' || weather === 'EXTREME'
          ? { fieldCondition: 'GRAS' as const } : {}),
      });
      const r = simulateMatch(input, `s${i}`);
      for (const p of r.phases) if (p.outcome.tryScored) tries++;
    }
    return tries / n;
  };

  it('on marque moins d\'essais sous la pluie que par temps sec', () => {
    const sec = triesPerMatch('SEC');
    const pluie = triesPerMatch('PLUIE');
    // Mesuré à environ un demi-essai de moins par match : lisible sur une
    // rencontre, sans transformer la pluie en interdiction de marquer.
    expect(pluie).toBeLessThan(sec - 0.2);
  });

  it('et encore moins par conditions extrêmes', () => {
    expect(triesPerMatch('EXTREME')).toBeLessThan(triesPerMatch('PLUIE'));
  });

  it('sans jamais vider le match de son contenu', () => {
    // Un match sous le déluge reste un match : il doit encore s'y marquer des
    // essais, sans quoi la météo cesse d'être une contrainte pour devenir une
    // punition.
    expect(triesPerMatch('EXTREME')).toBeGreaterThan(2);
  });
});
