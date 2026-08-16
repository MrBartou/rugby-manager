/**
 * Le playbook de touche : V0.65.
 *
 * Depuis la V0.8, la touche se règle par une « philosophie » : trois mots, un
 * seul choix pour toute la saison, et le même lancement répété quatre-vingts
 * minutes durant. C'est le contraire de ce qu'est une touche dans ce sport, où
 * l'on dessine des combinaisons, on les nomme, on les répète à l'entraînement,
 * et on les garde pour le moment où elles feront mal.
 *
 * Ce module donne au manager ce carnet : quatre ou cinq combinaisons qu'il
 * compose lui-même, avec trois décisions par combinaison.
 *
 *  - **L'alignement** : sept, cinq, ou une touche réduite. Combien d'hommes on
 *    engage, donc combien l'adversaire peut en opposer.
 *  - **Le sauteur** : devant, au milieu, au fond. Plus on lance loin, plus on
 *    gagne de terrain et plus on risque le ballon.
 *  - **L'option** : maul, ballon rapide vers l'ouvreur, ou peel. Ce qu'on fait
 *    du ballon une fois qu'on l'a.
 *
 * ## Ce qui rend le carnet vivant : il se lit
 *
 * Une combinaison n'a pas de valeur intrinsèque, elle a une valeur **relative à
 * ce que l'adversaire attend**. Jouer soixante-dix pour cent de ses touches au
 * fond avec maul finit par se voir : le dossier d'avant-match adverse le note,
 * les sauteurs se placent en face, et la combinaison qui gagnait tout perd le
 * ballon. C'est ce mécanisme, et lui seul, qui transforme un menu en playbook :
 * sans lui, on trouverait la meilleure combinaison en trois matchs et on ne
 * toucherait plus jamais au carnet.
 *
 * ## La contrainte que le module s'impose
 *
 * **Aucune combinaison ne doit dominer**, et varier ne doit pas être une taxe.
 * Chacune a donc un domaine où elle est la meilleure réponse : la réduite quand
 * on veut sortir vite de son camp, le maul à cinq mètres, le peel contre une
 * défense qui monte. Un playbook dont une ligne est toujours correcte n'est pas
 * un playbook, c'est un réglage optimal qu'on finit par recopier.
 *
 * ## Le point neutre
 *
 * Sans combinaison choisie, tout ce module s'efface : `lineoutModifiers()`
 * renvoie l'identité, et la touche se joue exactement comme en V0.64. La
 * fixture de calibration ne choisit aucune combinaison, ses cibles restent donc
 * valides par construction.
 */

import type { PlayerId } from '../types.js';

// =============================================================================
// Ce qu'on dessine
// =============================================================================

/** Combien d'hommes montent dans l'alignement. */
export type LineoutAlignment = 'SEPT' | 'CINQ' | 'REDUITE';

/** Où part le ballon. */
export type JumperSlot = 'DEVANT' | 'MILIEU' | 'FOND';

/** Ce qu'on fait du ballon une fois capté. */
export type LineoutOption = 'MAUL' | 'OUVREUR' | 'PEEL';

export interface LineoutCall {
  readonly id: string;
  /** Nommée par le manager : c'est ainsi qu'il la reconnaîtra dans le dossier. */
  readonly name: string;
  readonly alignment: LineoutAlignment;
  readonly jumper: JumperSlot;
  readonly option: LineoutOption;
  /**
   * Sauteur désigné, quand le manager en a choisi un.
   *
   * Facultatif : sans lui, le moteur prend le meilleur sauteur disponible au
   * créneau demandé. Le désigner sert à confier la touche à un homme précis,
   * ce qui se paie quand il sort du terrain.
   */
  readonly jumperId?: PlayerId;
}

/** Le carnet, tel qu'il est sauvegardé avec le club. */
export interface Playbook {
  readonly calls: readonly LineoutCall[];
  /** Combinaison jouée par défaut quand aucune n'est appelée. */
  readonly defaultCallId?: string;
}

/**
 * Le nombre de combinaisons qu'un groupe peut vraiment tenir.
 *
 * Cinq. Au-delà, on ne les répète plus assez pour qu'elles fonctionnent, et
 * l'écran devient une liste. En dessous de trois, on se fait lire quoi qu'on
 * fasse, ce qui rend le mécanisme de lecture injouable plutôt qu'intéressant.
 */
export const MAX_CALLS = 5;
export const MIN_CALLS = 3;

/**
 * Le carnet fourni au premier lancement.
 *
 * Trois combinaisons qui couvrent les trois usages : sortir de son camp, faire
 * mal près de la ligne, et jouer vite. Un carnet vide aurait laissé le manager
 * devant un éditeur sans savoir ce qu'on attend de lui, et le premier match se
 * serait joué sans touche dessinée.
 */
export const DEFAULT_PLAYBOOK: Playbook = {
  calls: [
    { id: 'sortie', name: 'Sortie', alignment: 'REDUITE', jumper: 'DEVANT', option: 'OUVREUR' },
    { id: 'rouleau', name: 'Rouleau', alignment: 'SEPT', jumper: 'MILIEU', option: 'MAUL' },
    { id: 'fond', name: 'Fond de touche', alignment: 'CINQ', jumper: 'FOND', option: 'PEEL' },
  ],
  defaultCallId: 'rouleau',
};

// =============================================================================
// Ce qu'une combinaison change
// =============================================================================

export interface LineoutModifiers {
  /** Ajouté à la probabilité de conserver le ballon. */
  readonly cleanWinDelta: number;
  /** Ajouté à la probabilité que la défense contre. */
  readonly stealDelta: number;
  /** Probabilité que la conquête se transforme en maul. */
  readonly maulProb: number;
  readonly maulMeters: readonly [number, number];
  readonly maulTryProb: number;
  /**
   * Ballon rapide : la phase suivante se joue à la main, avec de l'avance.
   * Zéro quand la combinaison ne cherche pas la vitesse.
   */
  readonly quickBallMeters: number;
}

export const NEUTRAL_LINEOUT_MODIFIERS: LineoutModifiers = {
  cleanWinDelta: 0,
  stealDelta: 0,
  maulProb: 0.10,
  maulMeters: [3, 12],
  maulTryProb: 0.01,
  quickBallMeters: 0,
};

/**
 * L'alignement : combien d'hommes, donc combien d'adversaires en face.
 *
 * Sept hommes donnent la meilleure plateforme et la meilleure poussée, mais
 * l'adversaire aligne les siens et conteste. La réduite est presque
 * incontestable, et ne pèse rien une fois le ballon capté.
 */
function alignmentEffect(a: LineoutAlignment): Partial<LineoutModifiers> {
  switch (a) {
    case 'SEPT':
      return { cleanWinDelta: -0.01, stealDelta: +0.02 };
    case 'CINQ':
      return { cleanWinDelta: +0.03, stealDelta: -0.01 };
    case 'REDUITE':
      // Rien à contester : le ballon est capté avant que la défense ne monte.
      // En contrepartie, personne pour pousser derrière.
      return { cleanWinDelta: +0.09, stealDelta: -0.05 };
  }
}

/**
 * Le créneau du sauteur : la longueur du lancer.
 *
 * Devant, le talonneur ne peut presque pas se tromper. Au fond, il lance
 * quinze mètres au-dessus d'une forêt de bras : c'est là qu'on gagne du terrain
 * et c'est là qu'on perd des ballons.
 */
function jumperEffect(j: JumperSlot): Partial<LineoutModifiers> {
  switch (j) {
    case 'DEVANT':
      return { cleanWinDelta: +0.06, stealDelta: -0.02 };
    case 'MILIEU':
      return { cleanWinDelta: 0, stealDelta: 0 };
    case 'FOND':
      return { cleanWinDelta: -0.07, stealDelta: +0.04 };
  }
}

/**
 * L'option : ce qu'on fait du ballon.
 *
 * Le maul avance et peut finir dans l'en-but, mais il ne part pas d'une touche
 * réduite : il faut des hommes pour pousser. Le ballon vers l'ouvreur ne gagne
 * pas de terrain par lui-même, il donne de l'avance à la ligne. Le peel ne
 * rapporte presque rien et ne perd presque jamais.
 */
function optionEffect(o: LineoutOption, a: LineoutAlignment): Partial<LineoutModifiers> {
  switch (o) {
    case 'MAUL':
      if (a === 'REDUITE') {
        // Trois hommes ne poussent pas un maul. On laisse la combinaison
        // exister plutôt que de l'interdire : le manager doit pouvoir se
        // tromper et le lire dans le compte rendu.
        return { maulProb: 0.08, maulMeters: [2, 6], maulTryProb: 0.005 };
      }
      return {
        maulProb: a === 'SEPT' ? 0.52 : 0.34,
        maulMeters: a === 'SEPT' ? [10, 26] : [7, 18],
        maulTryProb: a === 'SEPT' ? 0.07 : 0.04,
      };
    case 'OUVREUR':
      return { maulProb: 0.02, maulMeters: [2, 5], maulTryProb: 0, quickBallMeters: 6 };
    case 'PEEL':
      return { maulProb: 0.14, maulMeters: [3, 9], maulTryProb: 0.01, quickBallMeters: 2 };
  }
}

/**
 * Ce que la combinaison vaut, une fois lue par l'adversaire.
 *
 * `read` vaut 0 quand personne ne l'attend et 1 quand tout le monde sait ce qui
 * arrive. Une combinaison lue perd d'abord sa conquête, puis son maul : on ne
 * la contre pas en devinant, on la contre en se plaçant, et une défense bien
 * placée prend le ballon ou étouffe le maul avant qu'il ne parte.
 */
export function lineoutModifiers(
  call: LineoutCall | undefined,
  read = 0,
): LineoutModifiers {
  if (!call) return NEUTRAL_LINEOUT_MODIFIERS;

  const parts = [
    alignmentEffect(call.alignment),
    jumperEffect(call.jumper),
    optionEffect(call.option, call.alignment),
  ];
  const m = { ...NEUTRAL_LINEOUT_MODIFIERS } as {
    -readonly [K in keyof LineoutModifiers]: LineoutModifiers[K];
  };
  for (const part of parts) {
    if (part.cleanWinDelta !== undefined) m.cleanWinDelta += part.cleanWinDelta;
    if (part.stealDelta !== undefined) m.stealDelta += part.stealDelta;
    if (part.maulProb !== undefined) m.maulProb = part.maulProb;
    if (part.maulMeters !== undefined) m.maulMeters = part.maulMeters;
    if (part.maulTryProb !== undefined) m.maulTryProb = part.maulTryProb;
    if (part.quickBallMeters !== undefined) m.quickBallMeters = part.quickBallMeters;
  }

  const r = Math.max(0, Math.min(1, read));
  if (r > 0) {
    m.cleanWinDelta -= r * 0.14;
    m.stealDelta += r * 0.09;
    m.maulProb *= 1 - r * 0.6;
    m.maulTryProb *= 1 - r * 0.7;
  }

  return m;
}

// =============================================================================
// La lecture : ce que l'adversaire a compris
// =============================================================================

/** Combien de fois chaque combinaison a été appelée, sur la saison. */
export type CallUsage = Readonly<Record<string, number>>;

export function recordCall(usage: CallUsage, callId: string): CallUsage {
  return { ...usage, [callId]: (usage[callId] ?? 0) + 1 };
}

export function usageShare(usage: CallUsage, callId: string): number {
  const total = Object.values(usage).reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;
  return (usage[callId] ?? 0) / total;
}

/**
 * En dessous de ce nombre de touches jouées, personne ne peut rien conclure.
 *
 * Six, soit deux matchs. Sans ce seuil, la première touche de la saison aurait
 * une part d'usage de cent pour cent et serait donc « lue » d'entrée : le
 * mécanisme punirait le manager avant même qu'il ait pu répéter quoi que ce
 * soit.
 */
export const READ_MIN_SAMPLE = 6;

/**
 * À quel point l'adversaire attend cette combinaison.
 *
 * Deux facteurs qui se multiplient, et c'est important qu'ils se multiplient :
 * une équipe qui ne prépare pas ses matchs ne lit rien, même une combinaison
 * jouée neuf fois sur dix ; et une équipe très bien préparée ne lit rien non
 * plus si l'on varie. La lecture est le produit d'une répétition et d'un
 * travail, jamais de l'un des deux seul.
 */
export function readLevel(input: {
  readonly usage: CallUsage;
  readonly callId: string;
  /** Qualité de préparation de l'adversaire, 0 à 1. */
  readonly opponentPreparation: number;
}): number {
  const total = Object.values(input.usage).reduce((sum, n) => sum + n, 0);
  if (total < READ_MIN_SAMPLE) return 0;

  const share = usageShare(input.usage, input.callId);
  // En dessous d'un tiers, on varie assez pour rester imprévisible : c'est le
  // seuil qui donne au carnet de trois combinaisons sa raison d'être.
  const excess = Math.max(0, share - 0.34) / 0.66;
  const prep = Math.max(0, Math.min(1, input.opponentPreparation));
  return Math.min(1, excess * prep);
}

/**
 * La combinaison la plus jouée, et sa part.
 *
 * Sert au dossier d'avant-match, des deux côtés : ce que l'adversaire a repéré
 * chez nous, et ce que notre analyse a repéré chez lui.
 */
export function favouriteCall(usage: CallUsage): { readonly callId: string; readonly share: number } | undefined {
  const entries = Object.entries(usage);
  if (entries.length === 0) return undefined;
  const [callId, count] = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  const total = entries.reduce((sum, e) => sum + e[1], 0);
  if (total === 0 || count === 0) return undefined;
  return { callId, share: count / total };
}

// =============================================================================
// Choisir une combinaison en cours de match
// =============================================================================

/**
 * Quelle combinaison le moteur appelle pour cette touche.
 *
 * Le manager dessine le carnet, il n'appelle pas chaque touche : ce serait
 * quatorze fenêtres par match. C'est donc ici que le choix se fait, et il se
 * fait sur la position sur le terrain, parce que c'est ainsi qu'on choisit une
 * touche.
 *
 *  - dans ses vingt-deux mètres, on sort : réduite et ballon joué ;
 *  - dans les vingt-deux adverses, on va chercher l'essai : maul ;
 *  - entre les deux, on prend celle que le manager a désignée par défaut.
 *
 * Un tirage au sort aurait produit un maul à cinq mètres de sa propre ligne,
 * c'est-à-dire une décision que personne ne prend.
 */
export function callForSituation(input: {
  readonly playbook: Playbook;
  /** Position du ballon, 0 = ligne d'en-but de l'attaquant, 100 = celle de l'adversaire. */
  readonly fieldPosition: number;
}): LineoutCall | undefined {
  const { calls } = input.playbook;
  if (calls.length === 0) return undefined;

  const byId = (id: string | undefined): LineoutCall | undefined =>
    (id ? calls.find(c => c.id === id) : undefined);

  if (input.fieldPosition <= 22) {
    const sortie = calls.find(c => c.alignment === 'REDUITE')
      ?? calls.find(c => c.option === 'OUVREUR');
    if (sortie) return sortie;
  }
  if (input.fieldPosition >= 78) {
    const finition = calls.find(c => c.option === 'MAUL' && c.alignment !== 'REDUITE');
    if (finition) return finition;
  }
  return byId(input.playbook.defaultCallId) ?? calls[0];
}

/** Un carnet valide : entre trois et cinq combinaisons, aux identifiants uniques. */
export function validatePlaybook(playbook: Playbook): { readonly ok: boolean; readonly reason?: string } {
  const { calls } = playbook;
  if (calls.length < MIN_CALLS) {
    return { ok: false, reason: `Il faut au moins ${MIN_CALLS} combinaisons : avec moins, vous serez lu quoi que vous fassiez.` };
  }
  if (calls.length > MAX_CALLS) {
    return { ok: false, reason: `Au-delà de ${MAX_CALLS}, le groupe ne les répète plus assez pour qu'elles fonctionnent.` };
  }
  const ids = new Set(calls.map(c => c.id));
  if (ids.size !== calls.length) return { ok: false, reason: 'Deux combinaisons portent le même identifiant.' };
  if (calls.some(c => c.name.trim().length === 0)) {
    return { ok: false, reason: 'Une combinaison sans nom ne se rappelle pas sur le terrain.' };
  }
  return { ok: true };
}
