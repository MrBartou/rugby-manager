/**
 * Détecteur d'événements humains.
 *
 * À chaque fin de round, on regarde l'état du club et on déclenche au plus
 * 1-2 événements pertinents. Évite le spam : on traque les types récemment
 * déclenchés.
 */

import type { Player, PlayerId } from '../types.js';
import type { RelationsState } from './relationships.js';
import type { PlayedMatch } from '../game/season-session.js';
import {
  makeAmbitionTransferEvent,
  makeConflictEvent,
  makeMentorEvent,
  makePlayerPressIncidentEvent,
  makePositionConflictEvent,
  makePositiveEvent,
  makePressEvent,
  makeRequestEvent,
  makeStarFatigueEvent,
  makeVulnerabilityEvent,
  type HumanEvent,
  type HumanEventType,
} from './events.js';

export interface EventDetectionInputs {
  readonly currentRound: number;
  readonly clubPlayers: readonly Player[];
  readonly relations: RelationsState;
  readonly recentHistory: readonly PlayedMatch[];      // matchs du club joueur
  readonly typesAlreadyTriggeredRecently: ReadonlySet<HumanEventType>;
  /** Map playerId → fatigue actuelle (pour STAR_FATIGUEE). */
  readonly fatigueByPlayer: ReadonlyMap<PlayerId, number>;
  /** V0.9 — joueurs récemment cibles d'un event (à éviter pour varier). */
  readonly recentlyTargetedPlayerIds?: ReadonlySet<PlayerId>;
}

function ageFromBirthDate(birthDate: string, currentSeason: number): number {
  return currentSeason - parseInt(birthDate.slice(0, 4), 10);
}

function playerOverall(p: Player): number {
  return Math.round(
    (p.technical.passe + p.technical.plaquage + p.physical.vitesse + p.physical.puissance + p.mental.decision + p.mental.leadership) / 6
  );
}

/** Renvoie 0-2 events à présenter à l'utilisateur. */
export function detectHumanEvents(inputs: EventDetectionInputs, currentSeason: number): readonly HumanEvent[] {
  const out: HumanEvent[] = [];
  const blocked = inputs.typesAlreadyTriggeredRecently;
  const recentTargets = inputs.recentlyTargetedPlayerIds ?? new Set<PlayerId>();
  const isFresh = (p: Player): boolean => !recentTargets.has(p.id);

  // PRESSE_NEGATIVE est traitée séparément via detectPressEvent (voir ci-dessous).

  // 2. CONFLIT_VESTIAIRE — relation ≤ -55 trouvée
  if (!blocked.has('CONFLIT_VESTIAIRE')) {
    let worst: { score: number; a: Player; b: Player } | undefined;
    for (const r of inputs.relations.byPair.values()) {
      if (r.score > -55) continue;
      const a = inputs.clubPlayers.find(p => p.id === r.fromId);
      const b = inputs.clubPlayers.find(p => p.id === r.toId);
      if (!a || !b) continue;
      if (!worst || r.score < worst.score) worst = { score: r.score, a, b };
    }
    if (worst) {
      out.push(makeConflictEvent(inputs.currentRound, worst.a, worst.b));
    }
  }

  // 3. STAR_FATIGUEE — cadre (overall haut) avec fatigue > 70
  if (!blocked.has('STAR_FATIGUEE')) {
    const stars = inputs.clubPlayers
      .map(p => ({ p, score: playerOverall(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const fatigued = stars.find(s => (inputs.fatigueByPlayer.get(s.p.id) ?? 0) > 70);
    if (fatigued) {
      out.push(makeStarFatigueEvent(inputs.currentRound, fatigued.p));
    }
  }

  // 4. MENTOR_PROPOSE — un cadre avec trait "mentor" + un jeune (≤22 ans)
  if (!blocked.has('MENTOR_PROPOSE') && out.length < 2) {
    const mentors = inputs.clubPlayers.filter(p => (p.traits as readonly string[]).includes('mentor'));
    const youngs = inputs.clubPlayers.filter(p => ageFromBirthDate(p.birthDate, currentSeason) <= 22);
    if (mentors.length > 0 && youngs.length > 0) {
      // Trouve un couple qui n'est pas déjà très lié (pour éviter de re-proposer le même)
      for (const m of mentors) {
        for (const y of youngs) {
          if (m.id === y.id) continue;
          if (m.position !== y.position) continue;       // V0.4 : tutorat au poste
          out.push(makeMentorEvent(inputs.currentRound, m, y));
          break;
        }
        if (out.find(e => e.type === 'MENTOR_PROPOSE')) break;
      }
    }
  }

  // 5. DEMANDE_INDIVIDUELLE — un leader avec trait "ambitieux" qui n'a pas eu d'event
  if (!blocked.has('DEMANDE_INDIVIDUELLE') && out.length < 2) {
    const ambitious = inputs.clubPlayers
      .filter(p => (p.traits as readonly string[]).includes('ambitieux'))
      .filter(p => p.mental.leadership >= 70);
    if (ambitious.length > 0) {
      const pick = ambitious[Math.floor(inputs.currentRound % ambitious.length)]!;
      out.push(makeRequestEvent(inputs.currentRound, pick));
    }
  }

  // V0.9 — 6. VULNERABILITE_MENTALE : joueur avec mood bas + trait fragile_mentalement
  if (!blocked.has('VULNERABILITE_MENTALE') && out.length < 2) {
    const vulnerable = inputs.clubPlayers.find(p =>
      isFresh(p) &&
      p.dynamic.mood < 40 &&
      ((p.traits as readonly string[]).includes('fragile_mentalement') || p.mental.sangFroid < 45),
    );
    if (vulnerable) {
      out.push(makeVulnerabilityEvent(inputs.currentRound, vulnerable));
    }
  }

  // V0.9 — 7. EVENT_POSITIF : sur la base du round (un anniversaire toutes les ~6 journées)
  if (!blocked.has('EVENT_POSITIF') && out.length < 2 && inputs.currentRound % 6 === 0) {
    const candidates = inputs.clubPlayers.filter(p =>
      isFresh(p) && !p.retired && !p.freeAgent && p.dynamic.mood >= 50,
    );
    if (candidates.length > 0) {
      const pick = candidates[inputs.currentRound % candidates.length]!;
      const occasions = ['Anniversaire', 'Naissance d\'un enfant', '100e match en pro'];
      out.push(makePositiveEvent(inputs.currentRound, pick, occasions[inputs.currentRound % occasions.length]!));
    }
  }

  // V0.9 — 8. INCIDENT_PRESSE_JOUEUR : trait controversé + occasionnel
  if (!blocked.has('INCIDENT_PRESSE_JOUEUR') && out.length < 2 && inputs.currentRound % 5 === 2) {
    const candidates = inputs.clubPlayers.filter(p =>
      isFresh(p) &&
      ((p.traits as readonly string[]).includes('caractere_difficile') || p.mental.discipline < 40),
    );
    if (candidates.length > 0) {
      const target = candidates[inputs.currentRound % candidates.length]!;
      out.push(makePlayerPressIncidentEvent(inputs.currentRound, target));
    }
  }

  // V0.9 — 9. AMBITION_TRANSFERT : star ambitieuse en milieu/fin de contrat
  if (!blocked.has('AMBITION_TRANSFERT') && out.length < 2) {
    const candidates = inputs.clubPlayers.filter(p =>
      isFresh(p) &&
      (p.traits as readonly string[]).includes('ambitieux') &&
      playerOverall(p) >= 75 &&
      p.contract.endSeason - currentSeason <= 2,
    );
    if (candidates.length > 0) {
      const target = candidates[inputs.currentRound % candidates.length]!;
      out.push(makeAmbitionTransferEvent(inputs.currentRound, target));
    }
  }

  // V0.9 — 10. CONFLIT_POSTE : 2 joueurs même poste niveaux proches
  if (!blocked.has('CONFLIT_POSTE') && out.length < 2 && inputs.currentRound % 4 === 1) {
    const byPosition = new Map<string, Player[]>();
    for (const p of inputs.clubPlayers) {
      if (p.retired || p.freeAgent) continue;
      const arr = byPosition.get(p.position) ?? [];
      arr.push(p);
      byPosition.set(p.position, arr);
    }
    // Itère les positions dans un ordre dépendant du round → varie les conflits
    const positions = [...byPosition.keys()];
    const startIdx = inputs.currentRound % Math.max(1, positions.length);
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[(startIdx + i) % positions.length]!;
      const ps = byPosition.get(pos)!;
      if (ps.length < 2) continue;
      const sorted = [...ps].sort((a, b) => playerOverall(b) - playerOverall(a));
      const titular = sorted[0]!;
      const rival = sorted[1]!;
      // Rotation : si l'un des deux est récent, on saute
      if (!isFresh(titular) || !isFresh(rival)) continue;
      const gap = playerOverall(titular) - playerOverall(rival);
      if (gap <= 6 && playerOverall(rival) >= 60) {
        out.push(makePositionConflictEvent(inputs.currentRound, titular, rival));
        break;
      }
    }
  }

  return out.slice(0, 2);
}

/**
 * Variante simplifiée pour PRESSE_NEGATIVE : appel séparé avec un compte de défaites consécutives.
 * (Mieux qu'essayer de le déduire dans detectHumanEvents.)
 */
export function detectPressEvent(round: number, consecutiveDefeats: number, blocked: ReadonlySet<HumanEventType>): HumanEvent | undefined {
  if (blocked.has('PRESSE_NEGATIVE')) return undefined;
  if (consecutiveDefeats < 3) return undefined;
  return makePressEvent(round, consecutiveDefeats);
}
