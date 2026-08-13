/**
 * La suite statistique que l'intégration continue attendait : V0.61.
 *
 * `.github/workflows/ci.yml` lance `npm run test:simulate` sur chaque pull
 * request, avec `SIMULATION_MATCH_COUNT: 10000`. Ce dossier n'a jamais existé,
 * et la variable n'était lue nulle part : le job échouait sur « No test files
 * found » depuis le tout premier commit, à chaque pull request, sans que
 * personne ne regarde. C'est le défaut maison du projet, cette fois dans le
 * pipeline : écrit, jamais branché.
 *
 * ## Ce qu'elle vérifie, et à quelle précision
 *
 * Les mêmes cibles que le harnais de calibration, lues au même endroit
 * ([calibration-targets.ts](../../src/engine/match/calibration-targets.ts)),
 * mais sur un échantillon qui varie avec la machine qui l'exécute : deux cents
 * matchs en local, mille sur chaque poussée, dix mille sur une pull request.
 *
 * D'où la règle qui gouverne tout le fichier, et qui est celle du projet depuis
 * la v0.51 : **ne jamais affirmer un écart plus petit que le bruit**. Chaque
 * borne est élargie de deux erreurs types calculées sur la taille réelle de
 * l'échantillon. Un test qui passerait à dix mille matchs et échouerait à deux
 * cents ne prouverait rien sur le moteur, seulement sur la patience de la
 * machine.
 */

import { describe, expect, it } from 'vitest';
import { simulateMatch } from '@/engine/match/simulate.js';
import {
  CALIBRATION_SCENARIOS,
  CALIBRATION_TARGETS as T,
  type CalibrationTarget,
} from '@/engine/match/calibration-targets.js';
import { rateMatch } from '@/engine/match/player-rating.js';
import { makeMatchInput } from '../engine/fixtures.js';
import type { Player } from '@/engine/types.js';

/**
 * L'environnement, déclaré au minimum.
 *
 * `@types/node` n'est pas une dépendance du projet et `tsconfig.json` ne couvre
 * que `src` et `tests` : `tools/calibrate.ts` lit `process.argv` sans que rien
 * ne le vérifie. Cette suite n'a besoin que d'une variable, autant en déclarer
 * la forme exacte plutôt que d'ajouter une dépendance pour une ligne.
 */
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

/**
 * Taille de l'échantillon.
 *
 * Deux cents par défaut pour que `npm run test` reste rapide en local ; la
 * variable d'environnement prend le relais en intégration continue.
 */
const N = (() => {
  const brut = Number(process.env.SIMULATION_MATCH_COUNT ?? 200);
  return Number.isFinite(brut) && brut >= 100 ? Math.floor(brut) : 200;
})();

// =============================================================================
// Le bruit, calculé plutôt que supposé
// =============================================================================

/** Erreur type d'une proportion : la précision qu'on peut honnêtement exiger. */
const seProportion = (p: number): number => Math.sqrt((p * (1 - p)) / N);

/** Erreur type d'une moyenne, à partir de l'écart-type observé. */
const seMoyenne = (ecartType: number): number => ecartType / Math.sqrt(N);

/**
 * Vérifie une valeur contre une cible, tolérance comprise.
 *
 * La tolérance vaut deux erreurs types : au-delà, l'écart n'est plus du bruit
 * d'échantillonnage et le moteur a réellement dérivé.
 */
function dansLaCible(
  valeur: number,
  cible: CalibrationTarget,
  erreurType: number,
  libelle: string,
): void {
  const marge = 2 * erreurType;
  if (cible.min !== undefined) {
    expect(valeur, `${libelle} (n=${N}, marge ±${marge.toFixed(3)})`)
      .toBeGreaterThanOrEqual(cible.min - marge);
  }
  if (cible.max !== undefined) {
    expect(valeur, `${libelle} (n=${N}, marge ±${marge.toFixed(3)})`)
      .toBeLessThanOrEqual(cible.max + marge);
  }
}

const moyenne = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

const ecartType = (xs: readonly number[]): number => {
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};

// =============================================================================
// Les deux scénarios de référence, simulés une fois pour toutes
// =============================================================================

interface Echantillon {
  readonly tries: readonly number[];
  readonly phases: readonly number[];
  readonly pointsTotal: readonly number[];
  readonly notes: readonly number[];
  readonly homeWins: number;
  readonly draws: number;
  readonly possessionHome: number;
  readonly possessionAway: number;
  readonly placeKickAttempts: number;
  readonly placeKickMakes: number;
  readonly capParPhases: number;
}

function simuler(homeNiveau: number, awayNiveau: number, prefixe: string): Echantillon {
  const tries: number[] = [];
  const phases: number[] = [];
  const pointsTotal: number[] = [];
  const notes: number[] = [];
  let homeWins = 0;
  let draws = 0;
  let possessionHome = 0;
  let possessionAway = 0;
  let placeKickAttempts = 0;
  let placeKickMakes = 0;
  let capParPhases = 0;

  for (let i = 0; i < N; i++) {
    const input = makeMatchInput({ homeNiveau, awayNiveau, matchId: `${prefixe}_${i}` });
    const r = simulateMatch(input, `${prefixe}_${i}`);

    tries.push(
      r.phases.filter(p => p.outcome.tryScored === 'HOME').length
      + r.phases.filter(p => p.outcome.tryScored === 'AWAY').length,
    );
    phases.push(r.phases.length);
    pointsTotal.push(r.homeScore + r.awayScore);
    if (r.homeScore > r.awayScore) homeWins++;
    if (r.homeScore === r.awayScore) draws++;
    if (r.phases.length >= 250) capParPhases++;

    for (const p of r.phases) {
      if (p.state.possession === 'HOME') possessionHome++;
      else if (p.state.possession === 'AWAY') possessionAway++;
    }

    for (const stat of r.individualStats.values()) {
      placeKickAttempts += stat.placeKicks.attempted;
      placeKickMakes += stat.placeKicks.made;
    }

    // La note du joueur fait partie de ce que le moteur produit depuis la
    // V0.61 : elle a droit au même contrôle de distribution que le reste.
    const camp = (side: 'home' | 'away'): readonly Player[] =>
      [...input[side].squad.starters, ...input[side].squad.substitutes]
        .map(e => input.playersById.get(e.playerId))
        .filter((p): p is Player => p !== undefined);
    const diff = r.homeScore - r.awayScore;
    const { byPlayer } = rateMatch([
      { players: camp('home'), pointsDifference: diff },
      { players: camp('away'), pointsDifference: -diff },
    ], r.individualStats);
    for (const note of byPlayer.values()) notes.push(note.rating);
  }

  return {
    tries, phases, pointsTotal, notes, homeWins, draws,
    possessionHome, possessionAway, placeKickAttempts, placeKickMakes, capParPhases,
  };
}

const equilibre = simuler(
  CALIBRATION_SCENARIOS.balanced.home, CALIBRATION_SCENARIOS.balanced.away, 'sim_eq',
);
const ecart = simuler(
  CALIBRATION_SCENARIOS.skewed.home, CALIBRATION_SCENARIOS.skewed.away, 'sim_ec',
);

// =============================================================================
// Scénario équilibré
// =============================================================================

describe(`deux équipes de même niveau (n=${N})`, () => {
  it('marquent le bon nombre d\'essais', () => {
    dansLaCible(
      moyenne(equilibre.tries), T.triesPerMatch,
      seMoyenne(ecartType(equilibre.tries)), 'essais par match',
    );
  });

  it('sans que la dispersion parte en vrille', () => {
    // Un moteur qui produirait 0 ou 12 essais un match sur deux tomberait dans
    // la bonne moyenne tout en ne ressemblant à rien.
    dansLaCible(ecartType(equilibre.tries), T.triesStdDev, 0.1, 'écart-type des essais');
  });

  it('jouent le bon nombre de phases', () => {
    dansLaCible(
      moyenne(equilibre.phases), T.phasesPerMatch,
      seMoyenne(ecartType(equilibre.phases)), 'phases par match',
    );
  });

  it('inscrivent le bon total de points', () => {
    dansLaCible(
      moyenne(equilibre.pointsTotal), T.totalPointsBalanced,
      seMoyenne(ecartType(equilibre.pointsTotal)), 'points cumulés',
    );
  });

  it('réussissent leurs tirs au but dans la bonne proportion', () => {
    const taux = equilibre.placeKickMakes / equilibre.placeKickAttempts;
    dansLaCible(taux, T.placeKickRate, seProportion(taux), 'réussite au pied');
  });

  it('se partagent la possession', () => {
    const part = equilibre.possessionHome / (equilibre.possessionHome + equilibre.possessionAway);
    dansLaCible(part, T.possessionBalanced, seProportion(part), 'possession HOME');
  });

  it('et le terrain pèse sans décider', () => {
    // L'avantage du terrain existe et reste une inclinaison : au-delà, le
    // championnat se jouerait au calendrier.
    const taux = equilibre.homeWins / N;
    dansLaCible(taux, T.homeWinRateBalanced, seProportion(taux), 'victoires à domicile');
  });

  it('sans multiplier les matchs nuls', () => {
    const taux = equilibre.draws / N;
    dansLaCible(taux, T.drawRate, seProportion(taux), 'matchs nuls');
  });
});

// =============================================================================
// Scénario avec écart de niveau
// =============================================================================

describe(`une équipe nettement plus forte (n=${N})`, () => {
  it('gagne souvent, pas toujours', () => {
    // Le rugby n'est pas déterministe : une cible haute à 100 % ferait du
    // championnat une formalité, et il n'y aurait plus rien à jouer.
    const taux = ecart.homeWins / N;
    dansLaCible(taux, T.strongWinRateGap, seProportion(taux), 'victoires de la forte');
  });

  it('sans confisquer le ballon', () => {
    const partFaible = ecart.possessionAway / (ecart.possessionHome + ecart.possessionAway);
    dansLaCible(partFaible, T.possessionGap, seProportion(partFaible), 'possession de la faible');
  });
});

// =============================================================================
// Ce que la simulation ne doit jamais faire
// =============================================================================

describe('les garde-fous du moteur', () => {
  it('aucun match n\'est coupé par le plafond de phases', () => {
    // Le plafond existe contre une boucle infinie. S'il coupe une rencontre,
    // le score est faux sans être aberrant, et rien ne le signalerait.
    expect(equilibre.capParPhases + ecart.capParPhases).toBe(0);
  });

  it('la note du joueur garde sa médiane à six', () => {
    // La note est un rang dans la distribution de son poste : sa médiane est
    // la définition même de l'échelle, pas un réglage cosmétique.
    const triees = [...equilibre.notes].sort((a, b) => a - b);
    const mediane = triees[Math.floor(triees.length / 2)]!;
    expect(mediane).toBeGreaterThanOrEqual(5.5);
    expect(mediane).toBeLessThanOrEqual(6.5);
  });

  it('et personne n\'atteint jamais dix', () => {
    // `Math.max(...notes)` passe la barre des cent mille arguments dès que
    // l'échantillon grossit, et fait déborder la pile d'appels. Vu en lançant
    // la suite à la taille réelle de l'intégration continue, jamais à deux
    // cents matchs : une borne supérieure se calcule, elle ne s'étale pas.
    const plusHaute = [...equilibre.notes, ...ecart.notes]
      .reduce((max, n) => (n > max ? n : max), 0);
    expect(plusHaute).toBeLessThan(10);
  });
});
