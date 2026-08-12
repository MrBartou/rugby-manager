/**
 * Banc actif et fatigue individuelle — V0.13.
 *
 * Jusqu'ici le moteur portait une fatigue *scalaire par équipe* et les 8 remplaçants
 * de la feuille de match n'étaient jamais utilisés (cf. session.ts, "pas de bench actif").
 * Ce module remplace ça par :
 *
 *  - une fatigue **par joueur**, modulée par l'endurance et par le rôle dans la phase
 *  - un effectif sur le terrain **mutable** (pack / lignes arrières / buteur)
 *  - un banc consommable avec les règles de World Rugby : 8 remplacements max,
 *    pas de retour d'un joueur sorti, et première ligne spécialiste obligatoire
 *    sous peine de **mêlées simulées**
 *  - une politique de remplacement automatique déterministe (IA + option par défaut)
 *
 * Le module est pur : aucune dépendance hors `engine/`, pas de Math.random, pas de Date.
 */

import type { Player, PlayerId, Position } from '../types.js';
import type { PhaseType, RosterEntry } from './types.js';

// =============================================================================
// Groupes de postes
// =============================================================================

export type PositionGroup =
  | 'FRONT_ROW'
  | 'SECOND_ROW'
  | 'BACK_ROW'
  | 'SCRUM_HALF'
  | 'FLY_HALF'
  | 'CENTRE'
  | 'BACK_THREE';

const GROUP_BY_POSITION: Readonly<Record<Position, PositionGroup>> = {
  PILIER_GAUCHE: 'FRONT_ROW',
  TALONNEUR: 'FRONT_ROW',
  PILIER_DROIT: 'FRONT_ROW',
  DEUXIEME_LIGNE_GAUCHE: 'SECOND_ROW',
  DEUXIEME_LIGNE_DROITE: 'SECOND_ROW',
  TROISIEME_LIGNE_AILE_GAUCHE: 'BACK_ROW',
  TROISIEME_LIGNE_AILE_DROITE: 'BACK_ROW',
  NUMERO_8: 'BACK_ROW',
  DEMI_DE_MELEE: 'SCRUM_HALF',
  OUVREUR: 'FLY_HALF',
  CENTRE_INTERIEUR: 'CENTRE',
  CENTRE_EXTERIEUR: 'CENTRE',
  AILIER_GAUCHE: 'BACK_THREE',
  AILIER_DROIT: 'BACK_THREE',
  ARRIERE: 'BACK_THREE',
};

export function groupOf(position: Position): PositionGroup {
  return GROUP_BY_POSITION[position];
}

/** Postes d'avants (les 8 du pack). */
export const FORWARD_GROUPS: ReadonlySet<PositionGroup> = new Set<PositionGroup>([
  'FRONT_ROW', 'SECOND_ROW', 'BACK_ROW',
]);

export function isForwardPosition(position: Position): boolean {
  return FORWARD_GROUPS.has(groupOf(position));
}

/**
 * Groupes qu'un joueur peut couvrir en remplacement.
 * On accepte le groupe naturel, ceux de ses postes secondaires, et une poignée
 * de dépannages usuels (un 3e ligne dépanne en 2e ligne, un centre à l'aile…).
 */
const ADJACENT_COVER: Readonly<Record<PositionGroup, readonly PositionGroup[]>> = {
  FRONT_ROW: [],                                   // jamais de dépannage : poste spécialiste
  SECOND_ROW: ['BACK_ROW'],
  BACK_ROW: ['SECOND_ROW'],
  SCRUM_HALF: [],
  FLY_HALF: ['CENTRE'],
  CENTRE: ['FLY_HALF', 'BACK_THREE'],
  BACK_THREE: ['CENTRE'],
};

export function coverableGroups(player: Player): ReadonlySet<PositionGroup> {
  const out = new Set<PositionGroup>();
  out.add(groupOf(player.position));
  for (const sec of player.secondaryPositions) out.add(groupOf(sec));
  for (const adj of ADJACENT_COVER[groupOf(player.position)]) out.add(adj);
  return out;
}

/** Un joueur peut-il couvrir ce poste ? La première ligne n'accepte que des spécialistes. */
export function canCover(player: Player, position: Position): boolean {
  return coverableGroups(player).has(groupOf(position));
}

// =============================================================================
// Coût de fatigue
// =============================================================================

/**
 * Multiplicateur de coût selon le rôle du joueur dans le type de phase.
 * Pondéré pour que la moyenne sur 15 joueurs (8 avants + 7 arrières) reste ≈ 1.0,
 * afin de ne pas décaler la calibration héritée de la fatigue scalaire.
 */
function roleCostMultiplier(phaseType: PhaseType, forward: boolean): number {
  switch (phaseType) {
    case 'SCRUM':
      return forward ? 1.55 : 0.35;          // (8×1.55 + 7×0.35)/15 = 0.99
    case 'RUCK':
    case 'LINEOUT':
      return forward ? 1.30 : 0.66;          // (8×1.30 + 7×0.66)/15 = 1.00
    case 'OPEN_PLAY':
      return forward ? 0.88 : 1.14;          // (8×0.88 + 7×1.14)/15 = 1.00
    case 'KICK':
    case 'KICKOFF':
      return forward ? 0.85 : 1.17;
    case 'TRY':
      return forward ? 1.0 : 1.0;
    default:
      return 1.0;                             // PENALTY / CONVERSION / DROP_GOAL : récup
  }
}

/**
 * Modulation par l'endurance, centrée sur 60 (moyenne approximative d'un effectif Top 14).
 * endurance 60 → ×1.00, endurance 85 → ×0.83, endurance 35 → ×1.17.
 */
function enduranceCostMultiplier(endurance: number): number {
  return Math.max(0.70, Math.min(1.30, 1 + (60 - endurance) / 150));
}

// =============================================================================
// État runtime d'un effectif
// =============================================================================

export interface SubstitutionRecord {
  readonly minute: number;
  readonly offPlayerId: PlayerId;
  readonly onPlayerId: PlayerId;
  readonly position: Position;
  /** Raison retenue (sert au narratif et à l'UI). */
  readonly reason: 'FATIGUE' | 'TACTIQUE' | 'IMPACT' | 'BLESSURE' | 'MANAGER';
}

interface OnFieldSlot {
  player: Player;
  readonly position: Position;
  /** Minute d'entrée sur le terrain (0 pour les titulaires). */
  enteredAtMinute: number;
}

export interface BenchSlot {
  readonly player: Player;
  /** Poste "nominal" sur la feuille de match. */
  readonly position: Position;
}

/**
 * V0.52 — un joueur au cachot, et la minute où il revient.
 *
 * On conserve le `OnFieldSlot` entier plutôt que le seul joueur : à son retour,
 * il reprend **exactement** son poste sur la feuille, avec sa minute d'entrée
 * d'origine. Sans cela, un carton jaune remettrait ses compteurs à zéro.
 */
export interface SinBinEntry {
  readonly slot: OnFieldSlot;
  readonly returnsAtMinute: number;
}

/** Durée réglementaire d'une exclusion temporaire, en minutes. */
export const SIN_BIN_MINUTES = 10;

export interface SquadRuntime {
  /** Les 15 sur le terrain, dans l'ordre des postes de la feuille. */
  readonly slots: OnFieldSlot[];
  /** Remplaçants encore disponibles. */
  readonly bench: BenchSlot[];
  /** Fatigue individuelle 0-100, y compris pour les joueurs sur le banc. */
  readonly fatigueByPlayer: Map<PlayerId, number>;
  /** Minutes jouées, par joueur (mise à jour à chaque phase). */
  readonly minutesByPlayer: Map<PlayerId, number>;
  /** Joueurs déjà sortis — interdits de retour. */
  readonly usedOff: Set<PlayerId>;
  readonly substitutions: SubstitutionRecord[];
  /** V0.52 — exclusions temporaires en cours. */
  readonly sinBin: SinBinEntry[];
  /** V0.52 — joueurs définitivement exclus : ils ne reviennent jamais. */
  readonly sentOff: Set<PlayerId>;
  /** Buteur désigné (peut changer si le buteur sort). */
  kicker: Player;
  /** True dès qu'il n'y a plus de première ligne spécialiste disponible. */
  uncontestedScrums: boolean;
}

export const MAX_SUBSTITUTIONS = 8;

export function createSquadRuntime(
  starters: readonly RosterEntry[],
  substitutes: readonly RosterEntry[],
  playersById: ReadonlyMap<PlayerId, Player>,
  kicker: Player,
  initialFatigue: number,
): SquadRuntime {
  const slots: OnFieldSlot[] = [];
  const fatigueByPlayer = new Map<PlayerId, number>();
  const minutesByPlayer = new Map<PlayerId, number>();

  for (const entry of starters) {
    const player = playersById.get(entry.playerId);
    if (!player) throw new Error(`SquadRuntime: titulaire introuvable (id=${entry.playerId})`);
    slots.push({ player, position: entry.position, enteredAtMinute: 0 });
    fatigueByPlayer.set(player.id, initialFatigue);
    minutesByPlayer.set(player.id, 0);
  }

  const bench: BenchSlot[] = [];
  for (const entry of substitutes) {
    const player = playersById.get(entry.playerId);
    if (!player) continue;                      // feuille incomplète : on ignore, pas d'exception
    bench.push({ player, position: entry.position });
    fatigueByPlayer.set(player.id, initialFatigue);
    minutesByPlayer.set(player.id, 0);
  }

  return {
    slots,
    bench,
    fatigueByPlayer,
    minutesByPlayer,
    usedOff: new Set<PlayerId>(),
    substitutions: [],
    sinBin: [],
    sentOff: new Set<PlayerId>(),
    kicker,
    uncontestedScrums: false,
  };
}

// =============================================================================
// Lectures dérivées
// =============================================================================

export function onFieldPlayers(sq: SquadRuntime): readonly Player[] {
  return sq.slots.map(s => s.player);
}

export function onFieldPack(sq: SquadRuntime): readonly Player[] {
  return sq.slots.filter(s => isForwardPosition(s.position)).map(s => s.player);
}

export function onFieldBacks(sq: SquadRuntime): readonly Player[] {
  return sq.slots.filter(s => !isForwardPosition(s.position)).map(s => s.player);
}

function meanFatigue(sq: SquadRuntime, players: readonly Player[]): number {
  if (players.length === 0) return 0;
  let total = 0;
  for (const p of players) total += sq.fatigueByPlayer.get(p.id) ?? 0;
  return total / players.length;
}

/** Fatigue moyenne des 15 sur le terrain — remplace l'ancien scalaire d'équipe. */
export function squadFatigue(sq: SquadRuntime): number {
  return meanFatigue(sq, onFieldPlayers(sq));
}

/** Fatigue moyenne du pack — alimente mêlée / touche / ruck. */
export function packFatigue(sq: SquadRuntime): number {
  return meanFatigue(sq, onFieldPack(sq));
}

/** Fatigue moyenne des lignes arrières — alimente le jeu au pied. */
export function backsFatigue(sq: SquadRuntime): number {
  return meanFatigue(sq, onFieldBacks(sq));
}

export function playerFatigue(sq: SquadRuntime, playerId: PlayerId): number {
  return sq.fatigueByPlayer.get(playerId) ?? 0;
}

/** Le joueur le plus émoussé du terrain (pour les live moments). */
export function mostFatiguedOnField(sq: SquadRuntime): { player: Player; fatigue: number } | undefined {
  let best: { player: Player; fatigue: number } | undefined;
  for (const slot of sq.slots) {
    const f = sq.fatigueByPlayer.get(slot.player.id) ?? 0;
    if (!best || f > best.fatigue) best = { player: slot.player, fatigue: f };
  }
  return best;
}

// =============================================================================
// Accumulation de fatigue
// =============================================================================

/**
 * Applique le coût d'une phase à tous les joueurs sur le terrain.
 * `baseCost` est le coût hérité de PHASE_FATIGUE_COST (côté attaque ou défense).
 */
export function accrueFatigue(sq: SquadRuntime, phaseType: PhaseType, baseCost: number): void {
  for (const slot of sq.slots) {
    const forward = isForwardPosition(slot.position);
    const cost =
      baseCost *
      roleCostMultiplier(phaseType, forward) *
      enduranceCostMultiplier(slot.player.physical.endurance);
    const current = sq.fatigueByPlayer.get(slot.player.id) ?? 0;
    sq.fatigueByPlayer.set(slot.player.id, Math.min(100, current + cost));
  }
}

/** Les remplaçants récupèrent (légèrement) tant qu'ils sont sur le banc. */
export function recoverBench(sq: SquadRuntime, baseCost: number): void {
  for (const slot of sq.bench) {
    const current = sq.fatigueByPlayer.get(slot.player.id) ?? 0;
    if (current <= 0) continue;
    sq.fatigueByPlayer.set(slot.player.id, Math.max(0, current - baseCost * 0.4));
  }
}

/** Crédite les minutes jouées aux 15 sur le terrain. */
export function accrueMinutes(sq: SquadRuntime, deltaMinutes: number): void {
  for (const slot of sq.slots) {
    const current = sq.minutesByPlayer.get(slot.player.id) ?? 0;
    sq.minutesByPlayer.set(slot.player.id, current + deltaMinutes);
  }
}

/** Applique un delta de fatigue à tout le terrain (effets de live moment). */
export function applyFatigueDeltaOnField(sq: SquadRuntime, delta: number): void {
  for (const slot of sq.slots) {
    const current = sq.fatigueByPlayer.get(slot.player.id) ?? 0;
    sq.fatigueByPlayer.set(slot.player.id, Math.max(0, Math.min(100, current + delta)));
  }
}

// =============================================================================
// Première ligne : règle des mêlées simulées
// =============================================================================

function frontRowOnField(sq: SquadRuntime): number {
  return sq.slots.filter(s => groupOf(s.position) === 'FRONT_ROW').length;
}

/** Reste-t-il une doublure de première ligne sur le banc ? */
export function hasFrontRowCover(sq: SquadRuntime): boolean {
  return sq.bench.some(b => groupOf(b.player.position) === 'FRONT_ROW');
}

/**
 * Le pack peut-il tenir une mêlée fermée ?
 *
 * Il faut trois premières lignes sur le terrain. Un remplacement qui les fait
 * tomber en dessous verrouille les mêlées simulées **pour le reste du match** :
 * c'est définitif, parce qu'il n'y a plus personne pour tenir le poste.
 */
export function refreshScrumSafety(sq: SquadRuntime): void {
  if (frontRowOnField(sq) < 3) sq.uncontestedScrums = true;
}

/**
 * V0.52 — les mêlées sont-elles simulées à cet instant ?
 *
 * Deux causes bien différentes, et c'est pourquoi cette lecture existe à côté
 * du drapeau : l'épuisement des doublures est **définitif**, l'exclusion d'un
 * pilier ne dure que dix minutes. Verrouiller le match entier pour un carton
 * jaune punirait deux fois la même faute.
 */
export function scrumsUncontested(sq: SquadRuntime): boolean {
  return sq.uncontestedScrums || frontRowOnField(sq) < 3;
}

// =============================================================================
// Exécution d'un remplacement
// =============================================================================

export interface SubstitutionRequest {
  readonly offPlayerId: PlayerId;
  readonly onPlayerId: PlayerId;
  readonly minute: number;
  readonly reason: SubstitutionRecord['reason'];
}

export type SubstitutionOutcome =
  | { readonly ok: true; readonly record: SubstitutionRecord }
  | { readonly ok: false; readonly reason: string };

export function applySubstitution(sq: SquadRuntime, req: SubstitutionRequest): SubstitutionOutcome {
  if (sq.substitutions.length >= MAX_SUBSTITUTIONS) {
    return { ok: false, reason: 'quota de 8 remplacements atteint' };
  }
  const slotIndex = sq.slots.findIndex(s => s.player.id === req.offPlayerId);
  if (slotIndex < 0) return { ok: false, reason: 'le sortant n\'est pas sur le terrain' };
  const benchIndex = sq.bench.findIndex(b => b.player.id === req.onPlayerId);
  if (benchIndex < 0) return { ok: false, reason: 'l\'entrant n\'est pas sur le banc' };
  if (sq.usedOff.has(req.onPlayerId)) return { ok: false, reason: 'joueur déjà sorti, retour interdit' };
  if (sq.sentOff.has(req.onPlayerId)) return { ok: false, reason: 'joueur exclu' };

  const slot = sq.slots[slotIndex]!;
  const incoming = sq.bench[benchIndex]!;
  if (!canCover(incoming.player, slot.position)) {
    return { ok: false, reason: `${incoming.player.lastName} ne couvre pas le poste` };
  }

  const outgoing = slot.player;
  slot.player = incoming.player;
  slot.enteredAtMinute = req.minute;
  sq.bench.splice(benchIndex, 1);
  sq.usedOff.add(outgoing.id);

  // Le buteur sort → on repasse au meilleur jeuAuPiedPlace présent sur le terrain.
  if (sq.kicker.id === outgoing.id) {
    let best = sq.slots[0]!.player;
    for (const s of sq.slots) {
      if (s.player.technical.jeuAuPiedPlace > best.technical.jeuAuPiedPlace) best = s.player;
    }
    sq.kicker = best;
  }

  refreshScrumSafety(sq);

  const record: SubstitutionRecord = {
    minute: req.minute,
    offPlayerId: outgoing.id,
    onPlayerId: incoming.player.id,
    position: slot.position,
    reason: req.reason,
  };
  sq.substitutions.push(record);
  return { ok: true, record };
}

// =============================================================================
// Cartons : exclusion temporaire et définitive
// =============================================================================

/**
 * Envoie un joueur au cachot.
 *
 * On **retire réellement son slot** : toutes les lectures dérivées — pack,
 * lignes arrières, fatigue moyenne, première ligne disponible — passent donc
 * mécaniquement à quatorze sans qu'aucune d'elles n'ait à connaître les
 * cartons. C'est ce qui rend l'exclusion peu coûteuse à brancher partout.
 *
 * Le joueur continue d'exister dans `fatigueByPlayer` et `minutesByPlayer` : il
 * cesse simplement d'en accumuler, ce qui est exactement ce qu'il fait sur le
 * banc de touche.
 */
export function sendToSinBin(
  sq: SquadRuntime,
  playerId: PlayerId,
  minute: number,
): boolean {
  const index = sq.slots.findIndex(s => s.player.id === playerId);
  if (index < 0) return false;

  const [slot] = sq.slots.splice(index, 1);
  if (!slot) return false;
  sq.sinBin.push({ slot, returnsAtMinute: minute + SIN_BIN_MINUTES });
  handleKickerLoss(sq);
  return true;
}

/**
 * Exclusion définitive.
 *
 * Le slot disparaît sans retour possible, et le joueur rejoint `sentOff` pour
 * qu'aucun remplacement ne puisse le faire revenir par la bande.
 */
export function sendOff(sq: SquadRuntime, playerId: PlayerId, minute: number): boolean {
  const index = sq.slots.findIndex(s => s.player.id === playerId);
  if (index < 0) {
    // Rouge pris alors qu'il était déjà au cachot : il ne revient pas.
    const binned = sq.sinBin.findIndex(e => e.slot.player.id === playerId);
    if (binned < 0) return false;
    sq.sinBin.splice(binned, 1);
    sq.sentOff.add(playerId);
    return true;
  }
  void minute;
  sq.slots.splice(index, 1);
  sq.sentOff.add(playerId);
  handleKickerLoss(sq);
  return true;
}

/**
 * Fait revenir ceux dont la peine est purgée.
 *
 * Renvoie les joueurs réintégrés, pour que la session puisse le raconter.
 */
export function returnFromSinBin(sq: SquadRuntime, minute: number): readonly Player[] {
  if (sq.sinBin.length === 0) return [];
  const back: Player[] = [];
  for (let i = sq.sinBin.length - 1; i >= 0; i--) {
    const entry = sq.sinBin[i]!;
    if (minute < entry.returnsAtMinute) continue;
    sq.sinBin.splice(i, 1);
    // Il a pu être remplacé pendant son absence : dans ce cas son poste est
    // déjà tenu, et il ne rentre pas.
    if (sq.slots.some(s => s.position === entry.slot.position)) continue;
    sq.slots.push(entry.slot);
    back.push(entry.slot.player);
  }
  if (back.length > 0) restoreKicker(sq);
  return back;
}

/** Joueurs actuellement au cachot. */
export function sinBinned(sq: SquadRuntime): readonly Player[] {
  return sq.sinBin.map(e => e.slot.player);
}

/**
 * Le buteur a quitté le terrain : on repasse au meilleur botteur présent.
 *
 * Extrait de `applySubstitution`, qui faisait déjà ce calcul — un carton le
 * réclame tout autant, et pour la même raison.
 */
function handleKickerLoss(sq: SquadRuntime): void {
  if (sq.slots.length === 0) return;
  if (sq.slots.some(s => s.player.id === sq.kicker.id)) return;
  let best = sq.slots[0]!.player;
  for (const s of sq.slots) {
    if (s.player.technical.jeuAuPiedPlace > best.technical.jeuAuPiedPlace) best = s.player;
  }
  sq.kicker = best;
}

/** Au retour d'un carton, le meilleur botteur du terrain reprend le tee. */
function restoreKicker(sq: SquadRuntime): void {
  if (sq.slots.length === 0) return;
  let best = sq.slots[0]!.player;
  for (const s of sq.slots) {
    if (s.player.technical.jeuAuPiedPlace > best.technical.jeuAuPiedPlace) best = s.player;
  }
  sq.kicker = best;
}

// =============================================================================
// Politique automatique de remplacement
// =============================================================================

/**
 * Sur-fatigue à partir de laquelle un joueur devient candidat au remplacement.
 * La première ligne est sortie plus tôt : c'est elle qui explose en premier.
 */
function fatigueThresholdFor(position: Position, minute: number): number {
  const base = groupOf(position) === 'FRONT_ROW' ? 62 : 72;
  // Passé l'heure de jeu, on devient plus permissif (on vide le banc).
  if (minute >= 65) return base - 10;
  if (minute >= 55) return base - 5;
  return base;
}

/** Le remplacement apporte-t-il un gain réel ? On évite de dégrader l'équipe pour rien. */
function isWorthwhile(outgoing: Player, incoming: Player, outgoingFatigue: number, incomingFatigue: number): boolean {
  const freshnessGain = outgoingFatigue - incomingFatigue;
  if (freshnessGain < 12) return false;
  // Un écart de niveau brut trop grand annule le bénéfice de fraîcheur.
  const outLevel = rawLevel(outgoing) * (1 - outgoingFatigue / 100 * 0.30);
  const inLevel = rawLevel(incoming) * (1 - incomingFatigue / 100 * 0.30);
  return inLevel >= outLevel - 1.5;
}

function rawLevel(p: Player): number {
  return (
    p.technical.passe + p.technical.plaquage + p.technical.conservation +
    p.physical.vitesse + p.physical.puissance + p.physical.endurance
  ) / 6;
}

/**
 * Choisit le prochain remplacement à effectuer, ou undefined s'il n'y a rien à faire.
 * Déterministe : aucun tirage aléatoire, le tri départage sur l'id en dernier recours.
 */
export function planAutoSubstitution(
  sq: SquadRuntime,
  minute: number,
): SubstitutionRequest | undefined {
  if (minute < 45) return undefined;                       // fenêtre de remplacement
  if (sq.substitutions.length >= MAX_SUBSTITUTIONS) return undefined;
  if (sq.bench.length === 0) return undefined;

  const candidates: { req: SubstitutionRequest; gain: number }[] = [];

  for (const slot of sq.slots) {
    const outFatigue = sq.fatigueByPlayer.get(slot.player.id) ?? 0;
    if (outFatigue < fatigueThresholdFor(slot.position, minute)) continue;

    for (const b of sq.bench) {
      if (!canCover(b.player, slot.position)) continue;
      const inFatigue = sq.fatigueByPlayer.get(b.player.id) ?? 0;
      if (!isWorthwhile(slot.player, b.player, outFatigue, inFatigue)) continue;
      candidates.push({
        req: {
          offPlayerId: slot.player.id,
          onPlayerId: b.player.id,
          minute,
          reason: 'FATIGUE',
        },
        gain: (outFatigue - inFatigue) + (rawLevel(b.player) - rawLevel(slot.player)),
      });
    }
  }

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) =>
    b.gain - a.gain || a.req.offPlayerId.localeCompare(b.req.offPlayerId),
  );
  return candidates[0]!.req;
}

/**
 * Meilleur entrant disponible pour un poste donné (utilisé par les live moments
 * quand le manager décide de sortir un joueur nommément).
 */
export function bestCoverFor(sq: SquadRuntime, position: Position): Player | undefined {
  let best: Player | undefined;
  let bestScore = -Infinity;
  for (const b of sq.bench) {
    if (!canCover(b.player, position)) continue;
    const fatigue = sq.fatigueByPlayer.get(b.player.id) ?? 0;
    const score = rawLevel(b.player) - fatigue * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = b.player;
    }
  }
  return best;
}
