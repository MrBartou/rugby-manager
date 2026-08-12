/**
 * La composition sur le terrain — V0.57.
 *
 * L'écran d'avant-match alignait quinze listes déroulantes. C'était exact et
 * illisible : on choisissait un XV sans jamais le **voir**, et rien ne disait
 * qu'un centre était aligné à l'aile, qu'un pilier sortait d'une semaine à
 * quatre-vingt-dix de fatigue, ou que la recrue de janvier n'avait pas encore
 * ses repères. Toutes ces informations existaient — dans la fiche, dans le
 * moteur — mais pas là où se prend la décision.
 *
 * Ici, le XV est une feuille de match : quinze maillots à leur place, dans
 * l'ordre des numéros, et l'on y dépose les joueurs.
 *
 * ## Ce que chaque maillot dit sans qu'on clique
 *
 *  - **la couleur du liseré** : à son poste, poste voisin, ou hors de son
 *    registre — c'est `roleFitness` du moteur, pas une appréciation d'ici ;
 *  - **la barre du bas** : la condition physique, la seule jauge qu'on lit
 *    d'un coup d'œil avant de composer ;
 *  - **les pastilles** : brassard, buteur, recrue en acclimatation.
 *
 * ## Deux façons de composer, exprès
 *
 * Le glisser-déposer est le geste naturel à la souris. Il ne l'est pas au
 * doigt, et il n'existe pas au clavier. Chaque maillot est donc aussi un
 * bouton : on le sélectionne, la liste de droite se filtre sur son poste, on
 * choisit. Les deux chemins passent par la même fonction d'affectation — celle
 * qui gérait déjà l'échange entre deux postes.
 */

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Player, Position } from '../../engine/types.js';
import { positionLabel, positionNumber, positionShort } from './DataBits.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import { adaptationProgress } from '../../engine/club/adaptation.js';

// =============================================================================
// La feuille de match, vue de dessus
// =============================================================================

/**
 * Place de chaque poste sur le terrain, en fractions de la surface.
 *
 * `y` va de 0 (ligne d'en-but à défendre, tout en bas) à 1 (l'adversaire, en
 * haut) : le pack est donc devant, l'arrière derrière, comme sur une feuille de
 * match. Les valeurs ne sont pas les positions réelles d'un joueur de rugby à
 * un instant donné — c'est une **formation au repos**, celle qu'on dessine au
 * tableau. La vraie mise en place phase par phase est un autre sujet, et un
 * autre module.
 */
const SLOT: Readonly<Record<Position, { x: number; y: number }>> = {
  PILIER_GAUCHE: { x: 0.30, y: 0.90 },
  TALONNEUR: { x: 0.50, y: 0.92 },
  PILIER_DROIT: { x: 0.70, y: 0.90 },
  DEUXIEME_LIGNE_GAUCHE: { x: 0.38, y: 0.76 },
  DEUXIEME_LIGNE_DROITE: { x: 0.62, y: 0.76 },
  TROISIEME_LIGNE_AILE_GAUCHE: { x: 0.22, y: 0.64 },
  TROISIEME_LIGNE_AILE_DROITE: { x: 0.78, y: 0.64 },
  NUMERO_8: { x: 0.50, y: 0.62 },
  DEMI_DE_MELEE: { x: 0.50, y: 0.48 },
  OUVREUR: { x: 0.33, y: 0.38 },
  CENTRE_INTERIEUR: { x: 0.50, y: 0.28 },
  CENTRE_EXTERIEUR: { x: 0.67, y: 0.28 },
  AILIER_GAUCHE: { x: 0.11, y: 0.22 },
  AILIER_DROIT: { x: 0.89, y: 0.22 },
  ARRIERE: { x: 0.50, y: 0.08 },
};

// =============================================================================
// À quel point il est à sa place
// =============================================================================

type Fit = 'NATUREL' | 'VOISIN' | 'HORS_REGISTRE';

/**
 * Postes qu'un joueur couvre sans qu'on crie au sacrilège.
 *
 * Volontairement plus large que le poste exact, et volontairement plus étroit
 * que « tout avant peut jouer avant » : un talonneur en deuxième ligne n'est
 * pas un aménagement, c'est un aveu.
 */
const NEIGHBOURS: Readonly<Record<Position, readonly Position[]>> = {
  PILIER_GAUCHE: ['PILIER_DROIT'],
  PILIER_DROIT: ['PILIER_GAUCHE'],
  TALONNEUR: [],
  DEUXIEME_LIGNE_GAUCHE: ['DEUXIEME_LIGNE_DROITE', 'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE'],
  DEUXIEME_LIGNE_DROITE: ['DEUXIEME_LIGNE_GAUCHE', 'TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE'],
  TROISIEME_LIGNE_AILE_GAUCHE: ['TROISIEME_LIGNE_AILE_DROITE', 'NUMERO_8', 'DEUXIEME_LIGNE_GAUCHE'],
  TROISIEME_LIGNE_AILE_DROITE: ['TROISIEME_LIGNE_AILE_GAUCHE', 'NUMERO_8', 'DEUXIEME_LIGNE_DROITE'],
  NUMERO_8: ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE'],
  DEMI_DE_MELEE: [],
  OUVREUR: ['CENTRE_INTERIEUR', 'ARRIERE'],
  CENTRE_INTERIEUR: ['CENTRE_EXTERIEUR', 'OUVREUR'],
  CENTRE_EXTERIEUR: ['CENTRE_INTERIEUR', 'AILIER_GAUCHE', 'AILIER_DROIT'],
  AILIER_GAUCHE: ['AILIER_DROIT', 'ARRIERE', 'CENTRE_EXTERIEUR'],
  AILIER_DROIT: ['AILIER_GAUCHE', 'ARRIERE', 'CENTRE_EXTERIEUR'],
  ARRIERE: ['AILIER_GAUCHE', 'AILIER_DROIT', 'OUVREUR'],
};

/**
 * Paires réellement interchangeables.
 *
 * Distinction qui compte, et que le jeu ratait : deux deuxièmes lignes, deux
 * troisièmes lignes aile ou deux ailiers occupent le même poste à un côté du
 * terrain près — les annoncer « poste voisin » revenait à signaler un
 * aménagement là où il n'y en a aucun. Les piliers, eux, ne s'échangent pas :
 * gauche et droit sont deux métiers, et c'est précisément le genre de bascule
 * que le manager doit voir signalée.
 */
const EQUIVALENT: readonly (readonly [Position, Position])[] = [
  ['DEUXIEME_LIGNE_GAUCHE', 'DEUXIEME_LIGNE_DROITE'],
  ['TROISIEME_LIGNE_AILE_GAUCHE', 'TROISIEME_LIGNE_AILE_DROITE'],
  ['AILIER_GAUCHE', 'AILIER_DROIT'],
];

function isEquivalent(a: Position, b: Position): boolean {
  return EQUIVALENT.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

export function fitFor(player: Player, slot: Position): Fit {
  if (player.position === slot) return 'NATUREL';
  if (player.secondaryPositions.includes(slot)) return 'NATUREL';
  if (isEquivalent(player.position, slot)) return 'NATUREL';
  if (NEIGHBOURS[player.position]?.includes(slot)) return 'VOISIN';
  return 'HORS_REGISTRE';
}

const FIT_HINT: Readonly<Record<Fit, string>> = {
  NATUREL: 'à son poste',
  VOISIN: 'poste voisin — il s\'en sortira',
  HORS_REGISTRE: 'hors de son registre',
};

function overall(p: Player): number {
  return Math.round(
    (p.technical.passe + p.technical.plaquage + p.technical.visionDeJeu
      + p.physical.vitesse + p.physical.puissance + p.mental.decision) / 6,
  );
}

// =============================================================================
// Le composant
// =============================================================================

export interface LineupSlot {
  readonly playerId: string;
  readonly position: Position;
}

interface Props {
  readonly starters: readonly LineupSlot[];
  readonly substitutes: readonly string[];
  readonly byId: ReadonlyMap<string, Player>;
  /** Joueurs alignables — blessés, suspendus et prêtés déjà écartés. */
  readonly selectable: readonly Player[];
  readonly captainId: string;
  readonly kickerId: string;
  /** Journée courante, pour savoir si une recrue est encore en acclimatation. */
  readonly currentRound?: number;
  readonly clubId: string;
  readonly onAssignStarter: (slotIndex: number, playerId: string) => void;
  readonly onAssignSub: (benchIndex: number, playerId: string) => void;
  /**
   * Contrôles propres au poste sélectionné — le rôle, en pratique.
   *
   * Passé de l'extérieur plutôt que câblé ici : le poste dit où l'on joue, le
   * rôle dit comment, et ce second choix appartient à l'écran d'avant-match,
   * pas au dessin du terrain.
   */
  readonly renderSlotExtra?: (slot: LineupSlot, index: number) => ReactNode;
}

/** Ce qu'on est en train de déplacer. */
type Held =
  | { readonly from: 'STARTER'; readonly index: number; readonly playerId: string }
  | { readonly from: 'BENCH'; readonly index: number; readonly playerId: string }
  | { readonly from: 'LIST'; readonly playerId: string };

export function LineupPitch({
  starters, substitutes, byId, selectable,
  captainId, kickerId, currentRound, clubId,
  onAssignStarter, onAssignSub, renderSlotExtra,
}: Props) {
  const [held, setHeld] = useState<Held | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const onSheet = new Set<string>([...starters.map(s => s.playerId), ...substitutes]);

  const drop = (target: { kind: 'STARTER' | 'BENCH'; index: number }): void => {
    if (!held) return;
    if (target.kind === 'STARTER') onAssignStarter(target.index, held.playerId);
    else onAssignSub(target.index, held.playerId);
    setHeld(null);
    setHovered(null);
  };

  /**
   * Les candidats proposés pour le poste sélectionné.
   *
   * Triés par aptitude d'abord, niveau ensuite : c'est l'ordre dans lequel un
   * entraîneur y pense. Ceux qui sont déjà sur la feuille restent proposés —
   * les échanger est une décision courante — mais signalés.
   */
  const candidatesFor = (slot: Position): readonly Player[] => {
    const rank: Record<Fit, number> = { NATUREL: 0, VOISIN: 1, HORS_REGISTRE: 2 };
    return [...selectable].sort((a, b) => {
      const f = rank[fitFor(a, slot)] - rank[fitFor(b, slot)];
      return f !== 0 ? f : overall(b) - overall(a);
    });
  };

  const accent = readableAccent(clubIdentity(clubId).primary);
  const slotPos = selectedSlot !== null ? starters[selectedSlot]?.position : undefined;

  return (
    <div className="lineup-board" style={{ ['--sheet-accent' as string]: accent } as CSSProperties}>
      <div className="lineup-pitch" onDragOver={e => e.preventDefault()}>
        <PitchLines />

        {starters.map((slot, index) => {
          const player = byId.get(slot.playerId);
          const place = SLOT[slot.position];
          return (
            <Jersey
              key={`${slot.position}_${index}`}
              player={player}
              slot={slot.position}
              x={place.x}
              y={place.y}
              selected={selectedSlot === index}
              dropping={hovered === `s${index}`}
              isCaptain={slot.playerId === captainId}
              isKicker={slot.playerId === kickerId}
              {...(currentRound !== undefined ? { currentRound } : {})}
              onPick={() => setSelectedSlot(selectedSlot === index ? null : index)}
              onDragStart={() => setHeld({ from: 'STARTER', index, playerId: slot.playerId })}
              onDragEnd={() => { setHeld(null); setHovered(null); }}
              onDragEnter={() => setHovered(`s${index}`)}
              onDrop={() => drop({ kind: 'STARTER', index })}
            />
          );
        })}
      </div>

      <div className="lineup-side">
        <div className="lineup-bench">
          <div className="lb-title">Banc — 8 remplaçants</div>
          <div className="lb-slots">
            {Array.from({ length: 8 }, (_, i) => {
              const player = byId.get(substitutes[i] ?? '');
              return (
                <button
                  key={i}
                  type="button"
                  className={`bench-slot ${hovered === `b${i}` ? 'dropping' : ''} ${player ? '' : 'empty'}`}
                  draggable={player !== undefined}
                  onDragStart={() => player && setHeld({ from: 'BENCH', index: i, playerId: player.id as string })}
                  onDragEnd={() => { setHeld(null); setHovered(null); }}
                  onDragOver={e => e.preventDefault()}
                  onDragEnter={() => setHovered(`b${i}`)}
                  onDrop={() => drop({ kind: 'BENCH', index: i })}
                  onClick={() => {
                    if (selectedSlot === null) return;
                    const leaving = starters[selectedSlot]?.playerId;
                    if (leaving) onAssignSub(i, leaving);
                    setSelectedSlot(null);
                  }}
                  title={player ? `${player.firstName} ${player.lastName}` : 'Place libre'}
                >
                  <span className="bs-num">{16 + i}</span>
                  <span className="bs-name">{player ? player.lastName : '—'}</span>
                  {player && <span className="bs-pos">{positionShort(player.position)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lineup-picker">
          {slotPos === undefined ? (
            <div className="lp-idle">
              <strong>Touchez un maillot</strong> pour changer de joueur, ou
              faites-en glisser un d'un poste à l'autre.
            </div>
          ) : (
            <>
              <div className="lp-title">
                <span className="lp-num">{positionNumber(slotPos)}</span>
                {positionLabel(slotPos)}
                <button type="button" className="lp-close" onClick={() => setSelectedSlot(null)}>Fermer</button>
              </div>
              {selectedSlot !== null && starters[selectedSlot] && renderSlotExtra?.(starters[selectedSlot], selectedSlot)}
              <ul className="lp-list">
                {candidatesFor(slotPos).map(p => {
                  const fit = fitFor(p, slotPos);
                  const id = p.id as string;
                  const here = starters[selectedSlot ?? -1]?.playerId === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={`lp-candidate fit-${fit.toLowerCase()} ${here ? 'current' : ''}`}
                        draggable
                        onDragStart={() => setHeld({ from: 'LIST', playerId: id })}
                        onDragEnd={() => setHeld(null)}
                        onClick={() => {
                          if (selectedSlot === null) return;
                          onAssignStarter(selectedSlot, id);
                          setSelectedSlot(null);
                        }}
                      >
                        <span className="lpc-pos">{positionShort(p.position)}</span>
                        <span className="lpc-name">{p.firstName} {p.lastName}</span>
                        <span className="lpc-note">{overall(p)}</span>
                        <span className="lpc-fit">{FIT_HINT[fit]}</span>
                        {here && <span className="lpc-here">en place</span>}
                        {!here && onSheet.has(id) && <span className="lpc-used">déjà sur la feuille</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Le maillot
// =============================================================================

interface JerseyProps {
  readonly player: Player | undefined;
  readonly slot: Position;
  readonly x: number;
  readonly y: number;
  readonly selected: boolean;
  readonly dropping: boolean;
  readonly isCaptain: boolean;
  readonly isKicker: boolean;
  readonly currentRound?: number;
  readonly onPick: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  readonly onDragEnter: () => void;
  readonly onDrop: () => void;
}

function Jersey({
  player, slot, x, y, selected, dropping, isCaptain, isKicker, currentRound,
  onPick, onDragStart, onDragEnd, onDragEnter, onDrop,
}: JerseyProps) {
  const fit = player ? fitFor(player, slot) : 'NATUREL';
  const condition = player ? Math.max(0, 100 - player.dynamic.fatigue) : 0;
  // V0.55 — une recrue qui n'a pas fini de s'acclimater ne joue pas à cent
  // pour cent. L'information existait sur la fiche ; elle a sa place ici, au
  // moment où l'on décide de l'aligner.
  const settling = player !== undefined
    && currentRound !== undefined
    && adaptationProgress({ player, currentRound }) < 1;

  return (
    <button
      type="button"
      className={[
        'pitch-jersey',
        `fit-${fit.toLowerCase()}`,
        selected ? 'selected' : '',
        dropping ? 'dropping' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
      draggable={player !== undefined}
      onClick={onPick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      title={player
        ? `${player.firstName} ${player.lastName} — ${FIT_HINT[fit]}`
        : 'Poste vacant'}
    >
      <span className="pj-shirt" aria-hidden>
        <span className="pj-num">{positionNumber(slot)}</span>
      </span>
      <span className="pj-name">{player ? player.lastName : '—'}</span>
      <span className="pj-meta">
        {player && <span className="pj-note">{overall(player)}</span>}
        {isCaptain && <span className="pj-badge cap" title="Capitaine">C</span>}
        {isKicker && <span className="pj-badge kick" title="Buteur">⌖</span>}
        {settling && <span className="pj-badge new" title="Vient d'arriver — il cherche encore ses repères">↻</span>}
      </span>
      <span className="pj-condition" aria-hidden>
        <span
          className={`pj-condition-fill ${condition < 40 ? 'low' : condition < 70 ? 'mid' : ''}`}
          style={{ width: `${condition}%` }}
        />
      </span>
    </button>
  );
}

/**
 * Le terrain lui-même.
 *
 * Vu de derrière l'en-but à défendre, l'adversaire en haut : c'est
 * l'orientation d'un tableau de vestiaire, pas celle de la vue de match — on ne
 * regarde pas une composition comme on regarde une rencontre.
 */
function PitchLines() {
  return (
    <svg className="lineup-pitch-svg" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="lp-turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12321f" />
          <stop offset="50%" stopColor="#0f2a1a" />
          <stop offset="100%" stopColor="#0c2115" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" fill="url(#lp-turf)" />
      {/* Bandes de tonte */}
      {Array.from({ length: 14 }, (_, i) => (
        <rect
          key={i}
          x="0"
          y={i * 10}
          width="100"
          height="10"
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'transparent'}
        />
      ))}
      {/* Lignes : en-but adverse en haut, 22 m, médiane, 22 m, en-but à défendre */}
      <g stroke="rgba(255,255,255,0.30)" strokeWidth="0.5" fill="none">
        <rect x="1" y="1" width="98" height="138" />
        <line x1="1" y1="12" x2="99" y2="12" />
        <line x1="1" y1="40" x2="99" y2="40" />
        <line x1="1" y1="70" x2="99" y2="70" strokeWidth="0.8" />
        <line x1="1" y1="100" x2="99" y2="100" />
        <line x1="1" y1="128" x2="99" y2="128" />
      </g>
      <g stroke="rgba(255,255,255,0.14)" strokeWidth="0.35" strokeDasharray="2 3" fill="none">
        <line x1="20" y1="1" x2="20" y2="139" />
        <line x1="80" y1="1" x2="80" y2="139" />
      </g>
    </svg>
  );
}
