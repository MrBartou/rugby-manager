/**
 * Rollover de saison — V0.6 phase 1.
 *
 * Fonction pure : à la fin d'une saison N, prépare l'effectif pour la saison N+1.
 *  - reset de l'état dynamique (forme/fatigue/mood/blessures)
 *  - retraites (forcée à 38+, probabiliste 35-37 si niveau bas)
 *
 * Hors scope V0.6 :
 *  - vieillissement des stats (V0.7)
 *  - promotion de jeunes (V0.7)
 *  - renouvellement automatique de contrat (Phase 3)
 */

import { createRng } from '../rng.js';
import { expireContracts } from '../club/contracts.js';
import { applyAgingToAll } from './aging.js';
import {
  developSquad,
  type CoachingQuality,
  type DevelopmentReport,
  type TrainingFocus,
} from '../club/development.js';
import type { Club, ClubId, Player, PlayerId } from '../types.js';
import type { AcademyFocus } from '../club/academy.js';

export interface RolloverInput {
  /** Tous les joueurs (tous clubs confondus) avant rollover. */
  readonly players: readonly Player[];
  /** Saison qui vient de se terminer. La nouvelle saison sera currentSeason + 1. */
  readonly currentSeason: number;
  /** Seed pour les décisions probabilistes (retraites 35-37). */
  readonly seed: string;
  /**
   * V0.14 — entrées de développement. Si présentes, les attributs évoluent selon
   * le temps de jeu, l'entraînement et le staff (`club/development.ts`) plutôt que
   * par la seule courbe d'âge. Absentes, on retombe sur le vieillissement V0.7.
   */
  readonly development?: {
    readonly minutesByPlayer: ReadonlyMap<PlayerId, number>;
    readonly focusByPlayer: ReadonlyMap<PlayerId, TrainingFocus>;
    readonly coachingByClub: ReadonlyMap<string, CoachingQuality>;
  };
}

export interface RolloverResult {
  /** Joueurs après rollover. Les retraités sont conservés avec retired=true. */
  readonly players: readonly Player[];
  /** Liste des joueurs ayant pris leur retraite cette saison. */
  readonly retired: readonly PlayerId[];
  /** Liste des joueurs devenus libres (contrat expiré non renouvelé). */
  readonly freeAgents: readonly PlayerId[];
  /** Saison à venir (currentSeason + 1). */
  readonly newSeason: number;
  /**
   * V0.14 — rapports de progression, uniquement pour les joueurs ayant évolué.
   * Vide si le développement n'a pas été fourni en entrée.
   */
  readonly developmentReports: readonly DevelopmentReport[];
}

/** Âge à partir duquel la retraite est forcée. */
const FORCED_RETIREMENT_AGE = 38;
/** Âge à partir duquel la retraite peut se déclencher en fonction du niveau. */
const PROBABLE_RETIREMENT_MIN_AGE = 35;
/** Overall en dessous duquel un joueur de 35-37 ans risque la retraite. */
const LOW_LEVEL_THRESHOLD = 60;

/**
 * Calcule l'overall d'un joueur (moyenne grossière, sans pondération par poste).
 * Utilisé uniquement par le rollover pour décider d'une retraite probabiliste.
 */
function approximateOverall(p: Player): number {
  const t = p.technical;
  const ph = p.physical;
  const m = p.mental;
  const techAvg = (t.passe + t.plaquage + t.visionDeJeu + t.conservation + t.deblayage) / 5;
  const physAvg = (ph.vitesse + ph.puissance + ph.endurance + ph.robustesse) / 4;
  const mentAvg = (m.decision + m.sangFroid + m.professionnalisme) / 3;
  return (techAvg + physAvg + mentAvg) / 3;
}

function ageFromBirthDate(birthDate: string, season: number): number {
  const year = Number(birthDate.slice(0, 4));
  return season - year;
}

export function rolloverSeason(input: RolloverInput): RolloverResult {
  const newSeason = input.currentSeason + 1;
  const rng = createRng(`${input.seed}_rollover_${newSeason}`);
  const retired: PlayerId[] = [];

  const players = input.players.map<Player>((p) => {
    if (p.retired) return p;

    const age = ageFromBirthDate(p.birthDate, newSeason);
    let mustRetire = false;
    if (age >= FORCED_RETIREMENT_AGE) {
      mustRetire = true;
    } else if (age >= PROBABLE_RETIREMENT_MIN_AGE) {
      const overall = approximateOverall(p);
      if (overall < LOW_LEVEL_THRESHOLD) {
        // Probabilité croissante avec l'âge : 35→25%, 36→45%, 37→70%
        const probabilityByAge: Record<number, number> = { 35: 0.25, 36: 0.45, 37: 0.7 };
        const p35 = probabilityByAge[age] ?? 0;
        if (rng.nextBool(p35)) mustRetire = true;
      }
    }

    if (mustRetire) {
      retired.push(p.id);
      return {
        ...p,
        retired: true,
        retirementSeason: newSeason,
        dynamic: { forme: 0, fatigue: 0, mood: 0, moodModifiers: [] },
      };
    }

    // Reset état dynamique pour démarrer la nouvelle saison frais
    return {
      ...p,
      dynamic: {
        forme: 70,
        fatigue: 0,
        mood: 60,
        moodModifiers: [],
      },
    };
  });

  // Phase 3 V0.6 — flag freeAgent les contrats expirés
  const expired = expireContracts(players, newSeason);

  // V0.14 — développement piloté par le temps de jeu, l'entraînement et le staff.
  // Sans ces entrées (tests unitaires, anciennes sauvegardes), on conserve le
  // vieillissement V0.7 par courbe d'âge seule.
  if (input.development) {
    const developed = developSquad({
      players: expired.players,
      newSeason,
      seed: input.seed,
      minutesByPlayer: input.development.minutesByPlayer,
      focusByPlayer: input.development.focusByPlayer,
      coachingByClub: input.development.coachingByClub,
    });
    return {
      players: developed.players,
      retired,
      freeAgents: expired.freeAgents,
      newSeason,
      developmentReports: developed.reports,
    };
  }

  const aged = applyAgingToAll(expired.players, newSeason, input.seed);
  return {
    players: aged,
    retired,
    freeAgents: expired.freeAgents,
    newSeason,
    developmentReports: [],
  };
}

// =============================================================================
// La promotion des jeunes, division par division
// =============================================================================

/**
 * Ce que chaque centre de formation sort cette année : V0.62.
 *
 * La boucle vivait dans `App.tsx`. Elle décide qui entre dans le monde du jeu,
 * pour les deux divisions, et deux règles s'y cachaient au milieu du câblage :
 *
 * - **tous les clubs reçoivent leur promotion**, pas seulement celui qu'on
 *   dirige. Le vieillissement et les retraites frappent tout le monde ; une
 *   division qui perdrait des joueurs chaque saison sans jamais en recevoir
 *   serait exsangue en quelques années, et la remontée se jouerait contre des
 *   fantômes. C'est le défaut corrigé en V0.60 ;
 * - **le centre du club dirigé suit son investissement**, les clubs gérés par
 *   la machine gardent le niveau dicté par leur taille. Sans quoi le centre de
 *   formation ne serait qu'un poste de dépense sans effet.
 *
 * Les identifiants déjà pris circulent d'un club à l'autre : deux centres ne
 * peuvent pas sortir le même joueur.
 */
export interface YouthIntakeInput {
  readonly clubs: readonly Club[];
  readonly playerClubId: ClubId;
  readonly newSeason: number;
  readonly seed: string;
  /** Identifiants déjà utilisés, joueurs d'après rollover compris. */
  readonly existingPlayerIds: ReadonlySet<string>;
  /** Niveau et orientation du centre du club dirigé. */
  readonly playerAcademy: { readonly level: number; readonly focus?: AcademyFocus };
  /** Niveau de centre d'un club géré par la machine. */
  readonly defaultAcademyLevel: (club: Club) => number;
  readonly generate: (args: {
    readonly club: Club;
    readonly currentSeason: number;
    readonly academyLevel: number;
    readonly focus?: AcademyFocus;
    readonly seed: string;
    readonly existingPlayerIds: ReadonlySet<string>;
  }) => readonly Player[];
}

export interface YouthIntakeResult {
  /** Tous les jeunes promus, tous clubs confondus. */
  readonly all: readonly Player[];
  /** Ceux du club dirigé, que l'interface annonce nommément. */
  readonly forPlayerClub: readonly Player[];
}

export function planYouthIntake(input: YouthIntakeInput): YouthIntakeResult {
  const pris = new Set(input.existingPlayerIds);
  const all: Player[] = [];
  let forPlayerClub: readonly Player[] = [];

  for (const club of input.clubs) {
    const isMine = club.id === input.playerClubId;
    const intake = input.generate({
      club,
      currentSeason: input.newSeason,
      academyLevel: isMine
        ? Math.round(input.playerAcademy.level)
        : input.defaultAcademyLevel(club),
      ...(isMine && input.playerAcademy.focus ? { focus: input.playerAcademy.focus } : {}),
      seed: `${input.seed}_youth_${input.newSeason}`,
      existingPlayerIds: pris,
    });

    for (const p of intake) pris.add(p.id as string);
    all.push(...intake);
    if (isMine) forPlayerClub = intake;
  }

  return { all, forPlayerClub };
}
