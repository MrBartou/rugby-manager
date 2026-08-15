/**
 * Écran de préparation pré-match : entraînement de la semaine + composition.
 *
 * Référence : 02-gdd.md (boucle hebdomadaire — 4 jours actifs).
 *
 * V0.3 condensé :
 *   - Bloc "Préparation de la semaine" : 2 choix (charge entraînement, focus tactique)
 *   - Bloc "Composition" : 15 sélecteurs de poste + bench
 *   - Bouton "Lancer le match"
 *
 * V0.4+ : éclatera en écrans séparés (Lun, Mar, Mer, Jeu).
 */

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ClubCrest } from '../components/ClubCrest.js';
import { StadiumBackdrop } from '../components/StadiumBackdrop.js';
import { clubCssVars, clubIdentity, readableAccent } from '../theme/club-identity.js';
import type { Player, PlayerId, Position } from '../../engine/types.js';
import type { ManualLineup } from '../../data/seed-browser.js';

export type TrainingLoad = 'LIGHT' | 'MEDIUM' | 'HARD';
export type TacticalFocus = 'PACK' | 'BACKS' | 'MIXED';

import type { WeekPlan } from '../../engine/match/week-plan.js';
import type { PreMatchTacticalPlan } from '../../engine/match/types.js';
import {
  bestRoleFor,
  roleById,
  rolesForPosition,
  type RoleId,
} from '../../engine/match/roles.js';
import {
  DEFENSIVE_LINE_HINT,
  DEFENSIVE_LINE_LABEL,
  OCCUPATION_HINT,
  OCCUPATION_LABEL,
  SET_PIECE_LABEL,
} from '../../engine/match/tactics.js';
import { OpponentDossier } from '../components/OpponentDossier.js';
import {
  MAX_CALLS,
  MIN_CALLS,
  READ_MIN_SAMPLE,
  validatePlaybook,
  type CallUsage,
  type LineoutCall,
  type Playbook,
} from '../../engine/match/playbook.js';
import { LineupPitch, type LineupSlot } from '../components/LineupPitch.js';
import { CROWD_LABEL, crowdHint, type CrowdLevel } from '../../engine/match/crowd.js';
import { captainAuthority, suggestCaptain } from '../../engine/match/captain.js';
import { moraleHint, teamMorale } from '../../engine/match/morale.js';
import { WEATHER_LABEL, weatherHint } from '../../engine/match/weather.js';
import {
  POLICY_HINT,
  POLICY_LABEL,
  recommendedPolicy,
  type DisciplinePolicy,
  type Referee,
} from '../../engine/match/referee.js';
import { weekForecast } from '../../engine/club/training-week.js';
import type { OpponentReport } from '../../engine/club/opponent-report.js';
export type { WeekPlan };

type PlaybookEditorProps = {
  readonly playbook: Playbook;
  readonly usage: CallUsage;
  readonly forwards: readonly Player[];
  readonly onChange: (playbook: Playbook) => void;
};

interface Props {
  readonly homeClubName: string;
  readonly awayClubName: string;
  /** V0.24 — identité des deux clubs : blasons et couleurs de l'affiche. */
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly isHome: boolean;
  readonly roster: readonly Player[];
  readonly initialLineup: ManualLineup;
  /**
   * V0.50 — capitaine en titre du club.
   *
   * Le brassard était réattribué à l'ouvreur avant chaque match : le choix du
   * manager ne survivait pas à la rencontre. Il est désormais porté par le club.
   */
  readonly currentCaptainId?: string;
  /**
   * V0.65 : le carnet de touche, et ce qu'il a déjà servi cette saison.
   *
   * Il se dessine ici parce que c'est ici qu'on prépare la rencontre, et parce
   * que la part d'usage de chaque combinaison n'a de sens qu'à côté du bouton
   * qui permet d'en changer.
   */
  readonly playbook?: {
    readonly value: Playbook;
    readonly usage: CallUsage;
    readonly onChange: (playbook: Playbook) => void;
  };
  /** V0.51 — graphe de relations du club, pour la cohésion du XV aligné. */
  readonly relations?: import('../../engine/human/relationships.js').RelationsState;
  /**
   * V0.51 — conditions annoncées.
   *
   * C'est le premier élément qui rend la préparation situationnelle : un plan
   * de match n'est plus bon dans l'absolu, il l'est pour ce temps-là.
   */
  readonly conditions?: {
    readonly weather: import('../../engine/match/types.js').MatchInput['weather'];
    readonly fieldCondition: import('../../engine/match/types.js').MatchInput['fieldCondition'];
  };
  /**
   * V0.52 — l'arbitre désigné.
   *
   * On prépare aussi contre lui : sa sévérité au sol décide si contester chaque
   * ballon est une bonne idée ou une façon de lui offrir des pénalités.
   */
  readonly referee?: Referee;
  /**
   * V0.55 — joueurs indisponibles : sélections internationales et prêts.
   *
   * Sans ce filtre, un joueur prêté restait choisissable à la main — la compo
   * automatique l'écartait, le manager pouvait le remettre.
   */
  readonly unavailable?: ReadonlySet<PlayerId>;
  /**
   * V0.57 — journée courante.
   *
   * Sert au terrain de composition : une recrue qui n'a pas fini de
   * s'acclimater porte une pastille sur son maillot. L'information existait sur
   * la fiche depuis la V0.55, jamais au moment où l'on décide de l'aligner.
   */
  readonly currentRound?: number;
  /**
   * V0.58 — l'affluence annoncée, quand on reçoit.
   *
   * `homeFans` était un champ mort de la feuille de match ; le remplissage se
   * calculait bien mais son effet était bricolé ailleurs et jamais montré. Le
   * manager voit désormais ce que sa politique tarifaire et sa saison ont
   * produit, avant de composer.
   */
  readonly crowd?: { readonly level: CrowdLevel; readonly attendance: number; readonly capacity: number };
  /** V0.32 — le plan de match part avec la compo : c'est la même décision. */
  readonly onPlay: (
    lineup: ManualLineup,
    plan: WeekPlan,
    tactics: PreMatchTacticalPlan,
    discipline: DisciplinePolicy,
  ) => void;
  /**
   * V0.36 — dossier sur l'adversaire. Absent pour un match libre : on prépare
   * alors sans renseignement, comme avant.
   */
  readonly opponentReport?: OpponentReport;
  /** V0.44 — qualité de la préparation physique, qui module le risque annoncé. */
  readonly medicalQuality: number;
  /**
   * V0.48 — ce que la presse rappelle avant un derby.
   *
   * Absent quand la rencontre n'a pas d'histoire : afficher un encart vide
   * banaliserait précisément ce qu'on cherche à distinguer.
   */
  readonly rivalry?: string;
  /** V0.43 — mission d'observation sur l'adversaire du jour. */
  readonly opponentScouting?: {
    readonly assigned: boolean;
    readonly canAssign: boolean;
    readonly slotCost: number;
    readonly onToggle: () => void;
  };
  readonly onBack: () => void;
}

const POSITION_LABEL: Record<Position, string> = {
  PILIER_GAUCHE: 'Pilier gauche',
  TALONNEUR: 'Talonneur',
  PILIER_DROIT: 'Pilier droit',
  DEUXIEME_LIGNE_GAUCHE: '2e ligne G',
  DEUXIEME_LIGNE_DROITE: '2e ligne D',
  TROISIEME_LIGNE_AILE_GAUCHE: '3e ligne aile G',
  TROISIEME_LIGNE_AILE_DROITE: '3e ligne aile D',
  NUMERO_8: 'Numéro 8',
  DEMI_DE_MELEE: 'Demi de mêlée',
  OUVREUR: 'Ouvreur',
  CENTRE_INTERIEUR: 'Centre intérieur',
  CENTRE_EXTERIEUR: 'Centre extérieur',
  AILIER_GAUCHE: 'Ailier gauche',
  AILIER_DROIT: 'Ailier droit',
  ARRIERE: 'Arrière',
};

/* V0.57 — `isPositionMatching` a disparu avec les listes déroulantes.
   Le terrain de composition propose tout l'effectif alignable, trié par
   aptitude au poste : filtrer en amont interdisait un dépannage que le manager
   doit pouvoir décider lui-même, au prix affiché. */

function playerOverall(p: Player): number {
  return Math.round(
    (p.technical.passe + p.technical.plaquage + p.technical.visionDeJeu + p.physical.vitesse + p.physical.puissance + p.mental.decision) / 6
  );
}

export function PreMatchScreen({
  homeClubName, homeClubId, awayClubId,
  awayClubName,
  isHome,
  roster,
  initialLineup,
  currentCaptainId,
  relations,
  conditions,
  referee,
  unavailable,
  currentRound,
  crowd,
  onPlay,
  onBack,
  opponentReport,
  opponentScouting,
  medicalQuality,
  rivalry,
  playbook,
}: Props) {
  const [starters, setStarters] = useState<readonly { playerId: string; position: Position }[]>(initialLineup.starters);
  const [subs, setSubs] = useState<readonly string[]>(initialLineup.substitutes);
  const [load, setLoad] = useState<TrainingLoad>('MEDIUM');
  const [focus, setFocus] = useState<TacticalFocus>('MIXED');
  /*
   * V0.65 — la philosophie de touche n'est plus réglable ici : le carnet de
   * combinaisons la remplace, et laisser les deux aurait donné deux réglages
   * pour la même chose, dont un que le moteur n'aurait plus jamais lu. Elle
   * reste transmise en repli, pour une sauvegarde sans carnet.
   */
  const lineoutPhilo = 'SAUT_RAPIDE' as const;
  // V0.32 — plan de match.
  const [occupation, setOccupation] = useState<PreMatchTacticalPlan['occupation']>('MEDIANE');
  const [defLine, setDefLine] = useState<PreMatchTacticalPlan['defensiveLine']>('RIDEAU');
  const [setPieces, setSetPieces] = useState<readonly ('MELEE' | 'TOUCHE' | 'MAUL')[]>([]);
  // V0.52 — consigne au sol. Le staff conseille, le manager tranche.
  const [discipline, setDiscipline] = useState<DisciplinePolicy>('EQUILIBRE');

  // V0.34 — rôles choisis explicitement. Les postes non renseignés retombent
  // sur le rôle qui met le mieux en valeur le joueur.
  const [roles, setRoles] = useState<Readonly<Record<string, RoleId>>>({});
  const setRoleFor = (playerId: string, roleId: RoleId): void => {
    setRoles(prev => ({ ...prev, [playerId]: roleId }));
  };

  const toggleSetPiece = (f: 'MELEE' | 'TOUCHE' | 'MAUL'): void => {
    setSetPieces(prev => (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]));
  };

  const byId = useMemo(() => new Map<string, Player>(roster.map(p => [p.id as string, p] as const)), [roster]);

  // Capitaine et buteur, initialisés à partir des titulaires de départ
  // Le capitaine en titre s'il est sur la feuille, sinon celui du XV qui a le
  // plus d'autorité — et non plus l'ouvreur, qui est le meneur de jeu et pas
  // forcément le meneur d'hommes.
  const initialCaptain = (): string => {
    const onSheet = initialLineup.starters.some(s => s.playerId === currentCaptainId);
    if (currentCaptainId !== undefined && onSheet) return currentCaptainId;
    const starterPlayers = initialLineup.starters
      .map(s => byId.get(s.playerId))
      .filter((p): p is Player => p !== undefined);
    return (suggestCaptain(starterPlayers)?.id as string | undefined)
      ?? initialLineup.starters[0]?.playerId ?? '';
  };
  const initialKicker = (): string => {
    let best: Player | undefined;
    let bestScore = -1;
    for (const s of initialLineup.starters) {
      const p = byId.get(s.playerId);
      if (p && p.technical.jeuAuPiedPlace > bestScore) {
        best = p;
        bestScore = p.technical.jeuAuPiedPlace;
      }
    }
    return best?.id as string ?? '';
  };
  const [captainId, setCaptainId] = useState<string>(initialCaptain);
  const [kickerId, setKickerId] = useState<string>(initialKicker);

  // V0.9 — exclure les blessés et suspendus des sélecteurs de compo
  // V0.55 — un joueur prêté ou appelé en sélection n'est pas alignable, au même
  // titre qu'un blessé. Sans ce filtre, il restait choisissable à la main : la
  // compo automatique l'écartait, le manager pouvait le remettre.
  const isPlayerSelectable = (p: Player): boolean =>
    !p.dynamic.injury
    && p.dynamic.suspendedUntilRound === undefined
    && !(unavailable?.has(p.id) ?? false);

  const availableForBench = (): readonly Player[] => {
    return roster
      .filter(isPlayerSelectable)
      .slice()
      .sort((a, b) => playerOverall(b) - playerOverall(a));
  };

  /**
   * Bascule un joueur vers le slot starter idx :
   *   - Si le joueur est dans le banc, on le retire du banc
   *   - Si le joueur est dans un autre slot starter, on swap avec le joueur sortant
   */
  const setStarterAt = (idx: number, playerId: string): void => {
    setSubs(prev => prev.filter(id => id !== playerId));
    setStarters(prev => {
      const existingIdx = prev.findIndex(s => s.playerId === playerId);
      const oldOccupant = prev[idx]?.playerId ?? '';
      if (existingIdx >= 0 && existingIdx !== idx && oldOccupant) {
        // Swap entre deux slots titulaires
        return prev.map((s, i) =>
          i === idx ? { ...s, playerId } :
          i === existingIdx ? { ...s, playerId: oldOccupant } :
          s
        );
      }
      return prev.map((s, i) => i === idx ? { ...s, playerId } : s);
    });
  };

  /**
   * Bascule un joueur vers le slot banc idx :
   *   - Si le joueur est titulaire, on le retire du XV (le slot devient vide... problématique)
   *     → solution V0.3.1 : on swap avec le joueur courant du banc
   *   - Si déjà dans un autre slot du banc, on swap
   */
  const setSubAt = (idx: number, playerId: string): void => {
    const oldSub = subs[idx];
    const fromStartersIdx = starters.findIndex(s => s.playerId === playerId);

    if (fromStartersIdx >= 0 && oldSub) {
      // Le joueur sélectionné est titulaire → on l'envoie au banc, et l'ex-banc devient titulaire
      setStarters(prev => prev.map((s, i) => i === fromStartersIdx ? { ...s, playerId: oldSub } : s));
      setSubs(prev => prev.map((s, i) => i === idx ? playerId : s));
      return;
    }

    // Sinon swap classique dans le banc
    setSubs(prev => {
      const existingIdx = prev.findIndex(s => s === playerId);
      if (existingIdx >= 0 && existingIdx !== idx && oldSub) {
        return prev.map((s, i) =>
          i === idx ? playerId :
          i === existingIdx ? oldSub :
          s
        );
      }
      return prev.map((s, i) => i === idx ? playerId : s);
    });
  };

  const goPlay = (): void => {
    const lineup: ManualLineup = {
      starters,
      substitutes: subs,
      ...(captainId ? { captainPlayerId: captainId } : {}),
      ...(kickerId ? { placeKickerId: kickerId } : {}),
      roles,
    };
    onPlay(lineup, { load, focus, lineoutPhilosophy: lineoutPhilo }, {
      occupation,
      defensiveLine: defLine,
      setPiecesFocus: setPieces.length > 0 ? setPieces : ['NONE'],
    }, discipline);
  };

  // Indicateurs d'effectif
  const avgStarter = useMemo(() => {
    let total = 0;
    let n = 0;
    for (const s of starters) {
      const p = byId.get(s.playerId);
      if (p) { total += playerOverall(p); n++; }
    }
    return n ? Math.round(total / n) : 0;
  }, [starters, byId]);

  // V0.8 phase 1 : compte JIFF de la feuille (starters + remplaçants)
  /**
   * V0.51 — état du XV aligné, tel que le moteur le lira au coup d'envoi.
   *
   * Calculé sur les titulaires choisis à l'instant, pas sur l'effectif : c'est
   * bien ces quinze-là qui entreront sur le terrain.
   */
  const xvMorale = useMemo(() => teamMorale(
    starters.map(s => byId.get(s.playerId)).filter((p): p is Player => p !== undefined),
    relations,
  ), [starters, byId, relations]);

  const feuilleJiffStats = useMemo(() => {
    const ids = new Set<string>([...starters.map(s => s.playerId), ...subs]);
    let jiffCount = 0;
    let total = 0;
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      total++;
      if (p.isJiff) jiffCount++;
    }
    return { total, jiffCount, ratio: total > 0 ? jiffCount / total : 0 };
  }, [starters, subs, byId]);

  return (
    <section
      className="pre-match"
      // Cet écran est rendu hors de la coque : sans ces variables, l'accent
      // retombait sur le menthe par défaut au lieu de la couleur du club.
      style={clubCssVars(isHome ? homeClubId : awayClubId) as CSSProperties}
    >
      {/* V0.24 — l'affiche du match remplace un simple titre : c'est le dernier
          écran avant le coup d'envoi, il doit installer l'enjeu. */}
      <div
        className="pm-poster"
        style={{
          ['--home-color' as string]: readableAccent(clubIdentity(homeClubId).primary),
          ['--away-color' as string]: readableAccent(clubIdentity(awayClubId).primary),
        }}
      >
        <StadiumBackdrop
          className="pm-poster-bg"
          seed={homeClubId}
          accent={readableAccent(clubIdentity(homeClubId).primary)}
          intensity={0.6}
        />

        <button onClick={onBack} type="button" className="pm-back">← Dashboard</button>

        <div className="pm-fixture">
          <div className="pm-side home">
            <ClubCrest clubId={homeClubId} initials={homeClubName.slice(0, 3)} size={52} />
            <div className="pm-side-text">
              <span className="pm-club">{homeClubName}</span>
              <span className="pm-role">Reçoit</span>
            </div>
          </div>

          <span className="pm-vs">VS</span>

          <div className="pm-side away">
            <div className="pm-side-text">
              <span className="pm-club">{awayClubName}</span>
              <span className="pm-role">Se déplace</span>
            </div>
            <ClubCrest clubId={awayClubId} initials={awayClubName.slice(0, 3)} size={52} />
          </div>
        </div>

        <p className="pm-help">
          {isHome
            ? 'Vous recevez. Préparez la semaine et validez votre composition.'
            : 'Vous vous déplacez. Préparez la semaine et validez votre composition.'}
        </p>
      </div>

      <div className="pre-match-grid">
        {/* ---- Dossier adversaire (V0.36) --------------------------------- */}
        {opponentReport && (
          <OpponentDossier
            report={opponentReport}
            {...(opponentScouting ? { scouting: opponentScouting } : {})}
          />
        )}

        <div className="dashboard-panel">
          {rivalry && <div className="rivalry-banner">{rivalry}</div>}
          <div className="panel-tag">Préparation de la semaine</div>
          <div className="prep-row">
            <div className="prep-label">Charge d'entraînement</div>
            <div className="seg-btn">
              {(['LIGHT', 'MEDIUM', 'HARD'] as TrainingLoad[]).map(l => (
                <button
                  key={l}
                  type="button"
                  className={l === load ? 'active' : ''}
                  onClick={() => setLoad(l)}
                >
                  {l === 'LIGHT' ? 'Légère' : l === 'MEDIUM' ? 'Modérée' : 'Forte'}
                </button>
              ))}
            </div>
            {/* V0.44 — le pronostic est annoncé avant le choix. Charger était
                gratuit tant que le risque restait invisible ; le montrer est ce
                qui transforme un curseur de bonus en arbitrage. */}
            <div className="prep-hint">
              {weekForecast(load, roster.filter(p => !p.retired && !p.freeAgent).length, medicalQuality)}
            </div>
          </div>

          <div className="prep-row">
            <div className="prep-label">Focus tactique</div>
            <div className="seg-btn">
              {(['PACK', 'MIXED', 'BACKS'] as TacticalFocus[]).map(f => (
                <button
                  key={f}
                  type="button"
                  className={f === focus ? 'active' : ''}
                  onClick={() => setFocus(f)}
                >
                  {f === 'PACK' ? 'Avants' : f === 'MIXED' ? 'Mixte' : 'Arrières'}
                </button>
              ))}
            </div>
            <div className="prep-hint">
              {focus === 'PACK' && 'Travail mêlée + maul pénétrant — bonus en mêlée et au ruck.'}
              {focus === 'MIXED' && 'Approche équilibrée — bonus modeste partout.'}
              {focus === 'BACKS' && 'Lancements de jeu déployés — bonus en jeu courant.'}
            </div>
          </div>

          {/* V0.65 — le carnet remplace la philosophie de touche, qui ne
              proposait qu'un mot pour toute la saison. Elle reste le repli des
              clubs gérés par la machine, où personne ne dessine rien. */}
          {playbook && (
            <PlaybookEditor
              playbook={playbook.value}
              usage={playbook.usage}
              forwards={starters
                .map(s => byId.get(s.playerId))
                .filter((p): p is Player => p !== undefined)
                .slice(0, 8)}
              onChange={playbook.onChange}
            />
          )}
        </div>

        {/* ---- Plan de match (V0.32) ---------------------------------------- */}
        <div className="dashboard-panel">
          <div className="panel-tag">Plan de match</div>

          <div className="prep-row">
            <div className="prep-label">Occupation du terrain</div>
            <div className="seg-btn">
              {(['HAUTE', 'MEDIANE', 'BASSE'] as const).map(o => (
                <button
                  key={o}
                  type="button"
                  className={o === occupation ? 'active' : ''}
                  onClick={() => setOccupation(o)}
                >
                  {OCCUPATION_LABEL[o]}
                </button>
              ))}
            </div>
            <div className="prep-hint">{OCCUPATION_HINT[occupation]}</div>
          </div>

          <div className="prep-row">
            <div className="prep-label">Ligne défensive</div>
            <div className="seg-btn">
              {(['MONTANTE', 'RIDEAU', 'STAND_OFF'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  className={d === defLine ? 'active' : ''}
                  onClick={() => setDefLine(d)}
                >
                  {DEFENSIVE_LINE_LABEL[d]}
                </button>
              ))}
            </div>
            <div className="prep-hint">{DEFENSIVE_LINE_HINT[defLine]}</div>
          </div>

          <div className="prep-row">
            <div className="prep-label">Travail des phases arrêtées</div>
            <div className="seg-btn multi">
              {(['MELEE', 'TOUCHE', 'MAUL'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  className={setPieces.includes(f) ? 'active' : ''}
                  onClick={() => toggleSetPiece(f)}
                >
                  {SET_PIECE_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="prep-hint">
              {setPieces.length === 0
                ? 'Aucune spécialisation — rien à gagner, rien à perdre en jeu courant.'
                : `${setPieces.length} axe${setPieces.length > 1 ? 's' : ''} travaillé${setPieces.length > 1 ? 's' : ''} : conquête renforcée, jeu courant affaibli d'autant.`}
            </div>
          </div>
        </div>

        <div className="dashboard-panel panel-wide">
          <div className="panel-tag">Composition</div>
          {/* V0.57 — quinze listes déroulantes sont devenues une feuille de
              match. Le XV se compose là où on le regarde. */}
          <LineupPitch
            starters={starters}
            substitutes={subs}
            byId={byId}
            selectable={availableForBench()}
            captainId={captainId}
            kickerId={kickerId}
            {...(currentRound !== undefined ? { currentRound } : {})}
            clubId={isHome ? homeClubId : awayClubId}
            onAssignStarter={setStarterAt}
            onAssignSub={setSubAt}
            renderSlotExtra={(slot: LineupSlot) => {
              // V0.34 — le poste dit où il joue, le rôle dit comment.
              const options = rolesForPosition(slot.position);
              const current = byId.get(slot.playerId);
              if (options.length === 0 || !current) return null;
              const chosen = roles[slot.playerId] ?? bestRoleFor({ ...current, position: slot.position });
              const def = chosen ? roleById(chosen) : undefined;
              return (
                <div className="lp-role-row">
                  <span className="lp-role-label">Rôle</span>
                  <select
                    className="lp-role"
                    value={chosen ?? ''}
                    onChange={e => setRoleFor(slot.playerId, e.target.value as RoleId)}
                  >
                    {options.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  {def && <span className="lp-role-hint">{def.description}</span>}
                </div>
              );
            }}
          />
          <div className="lineup-stat">
            Niveau moyen XV titulaire : <strong>{avgStarter}</strong>
          </div>
          <div className={`lineup-stat ${feuilleJiffStats.ratio < 0.5 ? 'jiff-warning' : ''}`}>
            JIFF feuille : <strong>{feuilleJiffStats.jiffCount}/{feuilleJiffStats.total}</strong>
            {feuilleJiffStats.ratio < 0.5 && ' ⚠ sous le seuil légal (50%)'}
          </div>
          {/* V0.51 — l'état du groupe, qui pèse désormais sur le terrain. On
              qualifie sans chiffrer : le manager doit le sentir, pas le lire. */}
          <div className={`lineup-stat ${xvMorale.mood < 48 || xvMorale.cohesion <= -25 ? 'jiff-warning' : ''}`}>
            Vestiaire : {moraleHint(xvMorale)}
          </div>
          {/* V0.52 — l'arbitre du jour, et ce qu'on sait de lui. */}
          {referee && (
            <div className="lineup-stat">
              Arbitre : <strong>{referee.name}</strong> — {referee.reputation}
            </div>
          )}
          {/* V0.58 — le public, qui pèse enfin sur la rencontre. */}
          {crowd && (
            <div className={`lineup-stat ${crowd.level === 'PEU' ? 'jiff-warning' : ''}`}>
              {CROWD_LABEL[crowd.level]} — {crowdHint(crowd.level, crowd.attendance, crowd.capacity)}
            </div>
          )}
          {/* V0.51 — la météo, annoncée avec ce qu'elle implique. */}
          {conditions && (
            <div className={`lineup-stat ${conditions.weather !== 'SEC' ? 'weather-warning' : ''}`}>
              {WEATHER_LABEL[conditions.weather]} — {weatherHint(conditions.weather, conditions.fieldCondition)}
            </div>
          )}
          {/* V0.52 — la consigne au sol : un vrai arbitrage, que l'arbitre du
              jour rend plus ou moins coûteux. Le staff recommande, on tranche. */}
          <div className="discipline-choice">
            <span className="dc-title">Consigne au sol</span>
            <div className="dc-options">
              {(['CONTEST_TOTAL', 'EQUILIBRE', 'PAS_DE_CONTEST'] as const).map(pol => (
                <button
                  key={pol}
                  type="button"
                  className={`dc-option ${discipline === pol ? 'active' : ''}`}
                  onClick={() => setDiscipline(pol)}
                  title={POLICY_HINT[pol]}
                >
                  {POLICY_LABEL[pol]}
                  {referee && recommendedPolicy(referee) === pol && (
                    <span className="dc-reco">conseillé</span>
                  )}
                </button>
              ))}
            </div>
            <span className="dc-hint">{POLICY_HINT[discipline]}</span>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Capitaine et buteur</div>
          <ul className="lineup-list">
            <li>
              <span className="lp-pos">Capitaine</span>
              {/* V0.50 — l'autorité s'affiche : le brassard se donne à un meneur
                  d'hommes, et rien dans la liste ne le disait. */}
              <select value={captainId} onChange={e => setCaptainId(e.target.value)}>
                {[...starters]
                  .sort((a, b) =>
                    (byId.get(b.playerId) ? captainAuthority(byId.get(b.playerId)!) : 0)
                    - (byId.get(a.playerId) ? captainAuthority(byId.get(a.playerId)!) : 0))
                  .map(s => {
                    const p = byId.get(s.playerId);
                    if (!p) return null;
                    return (
                      <option key={s.playerId} value={s.playerId}>
                        {p.firstName} {p.lastName} • {POSITION_LABEL[s.position]} • autorité {captainAuthority(p)}
                      </option>
                    );
                  })}
              </select>
            </li>
            <li>
              <span className="lp-pos">Buteur</span>
              <select value={kickerId} onChange={e => setKickerId(e.target.value)}>
                {starters.map(s => {
                  const p = byId.get(s.playerId);
                  if (!p) return null;
                  return (
                    <option key={s.playerId} value={s.playerId}>
                      {p.firstName} {p.lastName} • pied placé {p.technical.jeuAuPiedPlace}
                    </option>
                  );
                })}
              </select>
            </li>
          </ul>
          <div className="lineup-stat">
            Le capitaine porte le brassard ; le buteur tente les pénalités et transformations.
          </div>
        </div>

      </div>

      <div className="pre-match-actions">
        <button onClick={onBack} type="button">Annuler</button>
        <button className="primary" onClick={goPlay} type="button">
          Lancer le match →
        </button>
      </div>
    </section>
  );
}


/**
 * L'éditeur de carnet : V0.65.
 *
 * Trois décisions par combinaison, et une quatrième facultative, le sauteur.
 * L'écran affiche en permanence la **part d'usage** de chaque ligne, parce que
 * c'est la seule information qui rende le mécanisme de lecture jouable : sans
 * elle, le manager se ferait contrer sans jamais comprendre qu'il se répète.
 */
function PlaybookEditor({ playbook, usage, forwards, onChange }: PlaybookEditorProps) {
  const total = Object.values(usage).reduce((sum, n) => sum + n, 0);
  const verdict = validatePlaybook(playbook);

  const patch = (id: string, change: Partial<LineoutCall>): void => {
    onChange({
      ...playbook,
      calls: playbook.calls.map(c => (c.id === id ? { ...c, ...change } : c)),
    });
  };

  /** Désigner un sauteur, ou revenir au « mieux placé » en retirant le champ. */
  const setJumper = (call: LineoutCall, playerId: string): void => {
    const { jumperId: _ancien, ...sansSauteur } = call;
    const suivant: LineoutCall = playerId === ''
      ? sansSauteur
      : { ...sansSauteur, jumperId: playerId as PlayerId };
    onChange({
      ...playbook,
      calls: playbook.calls.map(c => (c.id === call.id ? suivant : c)),
    });
  };

  const ajouter = (): void => {
    if (playbook.calls.length >= MAX_CALLS) return;
    const id = `c${Date.now().toString(36)}`;
    onChange({
      ...playbook,
      calls: [...playbook.calls, {
        id, name: `Combinaison ${playbook.calls.length + 1}`,
        alignment: 'CINQ', jumper: 'MILIEU', option: 'OUVREUR',
      }],
    });
  };

  const retirer = (id: string): void => {
    if (playbook.calls.length <= MIN_CALLS) return;
    const { defaultCallId, ...reste } = playbook;
    const calls = playbook.calls.filter(c => c.id !== id);
    // Retirer la combinaison par défaut laisse le carnet sans défaut plutôt que
    // d'en désigner une au hasard : le moteur retombera sur la première, et le
    // manager verra qu'aucune n'est cochée.
    onChange(defaultCallId === id ? { ...reste, calls } : { ...playbook, calls });
  };

  return (
    <div className="prep-row playbook">
      <div className="prep-label">Carnet de touche</div>
      <div className="prep-hint">
        Chaque combinaison a son domaine. Celle que vous jouez plus d'une fois sur
        trois finit par être lue, et contrée.
      </div>

      <ul className="playbook-list">
        {playbook.calls.map(call => {
          const share = total > 0 ? (usage[call.id] ?? 0) / total : 0;
          const lue = total >= READ_MIN_SAMPLE && share > 0.34;
          return (
            <li key={call.id} className={`playbook-call ${lue ? 'over-used' : ''}`}>
              <div className="pc-head">
                <input
                  className="pc-name"
                  value={call.name}
                  aria-label="Nom de la combinaison"
                  onChange={e => patch(call.id, { name: e.target.value })}
                />
                <span className={`pc-share ${lue ? 'over' : ''}`}>
                  {total === 0 ? 'jamais jouée' : `${Math.round(share * 100)} % des touches`}
                </span>
                <button
                  type="button"
                  className={`pc-default ${playbook.defaultCallId === call.id ? 'active' : ''}`}
                  onClick={() => onChange({ ...playbook, defaultCallId: call.id })}
                  title="Combinaison appelée par défaut au milieu du terrain"
                >
                  par défaut
                </button>
                <button
                  type="button"
                  className="pc-remove"
                  disabled={playbook.calls.length <= MIN_CALLS}
                  onClick={() => retirer(call.id)}
                  aria-label={`Retirer ${call.name}`}
                >
                  ×
                </button>
              </div>

              <div className="pc-choices">
                <Choix
                  label="Alignement"
                  options={[['SEPT', 'Sept'], ['CINQ', 'Cinq'], ['REDUITE', 'Réduite']]}
                  value={call.alignment}
                  onPick={v => patch(call.id, { alignment: v as LineoutCall['alignment'] })}
                />
                <Choix
                  label="Sauteur"
                  options={[['DEVANT', 'Devant'], ['MILIEU', 'Milieu'], ['FOND', 'Fond']]}
                  value={call.jumper}
                  onPick={v => patch(call.id, { jumper: v as LineoutCall['jumper'] })}
                />
                <Choix
                  label="Option"
                  options={[['MAUL', 'Maul'], ['OUVREUR', 'Ouvreur'], ['PEEL', 'Peel']]}
                  value={call.option}
                  onPick={v => patch(call.id, { option: v as LineoutCall['option'] })}
                />
              </div>

              <label className="pc-jumper">
                <span>Sauteur désigné</span>
                <select
                  value={(call.jumperId as string | undefined) ?? ''}
                  onChange={e => setJumper(call, e.target.value)}
                >
                  <option value="">le mieux placé</option>
                  {forwards.map(p => (
                    <option key={p.id as string} value={p.id as string}>{p.lastName}</option>
                  ))}
                </select>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="playbook-actions">
        <button
          type="button"
          className="secondary"
          disabled={playbook.calls.length >= MAX_CALLS}
          onClick={ajouter}
        >
          Ajouter une combinaison
        </button>
        {!verdict.ok && <span className="playbook-warning">{verdict.reason}</span>}
      </div>
    </div>
  );
}

function Choix({
  label, options, value, onPick,
}: {
  readonly label: string;
  readonly options: readonly (readonly [string, string])[];
  readonly value: string;
  readonly onPick: (value: string) => void;
}) {
  return (
    <div className="pc-choice">
      <span className="pc-choice-label">{label}</span>
      <div className="seg-btn">
        {options.map(([key, texte]) => (
          <button
            key={key}
            type="button"
            className={key === value ? 'active' : ''}
            aria-pressed={key === value}
            onClick={() => onPick(key)}
          >
            {texte}
          </button>
        ))}
      </div>
    </div>
  );
}
