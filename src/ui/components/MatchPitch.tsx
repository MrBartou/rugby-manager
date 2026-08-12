/**
 * MatchPitch — vue match V0.12 (refonte complète).
 *
 * Principe : ne montrer que ce que le moteur connaît réellement.
 *  - Position du ballon (1D : -50..+50)
 *  - Possession et type de phase
 *  - Momentum et événements (essai, carton, buts)
 *
 * Rendu : terrain horizontal stylé, ballon animé, glow de territoire,
 * badge de phase, momentum bar, célébrations cinématiques.
 *
 * ## V0.57 — les trente joueurs
 *
 * Ce module a longtemps porté ici une consigne : *« Pas de 30 ronds qui
 * sautent. Pas de mensonge. »* Elle est levée, et la raison qui la motivait est
 * conservée telle quelle : les joueurs affichés sont **déduits** de ce que la
 * simulation affirme — type de phase, position du ballon, possession, porteur
 * et plaqueur nommés, remplacements déjà effectués. Voir
 * `ui/pitch/phase-formation.ts`, qui produit les positions et porte le détail
 * du raisonnement. Rien n'est décidé ici, et aucun résultat n'en dépend.
 */

import { useEffect, useRef, useState } from 'react';
import { MOMENTUM_CAP, momentumLabel } from '../../engine/match/momentum.js';
import { WEATHER_LABEL } from '../../engine/match/weather.js';
import { ClubCrest } from './ClubCrest.js';
import { StadiumBackdrop } from './StadiumBackdrop.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import type { PhaseRecord, PhaseType, Possession } from '../../engine/match/types.js';
import { ballAxisFor, type PitchActor } from '../pitch/phase-formation.js';

interface Props {
  readonly visiblePhases: readonly PhaseRecord[];
  /** V0.19 — identité des clubs : blasons et couleurs dans le bandeau de score. */
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeName: string;
  readonly awayName: string;
  readonly homeShort: string;
  readonly awayShort: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly minute: number;
  readonly live: boolean;
  /** V0.51 — conditions du jour, affichées à côté de l'élan. */
  readonly weather?: import('../../engine/match/types.js').MatchInput['weather'];
  /**
   * V0.57 — les trente joueurs, placés pour la phase affichée.
   *
   * Optionnel : une vue sans feuilles de match reste lisible, elle montre alors
   * le terrain et le ballon comme avant.
   */
  readonly actors?: readonly PitchActor[];
  /** Nom court d'un joueur mis en évidence, pour l'étiquette. */
  readonly nameOf?: (id: import('../../engine/types.js').PlayerId) => string | undefined;
}

const PHASE_LABEL: Record<PhaseType, string> = {
  KICKOFF: 'Engagement',
  SCRUM: 'Mêlée',
  LINEOUT: 'Touche',
  RUCK: 'Ruck',
  OPEN_PLAY: 'Jeu courant',
  GOAL_LINE: 'Pilonnage à 5 m',
  KICK: 'Jeu au pied',
  PENALTY: 'Pénalité',
  CONVERSION: 'Transformation',
  DROP_GOAL: 'Drop',
  TRY: 'ESSAI !',
};

const PHASE_GLYPH: Record<PhaseType, string> = {
  KICKOFF: '◎',
  SCRUM: '⬢',
  LINEOUT: '┃',
  RUCK: '◆',
  OPEN_PLAY: '➤',
  GOAL_LINE: '⚔',
  KICK: '↗',
  PENALTY: '⚑',
  CONVERSION: '⊕',
  DROP_GOAL: '↑',
  TRY: '★',
};

/** Convertit fieldPosition (signé selon attaquant) en position absolue 0..1 (HOME→AWAY). */
function fieldPositionToHomeRef(pos: number, attacker: Possession): number {
  // pos ∈ [-50, +50] depuis le POV de l'attaquant
  // 0..1 où 0 = ligne d'en-but HOME, 1 = ligne d'en-but AWAY
  const homeRef =
    attacker === 'HOME' ? pos :
    attacker === 'AWAY' ? -pos :
    0;
  // homeRef ∈ [-50, +50] : -50 = en-but HOME, +50 = en-but AWAY
  return (homeRef + 50) / 100;
}

export function MatchPitch({
  visiblePhases, homeClubId, awayClubId,
  homeName,
  awayName,
  homeShort,
  awayShort,
  homeScore,
  awayScore,
  minute,
  live,
  weather,
  actors,
  nameOf,
}: Props) {
  const lastPhase = visiblePhases[visiblePhases.length - 1];
  const phaseType = lastPhase?.type ?? 'KICKOFF';
  const possession = lastPhase?.state.possession ?? 'CONTESTED';
  const fieldPosition = lastPhase?.state.fieldPosition ?? 0;
  const ballPos = fieldPositionToHomeRef(fieldPosition, possession);

  // ---------------------------------------------------------------------------
  // Détection d'événements pour les célébrations
  // ---------------------------------------------------------------------------
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [celebrationKind, setCelebrationKind] = useState<{
    kind: 'TRY' | 'PENALTY' | 'DROP' | 'CARD';
    team: 'HOME' | 'AWAY' | null;
    color?: 'YELLOW' | 'RED';
  } | null>(null);
  const lastSeenIndex = useRef(-1);

  useEffect(() => {
    if (!lastPhase) return;
    if (lastPhase.index <= lastSeenIndex.current) return;
    lastSeenIndex.current = lastPhase.index;
    const o = lastPhase.outcome;
    if (o.tryScored) {
      setCelebrationKind({ kind: 'TRY', team: o.tryScored });
      setCelebrationKey(k => k + 1);
    } else if (o.pointsScored?.type === 'PENALTY' || o.pointsScored?.type === 'DROP_GOAL') {
      setCelebrationKind({
        kind: o.pointsScored.type === 'PENALTY' ? 'PENALTY' : 'DROP',
        team: o.pointsScored.team,
      });
      setCelebrationKey(k => k + 1);
    } else if (o.cardIssued) {
      setCelebrationKind({
        kind: 'CARD',
        team: null,
        color: o.cardIssued.color,
      });
      setCelebrationKey(k => k + 1);
    }
  }, [lastPhase]);

  // Auto-clear celebration après 2.4s
  useEffect(() => {
    if (!celebrationKind) return;
    const t = setTimeout(() => setCelebrationKind(null), 2400);
    return () => clearTimeout(t);
  }, [celebrationKey, celebrationKind]);

  // ---------------------------------------------------------------------------
  // Élan
  // ---------------------------------------------------------------------------
  // V0.50 — la barre lit l'élan du moteur. Jusqu'ici elle le recalculait
  // ici-même à partir de la possession des huit dernières phases : elle
  // montrait donc quelque chose que la simulation ignorait, et qui ne
  // décidait de rien.
  const homeMomentum = lastPhase?.state.homeMomentum ?? 0;
  const homeMomentumPct = 50 + (homeMomentum / MOMENTUM_CAP) * 50;

  // ---------------------------------------------------------------------------
  // Compteurs live (pour le HUD)
  // ---------------------------------------------------------------------------
  const homeTries = visiblePhases.filter(p => p.outcome.tryScored === 'HOME').length;
  const awayTries = visiblePhases.filter(p => p.outcome.tryScored === 'AWAY').length;

  // Narration : 4 dernières phases, plus récente en haut
  const recentNarration = visiblePhases.slice(-6).reverse();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const possClass =
    possession === 'HOME' ? 'poss-home' :
    possession === 'AWAY' ? 'poss-away' : 'poss-contested';

  return (
    <div
      className={`match-stage ${possClass}`}
      style={{
        ['--home-color' as string]: readableAccent(clubIdentity(homeClubId).primary),
        ['--away-color' as string]: readableAccent(clubIdentity(awayClubId).primary),
      }}
    >
      {/* === HUD haut : score géant + chrono === */}
      <StadiumBackdrop
        className="match-stadium"
        seed={homeClubId}
        accent={readableAccent(clubIdentity(homeClubId).primary)}
        intensity={0.55}
      />

      <div className="match-hud">
        <div className="hud-team home">
          <ClubCrest clubId={homeClubId} initials={homeShort} size={38} className="hud-team-crest" />
          <div className="hud-team-short">{homeShort}</div>
          <div className="hud-team-name">{homeName}</div>
          <div className="hud-team-tries">
            {Array.from({ length: homeTries }).map((_, i) => (
              <span key={i} className="try-pip" aria-hidden>★</span>
            ))}
          </div>
        </div>
        <div className="hud-center">
          <div className="hud-score">
            <span className="score-digit">{homeScore}</span>
            <span className="score-sep">—</span>
            <span className="score-digit">{awayScore}</span>
          </div>
          <div className="hud-clock">
            {live && <span className="clock-pulse" aria-hidden />}
            <span className="clock-minute">{minute}'</span>
          </div>
        </div>
        <div className="hud-team away">
          <ClubCrest clubId={awayClubId} initials={awayShort} size={38} className="hud-team-crest" />
          <div className="hud-team-short">{awayShort}</div>
          <div className="hud-team-name">{awayName}</div>
          <div className="hud-team-tries">
            {Array.from({ length: awayTries }).map((_, i) => (
              <span key={i} className="try-pip" aria-hidden>★</span>
            ))}
          </div>
        </div>
      </div>

      {/* === Élan === */}
      <div className="momentum-row">
        <div className="momentum-bar" aria-label={momentumLabel(homeMomentum)}>
          <div className="momentum-fill home" style={{ width: `${homeMomentumPct}%` }} />
          <div className="momentum-fill away" style={{ width: `${100 - homeMomentumPct}%` }} />
          <div className="momentum-marker" style={{ left: `${homeMomentumPct}%` }} />
        </div>
        {/* On nomme l'élan, on ne le chiffre pas : une barre muette ne se lit
            pas, un pourcentage en ferait un tableau de bord. */}
        <span className="momentum-label">{momentumLabel(homeMomentum)}</span>
        {/* V0.51 — le temps qu'il fait, quand il fait quelque chose. */}
        {weather !== undefined && weather !== 'SEC' && (
          <span className="weather-tag">{WEATHER_LABEL[weather]}</span>
        )}
      </div>

      {/* === Terrain stylisé + ballon === */}
      <div className="match-pitch-wrap">
        <PitchSVG
          ballPos={ballPos}
          ballAxis={ballAxisFor(phaseType)}
          possession={possession}
          {...(actors ? { actors } : {})}
          {...(nameOf ? { nameOf } : {})}
        />

        {/* Badge de phase, centré, pulse à chaque changement */}
        <div key={`${phaseType}-${lastPhase?.index ?? 0}`} className={`phase-badge ${possClass}`}>
          <span className="phase-glyph" aria-hidden>{PHASE_GLYPH[phaseType]}</span>
          <span className="phase-name">{PHASE_LABEL[phaseType]}</span>
        </div>

        {/* Indicateur de possession sous le badge */}
        <div className="possession-strip">
          {possession === 'HOME' && (
            <span className="poss-pill home">
              <span className="poss-arrow">▶</span> {homeName}
            </span>
          )}
          {possession === 'AWAY' && (
            <span className="poss-pill away">
              {awayName} <span className="poss-arrow">◀</span>
            </span>
          )}
          {possession === 'CONTESTED' && (
            <span className="poss-pill contested">⚉ Possession contestée</span>
          )}
        </div>
      </div>

      {/* === Live commentary stack === */}
      <div className="commentary">
        {recentNarration.length === 0 && (
          <div className="commentary-empty">Le match va commencer…</div>
        )}
        {recentNarration.map((phase, i) => {
          const team =
            phase.state.possession === 'HOME' ? homeShort :
            phase.state.possession === 'AWAY' ? awayShort : '——';
          const teamClass =
            phase.state.possession === 'HOME' ? 'home' :
            phase.state.possession === 'AWAY' ? 'away' : 'contested';
          const isFresh = i === 0;
          const hasEvent = phase.outcome.tryScored || phase.outcome.pointsScored || phase.outcome.cardIssued;
          return (
            <div
              key={phase.index}
              className={`commentary-line ${teamClass} ${isFresh ? 'fresh' : ''} ${hasEvent ? 'event' : ''}`}
            >
              <span className="cm-min">{phase.state.minute}'</span>
              <span className="cm-team">{team}</span>
              <span className="cm-text">{phase.outcome.summary}</span>
              {phase.outcome.tryScored && <span className="cm-tag try">★ ESSAI</span>}
              {phase.outcome.pointsScored?.type === 'PENALTY' && <span className="cm-tag pen">⚑ +{phase.outcome.pointsScored.value}</span>}
              {phase.outcome.pointsScored?.type === 'CONVERSION' && <span className="cm-tag conv">⊕ +2</span>}
              {phase.outcome.pointsScored?.type === 'DROP_GOAL' && <span className="cm-tag drop">↑ DROP</span>}
              {phase.outcome.cardIssued && (
                <span className={`cm-tag card-${phase.outcome.cardIssued.color.toLowerCase()}`}>
                  {phase.outcome.cardIssued.color === 'RED' ? '⬛' : '▪'} {phase.outcome.cardIssued.color === 'RED' ? 'ROUGE' : 'JAUNE'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* === Célébration plein écran === */}
      {celebrationKind && (
        <CelebrationOverlay
          key={celebrationKey}
          kind={celebrationKind.kind}
          team={celebrationKind.team}
          {...(celebrationKind.color ? { color: celebrationKind.color } : {})}
          homeName={homeName}
          awayName={awayName}
        />
      )}
    </div>
  );
}

// ============================================================================
// Terrain SVG horizontal stylisé
// ============================================================================

interface PitchSVGProps {
  readonly ballPos: number;       // 0..1 (HOME → AWAY)
  /** Position du ballon en travers du terrain : 0.5 dans l'axe, au bord en touche. */
  readonly ballAxis: number;
  readonly possession: Possession;
  readonly actors?: readonly PitchActor[];
  readonly nameOf?: (id: import('../../engine/types.js').PlayerId) => string | undefined;
}

function PitchSVG({ ballPos, ballAxis, possession, actors, nameOf }: PitchSVGProps) {
  // Géométrie SVG : viewBox 0..1440, hauteur 320
  const W = 1440;
  const H = 320;
  const TZ = 110;             // largeur try-zone
  const PLAY_LEFT = TZ;
  const PLAY_RIGHT = W - TZ;
  const PLAY_W = PLAY_RIGHT - PLAY_LEFT;

  const ballX = PLAY_LEFT + ballPos * PLAY_W;
  const ballY = ballAxis * H;

  // Glow de possession : un gradient fade depuis la ligne d'attaque
  const glowSide =
    possession === 'HOME' ? 'home' :
    possession === 'AWAY' ? 'away' : 'none';

  return (
    <svg
      className="pitch-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Terrain de rugby"
    >
      <defs>
        <linearGradient id="grass-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a4d2c" />
          <stop offset="50%" stopColor="#225d36" />
          <stop offset="100%" stopColor="#173f24" />
        </linearGradient>
        <linearGradient id="tryzone-home" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255, 84, 112, 0.25)" />
          <stop offset="100%" stopColor="rgba(255, 84, 112, 0.05)" />
        </linearGradient>
        <linearGradient id="tryzone-away" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(110, 168, 255, 0.25)" />
          <stop offset="100%" stopColor="rgba(110, 168, 255, 0.05)" />
        </linearGradient>
        <radialGradient id="poss-glow-home" cx="0" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="rgba(255, 84, 112, 0.25)" />
          <stop offset="100%" stopColor="rgba(255, 84, 112, 0)" />
        </radialGradient>
        <radialGradient id="poss-glow-away" cx="1" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="rgba(110, 168, 255, 0.25)" />
          <stop offset="100%" stopColor="rgba(110, 168, 255, 0)" />
        </radialGradient>
        <radialGradient id="ball-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(255, 200, 80, 0.6)" />
          <stop offset="100%" stopColor="rgba(255, 200, 80, 0)" />
        </radialGradient>
        <pattern id="grass-stripes" x="0" y="0" width="80" height={H} patternUnits="userSpaceOnUse">
          <rect width="40" height={H} fill="rgba(255, 255, 255, 0.025)" />
        </pattern>
      </defs>

      {/* Pelouse */}
      <rect x={0} y={0} width={W} height={H} fill="url(#grass-grad)" />
      <rect x={0} y={0} width={W} height={H} fill="url(#grass-stripes)" />

      {/* Glow possession */}
      {glowSide === 'home' && <rect x={0} y={0} width={W} height={H} fill="url(#poss-glow-home)" />}
      {glowSide === 'away' && <rect x={0} y={0} width={W} height={H} fill="url(#poss-glow-away)" />}

      {/* Try zones */}
      <rect x={0} y={0} width={TZ} height={H} fill="url(#tryzone-home)" />
      <rect x={PLAY_RIGHT} y={0} width={TZ} height={H} fill="url(#tryzone-away)" />

      {/* Lignes du terrain */}
      {/* Lignes d'en-but */}
      <line x1={PLAY_LEFT} y1={0} x2={PLAY_LEFT} y2={H} stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
      <line x1={PLAY_RIGHT} y1={0} x2={PLAY_RIGHT} y2={H} stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
      {/* 22m */}
      <line x1={PLAY_LEFT + PLAY_W * 0.22} y1={0} x2={PLAY_LEFT + PLAY_W * 0.22} y2={H} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <line x1={PLAY_RIGHT - PLAY_W * 0.22} y1={0} x2={PLAY_RIGHT - PLAY_W * 0.22} y2={H} stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      {/* 10m (pointillés) */}
      <line x1={PLAY_LEFT + PLAY_W * 0.4} y1={0} x2={PLAY_LEFT + PLAY_W * 0.4} y2={H} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 8" />
      <line x1={PLAY_LEFT + PLAY_W * 0.6} y1={0} x2={PLAY_LEFT + PLAY_W * 0.6} y2={H} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="6 8" />
      {/* Médiane */}
      <line x1={PLAY_LEFT + PLAY_W / 2} y1={0} x2={PLAY_LEFT + PLAY_W / 2} y2={H} stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeDasharray="14 10" />
      {/* Bordure */}
      <rect x={2} y={2} width={W - 4} height={H - 4} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />

      {/* Poteaux H stylisés */}
      <PostsH x={PLAY_LEFT} h={H} side="left" />
      <PostsH x={PLAY_RIGHT} h={H} side="right" />

      {/* Drapeaux des coins */}
      <CornerFlag x={2} y={2} />
      <CornerFlag x={W - 2} y={2} />
      <CornerFlag x={2} y={H - 2} />
      <CornerFlag x={W - 2} y={H - 2} />
      <CornerFlag x={PLAY_LEFT + PLAY_W * 0.22} y={2} small />
      <CornerFlag x={PLAY_LEFT + PLAY_W * 0.22} y={H - 2} small />
      <CornerFlag x={PLAY_RIGHT - PLAY_W * 0.22} y={2} small />
      <CornerFlag x={PLAY_RIGHT - PLAY_W * 0.22} y={H - 2} small />

      {/* Étiquettes en-but */}
      <text x={TZ / 2} y={H / 2} fill="rgba(255, 255, 255, 0.18)" fontSize="42" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(-90 ${TZ / 2} ${H / 2})`}
            fontFamily="Sora, system-ui, sans-serif">
        EN-BUT
      </text>
      <text x={W - TZ / 2} y={H / 2} fill="rgba(255, 255, 255, 0.18)" fontSize="42" fontWeight="800"
            textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(90 ${W - TZ / 2} ${H / 2})`}
            fontFamily="Sora, system-ui, sans-serif">
        EN-BUT
      </text>

      {/* V0.57 — les trente joueurs, sous le ballon pour qu'il reste lisible. */}
      {actors && actors.map(a => (
        <g
          key={a.key}
          className={[
            'pitch-actor',
            a.team === 'HOME' ? 'home' : 'away',
            a.forward ? 'fwd' : 'back',
            a.spotlight ? `spot-${a.spotlight.toLowerCase()}` : '',
          ].filter(Boolean).join(' ')}
          style={{
            transform: `translate(${PLAY_LEFT + a.x * PLAY_W}px, ${a.y * H}px)`,
          }}
        >
          {a.spotlight && <circle r="20" className="actor-halo" />}
          <circle r="11" className="actor-dot" />
          <text
            className="actor-num"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontFamily="'JetBrains Mono', monospace"
          >
            {a.shirt}
          </text>
          {/* On ne nomme que les joueurs que le moteur a nommés : les autres
              sont là parce que le rugby se joue à quinze, pas parce que la
              simulation a quelque chose à dire sur eux. */}
          {a.spotlight && nameOf?.(a.playerId) && (
            <text
              className="actor-name"
              textAnchor="middle"
              y="-24"
              fontSize="15"
              fontFamily="'Inter', system-ui, sans-serif"
            >
              {nameOf(a.playerId)}
            </text>
          )}
        </g>
      ))}

      {/* Halo + ballon (animé via CSS transition) */}
      <g
        className="ball-group"
        style={{ transform: `translate(${ballX}px, ${ballY}px)` }}
      >
        <circle r="48" fill="url(#ball-glow)" className="ball-halo" />
        <ellipse rx="22" ry="13" fill="#f5deb3" stroke="#3a2818" strokeWidth="2.5" />
        {/* Lacets */}
        <line x1="-15" y1="0" x2="15" y2="0" stroke="#3a2818" strokeWidth="2" opacity="0.7" />
        <line x1="-6" y1="-3" x2="-6" y2="3" stroke="#3a2818" strokeWidth="1.5" opacity="0.6" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#3a2818" strokeWidth="1.5" opacity="0.6" />
        <line x1="6" y1="-3" x2="6" y2="3" stroke="#3a2818" strokeWidth="1.5" opacity="0.6" />
      </g>
    </svg>
  );
}

function PostsH({ x, h, side }: { x: number; h: number; side: 'left' | 'right' }) {
  // Dessin en perspective : 2 traits verticaux (montants) + une barre horizontale
  const cy = h / 2;
  const spacing = h * 0.16;
  const postH = 38;
  const cross = cy;
  const dir = side === 'left' ? 1 : -1;
  const baseX = x + dir * 0;
  const overhang = 14;
  return (
    <g className="posts" stroke="#fafafa" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85">
      <line x1={baseX} y1={cy - spacing / 2} x2={baseX} y2={cy - spacing / 2 - postH} />
      <line x1={baseX} y1={cy + spacing / 2} x2={baseX} y2={cy + spacing / 2 + postH} />
      <line x1={baseX - overhang} y1={cross} x2={baseX + overhang} y2={cross} strokeWidth="2.5" />
    </g>
  );
}

function CornerFlag({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const s = small ? 0.7 : 1;
  const h = 26 * s;
  const w = 14 * s;
  const isTop = y < 30;
  const dy = isTop ? h : -h;
  return (
    <g className="corner-flag">
      <line x1={x} y1={y} x2={x} y2={y + dy} stroke="#fafafa" strokeWidth="1.5" />
      <polygon
        points={`${x},${y + dy * 0.95} ${x + w * (x < 50 ? 1 : -1)},${y + dy * 0.78} ${x},${y + dy * 0.6}`}
        fill="#ffc14a"
      />
    </g>
  );
}

// ============================================================================
// Célébration plein écran (essai, pénalité, drop, carton)
// ============================================================================

interface CelebrationProps {
  readonly kind: 'TRY' | 'PENALTY' | 'DROP' | 'CARD';
  readonly team: 'HOME' | 'AWAY' | null;
  readonly color?: 'YELLOW' | 'RED';
  readonly homeName: string;
  readonly awayName: string;
}

function CelebrationOverlay({ kind, team, color, homeName, awayName }: CelebrationProps) {
  const teamName = team === 'HOME' ? homeName : team === 'AWAY' ? awayName : '';
  const teamClass = team === 'HOME' ? 'home' : team === 'AWAY' ? 'away' : '';

  let title = '';
  let subtitle = '';
  let glyph = '';
  let modifier = '';

  switch (kind) {
    case 'TRY':
      title = 'ESSAI';
      subtitle = teamName.toUpperCase();
      glyph = '★';
      modifier = `try ${teamClass}`;
      break;
    case 'PENALTY':
      title = '+ 3 POINTS';
      subtitle = `Pénalité · ${teamName}`;
      glyph = '⚑';
      modifier = `pen ${teamClass}`;
      break;
    case 'DROP':
      title = 'DROP !';
      subtitle = `+3 · ${teamName}`;
      glyph = '↑';
      modifier = `drop ${teamClass}`;
      break;
    case 'CARD':
      title = color === 'RED' ? 'CARTON ROUGE' : 'CARTON JAUNE';
      subtitle = 'Joueur sanctionné';
      glyph = color === 'RED' ? '⬛' : '▪';
      modifier = `card card-${(color ?? 'YELLOW').toLowerCase()}`;
      break;
  }

  return (
    <div className={`celebration ${modifier}`} aria-live="assertive">
      <div className="celebration-flash" />
      <div className="celebration-content">
        <div className="celebration-glyph" aria-hidden>{glyph}</div>
        <div className="celebration-title">{title}</div>
        <div className="celebration-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}
