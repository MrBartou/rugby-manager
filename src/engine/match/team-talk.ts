/**
 * La causerie — V0.45.
 *
 * Un moment de mi-temps existait depuis V0.13, mais c'était une **bascule
 * tactique** : pousser, conserver, verrouiller. Les mêmes trois options qu'on
 * mène de trente points ou qu'on se fasse démolir, aucun mot adressé au groupe,
 * et pas le moindre effet sur des hommes.
 *
 * Or le vestiaire de la pause est le seul moment du métier où l'on parle à
 * quinze personnes qui viennent de vivre quarante minutes. C'est un acte de
 * management, pas un réglage.
 *
 * ## Ce qui décide de la réaction
 *
 * Trois choses, et leur conjonction est tout l'intérêt :
 *
 *  - **la situation** : un coup de gueule sur une équipe qui mène largement
 *    passe pour de l'injustice ; sur une équipe en train de sombrer, il réveille ;
 *  - **le tempérament du groupe** : un vestiaire au moral bas encaisse mal la
 *    dureté, un vestiaire expérimenté relativise ;
 *  - **le hasard**, en dernier ressort — une causerie n'est jamais une formule.
 *
 * Une causerie peut donc **se retourner**. C'est ce qui la distingue d'un bonus
 * qu'on choisit : on prend un risque sur des hommes.
 */

import type { Rng } from '../rng.js';

// =============================================================================
// La situation
// =============================================================================

export type MatchSituation =
  /** On domine largement. */
  | 'LARGE_AVANCE'
  | 'PETITE_AVANCE'
  | 'SERRE'
  | 'PETIT_RETARD'
  /** On est en train de sombrer. */
  | 'LARGE_RETARD';

export function situationFor(scoreDiff: number): MatchSituation {
  if (scoreDiff >= 15) return 'LARGE_AVANCE';
  if (scoreDiff >= 4) return 'PETITE_AVANCE';
  if (scoreDiff > -4) return 'SERRE';
  if (scoreDiff > -15) return 'PETIT_RETARD';
  return 'LARGE_RETARD';
}

export const SITUATION_LABEL: Readonly<Record<MatchSituation, string>> = {
  LARGE_AVANCE: 'Vous menez largement',
  PETITE_AVANCE: 'Vous menez de peu',
  SERRE: 'Tout reste à faire',
  PETIT_RETARD: 'Vous courez après le score',
  LARGE_RETARD: 'Vous prenez l\'eau',
};

// =============================================================================
// Les tons
// =============================================================================

export type TalkTone = 'CALME' | 'CONFIANCE' | 'EXIGEANT' | 'COUP_DE_GUEULE';

export const TONE_LABEL: Readonly<Record<TalkTone, string>> = {
  CALME: 'Poser les choses',
  CONFIANCE: 'Rassurer le groupe',
  EXIGEANT: 'Hausser le niveau d\'exigence',
  COUP_DE_GUEULE: 'Coup de gueule',
};

export const TONE_DESCRIPTION: Readonly<Record<TalkTone, string>> = {
  CALME: 'Trois consignes claires, sans emballement.',
  CONFIANCE: 'Rappeler ce qui marche et remettre les têtes à l\'endroit.',
  EXIGEANT: 'Nommer ce qui n\'a pas été fait et demander mieux.',
  COUP_DE_GUEULE: 'Hausser le ton. Ça passe ou ça casse.',
};

/**
 * Justesse d'un ton dans une situation donnée, de -2 à +2.
 *
 * C'est le cœur du module. Une table plutôt qu'une formule : les cas sont peu
 * nombreux, et chacun se raisonne — un coup de gueule quand on mène de trente
 * points est une injustice, pas une exigence.
 */
const FIT: Readonly<Record<TalkTone, Readonly<Record<MatchSituation, number>>>> = {
  CALME: {
    LARGE_AVANCE: 2, PETITE_AVANCE: 1, SERRE: 1, PETIT_RETARD: 0, LARGE_RETARD: -1,
  },
  CONFIANCE: {
    LARGE_AVANCE: 0, PETITE_AVANCE: 1, SERRE: 1, PETIT_RETARD: 2, LARGE_RETARD: 1,
  },
  EXIGEANT: {
    // Mener de peu est précisément le moment où l'on ne doit pas se relâcher :
    // sans ce 2, cette situation n'avait aucune bonne réponse, ce qui rendait la
    // mi-temps arbitraire une fois sur cinq.
    LARGE_AVANCE: 1, PETITE_AVANCE: 2, SERRE: 2, PETIT_RETARD: 1, LARGE_RETARD: 0,
  },
  COUP_DE_GUEULE: {
    LARGE_AVANCE: -2, PETITE_AVANCE: -1, SERRE: 0, PETIT_RETARD: 1, LARGE_RETARD: 2,
  },
};

export function toneFit(tone: TalkTone, situation: MatchSituation): number {
  return FIT[tone][situation];
}

// =============================================================================
// Le vestiaire
// =============================================================================

export interface DressingRoom {
  /** Moral moyen du XV sur le terrain, 0-100. */
  readonly mood: number;
  /** Leadership moyen : un groupe expérimenté relativise. */
  readonly leadership: number;
  /** Sang-froid moyen : encaisse-t-il la dureté ? */
  readonly composure: number;
}

// =============================================================================
// Résolution
// =============================================================================

export interface TalkOutcome {
  readonly tone: TalkTone;
  /** Variation de moral du groupe, en points. */
  readonly moodDelta: number;
  /** Bonus tactique pour la seconde période. */
  readonly tacticalBonus: number;
  /** Vrai quand la causerie a produit l'inverse de l'effet recherché. */
  readonly backfired: boolean;
  /** Ce qu'on retient de la scène, pour le récit. */
  readonly narrative: string;
}

/**
 * Résout une causerie.
 *
 * La probabilité de retournement dépend de l'écart entre le ton et la
 * situation, tempérée par le sang-froid du groupe. Un ton juste ne se retourne
 * quasiment jamais ; un ton injuste dans un vestiaire fragile, souvent.
 */
export function resolveTalk(input: {
  readonly tone: TalkTone;
  readonly situation: MatchSituation;
  readonly room: DressingRoom;
  readonly rng: Rng;
}): TalkOutcome {
  const fit = toneFit(input.tone, input.situation);
  const { room } = input;

  // Un groupe au moral haut et posé encaisse mieux un ton mal choisi.
  const resilience = (room.composure * 0.6 + room.mood * 0.4) / 100;
  const backfireRisk = fit >= 1
    ? 0.03
    : Math.min(0.65, (1 - fit) * 0.18 * (1.6 - resilience));

  const backfired = input.rng.nextBool(backfireRisk);

  if (backfired) {
    // Le retournement est proportionnel à la dureté du ton : une causerie calme
    // qui tombe à plat démobilise, un coup de gueule mal reçu casse le groupe.
    const severity = input.tone === 'COUP_DE_GUEULE' ? 2.2 : input.tone === 'EXIGEANT' ? 1.4 : 1;
    return {
      tone: input.tone,
      moodDelta: Math.round(-5 * severity),
      tacticalBonus: -Math.round(1.5 * severity * 10) / 10,
      backfired: true,
      narrative: backfireNarrative(input.tone, input.situation),
    };
  }

  // Le leadership du groupe amplifie ce qui a été dit : une causerie porte
  // d'autant plus qu'il y a des relais sur le terrain.
  const relay = 0.8 + (room.leadership / 100) * 0.5;
  const moodDelta = Math.round((2 + fit * 3) * relay);
  const tacticalBonus = Math.round((fit * 1.6) * relay * 10) / 10;

  return {
    tone: input.tone,
    moodDelta,
    tacticalBonus,
    backfired: false,
    narrative: successNarrative(input.tone, input.situation, fit),
  };
}

function successNarrative(tone: TalkTone, situation: MatchSituation, fit: number): string {
  if (fit >= 2) {
    return tone === 'COUP_DE_GUEULE'
      ? 'Le vestiaire encaisse en silence, puis se lève. Le message est passé.'
      : 'Les têtes se relèvent. On sait ce qu\'il y a à faire.';
  }
  if (fit >= 1) return 'Les consignes sont entendues, le groupe repart concentré.';
  if (situation === 'LARGE_AVANCE') return 'Personne ne semble croire à un danger.';
  return 'Le message passe à moitié. On verra sur le terrain.';
}

function backfireNarrative(tone: TalkTone, situation: MatchSituation): string {
  if (tone === 'COUP_DE_GUEULE') {
    return situation === 'LARGE_AVANCE'
      ? 'Les joueurs échangent des regards : ils menaient, ils ne comprennent pas.'
      : 'Le ton est mal passé. Deux cadres décrochent.';
  }
  if (tone === 'EXIGEANT') return 'Le groupe se braque. On sort du vestiaire crispé.';
  return 'La causerie tombe à plat. Rien ne se passe.';
}

/**
 * Ce qu'on annonce avant de parler.
 *
 * Le manager doit sentir le risque sans connaître le résultat : on qualifie,
 * on ne chiffre pas. Donner la probabilité exacte ferait de la causerie un
 * calcul, alors que c'est un pari sur des hommes.
 */
export function toneHint(tone: TalkTone, situation: MatchSituation): string {
  const fit = toneFit(tone, situation);
  if (fit >= 2) return 'Le moment s\'y prête parfaitement.';
  if (fit === 1) return 'Cela devrait bien passer.';
  if (fit === 0) return 'Réaction incertaine.';
  if (fit === -1) return 'Risqué dans ce contexte.';
  return 'Le groupe ne comprendrait pas.';
}
