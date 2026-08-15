/**
 * Fiche joueur — V0.4 phase 1.
 *
 * Référence : 10-ui-ux.md, section 3 (Fiche joueur).
 *
 * Contient : header (nom, poste, âge, contrat), attributs 3 catégories +
 * sub-stats poste, traits (chips), mood + top 3 modificateurs, état dynamique.
 *
 * V0.4 phase 2 : ajoutera relations clés.
 */

import { useState } from 'react';
import type { ClubId, Player, PlayerId } from '../../engine/types.js';
import type { SquadStatus } from '../../engine/club/squad-status.js';
import {
  TOPIC_DESCRIPTION,
  TOPIC_LABEL,
  topicHint,
  type PlayerPromise,
  type PlayerTalkOutcome,
  type TalkContext,
  type TalkTopic,
} from '../../engine/human/player-talk.js';
import { AttributeBar } from '../components/AttributeBar.js';
import {
  CERTAINTY_LABEL,
  certaintyFor,
  currentAbility,
  estimateAttribute,
  estimatePotential,
  upsideLabel,
} from '../../engine/club/scouting.js';
import { TraitChip } from '../components/TraitChip.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { StadiumBackdrop } from '../components/StadiumBackdrop.js';
import { PositionBadge, positionLabel } from '../components/DataBits.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import { computeMood } from '../../engine/human/mood.js';
import {
  computeRelationsForMood,
  topRelationsForPlayer,
  type RelationsState,
  type RelationType,
} from '../../engine/human/relationships.js';
import { fitLabel, roleFitness } from '../../engine/match/roles.js';
import { careerTotals, type PlayerCareer } from '../../engine/season/player-career.js';

interface Props {
  readonly player: Player;
  readonly currentSeason: number;
  readonly recentResults: readonly (-1 | 0 | 1)[];
  readonly playRatio: number;
  readonly relations: RelationsState;
  readonly playersById: ReadonlyMap<PlayerId, Player>;
  /** V0.15 — connaissance du club sur ce joueur (0-100). */
  readonly familiarity: number;
  /** V0.22 — bilan de la saison en cours pour ce joueur. */
  readonly seasonStat?: { readonly tries: number; readonly matches: number; readonly minutes: number };
  readonly onBack: () => void;
  readonly onSelectPlayer?: (player: Player) => void;
  /**
   * V0.48 — parler au joueur.
   *
   * La fiche ne contenait que des boutons de navigation : tout le système
   * humain arrivait au manager sous forme de modales, sans qu'il puisse jamais
   * aller voir quelqu'un.
   */
  /** V0.50 — porte-t-il le brassard ? Le capitanat compte dans son moral. */
  readonly isCaptain?: boolean;
  /** V0.50 — rôle annoncé : c'est l'écart avec le temps de jeu qui pèse. */
  readonly squadStatus?: SquadStatus;
  /**
   * V0.53 — ce qu'il a gagné au fil des saisons.
   *
   * C'est la récompense du jeu long : voir « Meilleur espoir 2027 » sur la
   * fiche d'un joueur sorti du centre donne un sens à quatre ans de patience.
   */
  readonly honours?: readonly { readonly season: number; readonly label: string }[];
  /** V0.54 — journée courante, pour écarter les événements de moral périmés. */
  readonly currentRound?: number;
  /** V0.55 — où en est une recrue de son acclimatation, s'il y a lieu. */
  readonly adaptation?: string;
  /**
   * V0.58 — capes internationales.
   *
   * L'un des deux horizons d'une carrière française, et la seule chose qu'un
   * club puisse offrir qu'un autre ne peut pas acheter : la fiche le dit.
   */
  readonly caps?: number;
  /**
   * V0.63 : ce qu'il a produit **en sélection** cette saison.
   *
   * Depuis que les tests internationaux sont joués par le moteur, une sélection
   * n'est plus une ligne d'absence. La fiche disait « 12 sélections » et rien
   * d'autre ; elle peut désormais dire ce qu'il y a fait.
   */
  readonly internationalStat?: {
    readonly matches: number;
    readonly minutes: number;
    readonly tries: number;
    readonly tackles: number;
    readonly meters: number;
  };
  /**
   * V0.59 — sa carrière, saison par saison.
   *
   * La fiche ne montrait que la saison en cours : huit ans de formation, de
   * prêts et de progression ne laissaient aucune trace lisible.
   */
  readonly career?: PlayerCareer;
  readonly clubNameOf?: (clubId: ClubId) => string;
  readonly talk?: {
    readonly context: TalkContext;
    readonly pendingPromise?: PlayerPromise;
    /** V0.49 — demande de départ ouverte, suite à une promesse trahie. */
    readonly request?: { readonly status: 'EN_ATTENTE' | 'SUR_LA_LISTE' };
    readonly lastOutcome?: PlayerTalkOutcome;
    readonly onTalk: (topic: TalkTopic) => void;
  };
  /**
   * V0.64 — les discussions de contrat.
   *
   * Elles vivent ici, sous le contrat qu'elles modifient. Les mettre dans
   * l'écran des transferts aurait séparé la demande du joueur de la seule
   * information qui permette d'y répondre : ce qu'il touche aujourd'hui.
   */
  readonly contract?: {
    readonly agentName: string;
    readonly request?: {
      readonly annualSalary: number;
      readonly extraYears: number;
      readonly reason: string;
    };
    readonly terminationCost: number;
    readonly onRenegotiate: (annualSalary: number, extraYears: number) => string;
    readonly onTerminate: (offered: number) => string;
  };
}

/**
 * V0.56 — la fiche affichait le type brut du graphe, en majuscules.
 *
 * Lisible pour qui a écrit le moteur, opaque pour le joueur : « RIVAL » ne dit
 * pas s'il s'agit d'une saine émulation ou d'une brouille. Et depuis que la
 * concurrence au poste produit vraiment des rivalités, c'est une ligne qu'on lit
 * souvent.
 */
const RELATION_LABEL: Readonly<Record<RelationType, string>> = {
  AMI: 'Proches',
  NEUTRE: 'Cordial',
  MENTOR: 'Le prend sous son aile',
  RIVAL: 'Rivalité',
  CONFLIT: 'Conflit ouvert',
};

function age(birthDate: string, currentSeason: number): number {
  const birthYear = parseInt(birthDate.slice(0, 4), 10);
  return currentSeason - birthYear;
}

function moodColor(mood: number): string {
  if (mood >= 70) return 'mood-good';
  if (mood >= 50) return 'mood-ok';
  if (mood >= 30) return 'mood-low';
  return 'mood-bad';
}

function formatEurosShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}

const INJURY_LABEL: Record<string, string> = {
  MUSCULAIRE: 'lésion musculaire',
  LIGAMENTAIRE: 'lésion ligamentaire',
  COMMOTION: 'commotion',
  FRACTURE: 'fracture',
  COUP: 'coup',
  CHRONIQUE: 'douleur chronique',
};

const TALK_TOPICS: readonly TalkTopic[] = [
  'FELICITER', 'RECADRER', 'RASSURER_ROLE', 'PROMETTRE_TEMPS_DE_JEU', 'DEMANDER_EFFORT',
];

export function PlayerScreen({ player, currentSeason, recentResults, playRatio, relations, playersById, onBack, onSelectPlayer , familiarity, seasonStat, isCaptain, squadStatus, honours, currentRound, adaptation, caps, internationalStat, career, clubNameOf, talk, contract }: Props) {
  // V0.15 — le joueur n'est pas forcément bien connu : chaque attribut est
  // présenté via l'estimation du scout plutôt qu'en valeur brute.
  const est = (key: string, value: number) =>
    estimateAttribute(value, familiarity, `${player.id}_${key}`);
  const potential = estimatePotential(player, familiarity, currentSeason);
  const certainty = certaintyFor(familiarity);

  const relationsFactors = computeRelationsForMood(relations, player.id);
  const { mood, modifiers } = computeMood({
    player,
    recentResults,
    playRatio,
    currentSeason,
    ...(currentRound !== undefined ? { currentRound } : {}),
    relationsFactors,
    isCaptain: isCaptain === true,
    ...(squadStatus !== undefined ? { squadStatus } : {}),
  });
  const topRelations = topRelationsForPlayer(relations, player.id, 6);

  // Top 3 modificateurs (par valeur absolue)
  const topMods = [...modifiers].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);

  // V0.35 — affinité avec chacun des rôles de son poste, du plus naturel au moins.
  const roleFits = roleFitness(player);

  const subStats: { label: string; value: number }[] = [];
  const ps = player.positionSpecific;
  if (ps.pousseeMelee !== undefined) subStats.push({ label: 'Poussée mêlée', value: ps.pousseeMelee });
  if (ps.qualiteLancer !== undefined) subStats.push({ label: 'Qualité lancer', value: ps.qualiteLancer });
  if (ps.sautEnTouche !== undefined) subStats.push({ label: 'Saut en touche', value: ps.sautEnTouche });
  if (ps.liftEnTouche !== undefined) subStats.push({ label: 'Lift en touche', value: ps.liftEnTouche });
  if (ps.grattage !== undefined) subStats.push({ label: 'Grattage', value: ps.grattage });
  if (ps.passeRapide !== undefined) subStats.push({ label: 'Passe rapide', value: ps.passeRapide });
  if (ps.finition !== undefined) subStats.push({ label: 'Finition', value: ps.finition });
  if (ps.jeuAerien !== undefined) subStats.push({ label: 'Jeu aérien', value: ps.jeuAerien });

  return (
    <section className="player-screen">
      {/* V0.22 — en-tête de fiche : la page démarrait sur un simple titre, sans
          blason, sans poste lisible et sans état de disponibilité. */}
      <div className="player-hero">
        <StadiumBackdrop
          className="player-hero-bg"
          seed={player.clubId as string}
          accent={readableAccent(clubIdentity(player.clubId as string).primary)}
          intensity={0.42}
        />

        <div className="ph-left">
          <ClubCrest clubId={player.clubId as string} initials={player.lastName.slice(0, 3)} size={58} />
          <div className="ph-identity">
            <div className="ph-position">
              <PositionBadge position={player.position} />
              <span className="ph-position-label">{positionLabel(player.position)}</span>
            </div>
            <h2 className="ph-name">{player.firstName} <strong>{player.lastName}</strong></h2>
            <div className="ph-meta">
              <span>{age(player.birthDate, currentSeason)} ans</span>
              <span className="ph-dot" />
              <span>Contrat jusqu'en {player.contract.endSeason}</span>
              <span className="ph-dot" />
              <span>{Math.round(player.contract.annualSalary / 1000)} k€/an</span>
              {player.isJiff && <span className="sq-tag jiff">JIFF</span>}
              {player.dynamic.injury && (
                <span className="sq-tag out">Blessé — {player.dynamic.injury.type.toLowerCase()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Bilan de la saison en cours : l'information que le manager cherche en
            ouvrant une fiche. Elle n'apparaissait nulle part. */}
        <div className="ph-stats">
          <div className="ph-stat">
            <span className="ph-stat-value">{seasonStat?.matches ?? 0}</span>
            <span className="ph-stat-label">matchs</span>
          </div>
          <div className="ph-stat">
            <span className="ph-stat-value">{seasonStat?.minutes ?? 0}</span>
            <span className="ph-stat-label">minutes</span>
          </div>
          <div className="ph-stat">
            <span className="ph-stat-value">{seasonStat?.tries ?? 0}</span>
            <span className="ph-stat-label">essais</span>
          </div>
          <div className="ph-stat">
            <span className="ph-stat-value">{Math.round(100 - player.dynamic.fatigue)}</span>
            <span className="ph-stat-label">condition</span>
          </div>
          <div className="ph-stat">
            <span className="ph-stat-value">{player.dynamic.forme}</span>
            <span className="ph-stat-label">forme</span>
          </div>
        </div>

        <button onClick={onBack} type="button" className="ph-back">← Retour</button>
      </div>

      {talk && (
        <div className="dashboard-panel talk-panel">
          <div className="panel-tag">Lui parler</div>

          {/* V0.55 — une recrue n'est pas encore tout à fait elle-même. */}
          {adaptation && (
            <div className="talk-request" style={{ color: 'var(--text-dim)' }}>
              {adaptation}
            </div>
          )}

          {/* V0.58 — sa carrière internationale. On la mentionne dès la
              première cape : c'est précisément celle qui compte. */}
          {caps !== undefined && caps > 0 && (
            <div className="talk-request" style={{ color: 'var(--accent)' }}>
              🇫🇷 {caps} sélection{caps > 1 ? 's' : ''} en équipe de France
              {caps >= 10 ? ' — international confirmé' : ''}
            </div>
          )}

          {/* V0.63 : et ce qu'il y a fait cette saison. */}
          {internationalStat && internationalStat.matches > 0 && (
            <div className="talk-request" style={{ color: 'var(--text-dim)' }}>
              Cette saison en bleu : {internationalStat.matches} match
              {internationalStat.matches > 1 ? 's' : ''}, {internationalStat.minutes} minutes,
              {' '}{internationalStat.tries} essai{internationalStat.tries > 1 ? 's' : ''},
              {' '}{internationalStat.tackles} plaquages.
            </div>
          )}

          {/* V0.53 — son palmarès personnel, s'il en a un. */}
          {honours && honours.length > 0 && (
            <div className="player-honours">
              {honours.map((h, i) => (
                <span key={`${h.season}_${i}`} className="honour-badge">
                  {h.label} {h.season}-{String((h.season + 1) % 100).padStart(2, '0')}
                </span>
              ))}
            </div>
          )}

          {/* V0.49 — une parole trahie se lit sur la fiche, pas seulement dans
              la boîte : c'est ici qu'on vient voir ce qu'on lui a fait. */}
          {talk.request && (
            <div className="talk-request">
              {talk.request.status === 'EN_ATTENTE'
                ? 'Il a demandé à partir. Son agent attend votre réponse.'
                : 'Il est sur la liste des transferts.'}
            </div>
          )}

          {/* Un engagement en cours doit se voir avant d'en prendre un autre. */}
          {talk.pendingPromise && (
            <div className="talk-promise">
              Vous lui avez promis du temps de jeu — échéance journée{' '}
              {talk.pendingPromise.dueAtRound}.
            </div>
          )}

          <ul className="talk-topics">
            {TALK_TOPICS.map(topic => (
              <li key={topic}>
                <button
                  type="button"
                  className="talk-topic"
                  onClick={() => talk.onTalk(topic)}
                >
                  <span className="tt-label">{TOPIC_LABEL[topic]}</span>
                  <span className="tt-desc">{TOPIC_DESCRIPTION[topic]}</span>
                  {/* On qualifie sans chiffrer : parler est un pari sur quelqu'un. */}
                  <span className="tt-hint">{topicHint(topic, talk.context)}</span>
                </button>
              </li>
            ))}
          </ul>

          {talk.lastOutcome && (
            <div className={`talk-outcome ${talk.lastOutcome.backfired ? 'ko' : 'ok'}`}>
              <p className="to-narrative">{talk.lastOutcome.narrative}</p>
              <span className="to-effect">
                Moral {talk.lastOutcome.moodDelta >= 0 ? '+' : ''}{talk.lastOutcome.moodDelta}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="player-grid">
        {/* V0.15 — rapport du scout : c'est ici que se joue le pari du recrutement. */}
        <div className="scouting-panel">
          <div className="scouting-head">
            <div className="panel-tag">Rapport de scouting</div>
            <span className={`certainty-pill c-${certainty.toLowerCase()}`}>
              {CERTAINTY_LABEL[certainty]}
            </span>
          </div>

          <div className="scouting-body">
            <div className="scouting-metric">
              <span className="scouting-metric-label">Niveau actuel</span>
              <span className="scouting-metric-value">
                {certainty === 'INCONNU' ? '?' : Math.round(currentAbility(player))}
              </span>
            </div>
            <div className="scouting-metric">
              <span className="scouting-metric-label">Potentiel estimé</span>
              <span className="scouting-metric-value accent">{potential.display}</span>
            </div>
            <div className="scouting-metric wide">
              <span className="scouting-metric-label">Marge de progression</span>
              <span className="scouting-metric-value small">{upsideLabel(player, familiarity, currentSeason)}</span>
            </div>
          </div>

          <div className="familiarity-wrap">
            <div className="familiarity-bar" style={{ width: `${familiarity}%` }} />
          </div>
          <p className="scouting-note">
            {certainty === 'CERTAIN'
              ? 'Joueur suivi de près : les évaluations sont fiables.'
              : certainty === 'INCONNU'
                ? 'Aucune observation. Envoie ton scout pour obtenir une évaluation.'
                : 'Les fourchettes se resserreront à mesure que le joueur sera observé.'}
          </p>
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Attributs techniques</div>
          <AttributeBar label="Passe" value={player.technical.passe} estimate={est('passe', player.technical.passe)} />
          <AttributeBar label="Plaquage" value={player.technical.plaquage} estimate={est('plaquage', player.technical.plaquage)} />
          <AttributeBar label="Jeu au pied (placé)" value={player.technical.jeuAuPiedPlace} estimate={est('jeuAuPiedPlace', player.technical.jeuAuPiedPlace)} />
          <AttributeBar label="Jeu au pied (dyn.)" value={player.technical.jeuAuPiedDynamique} estimate={est('jeuAuPiedDynamique', player.technical.jeuAuPiedDynamique)} />
          <AttributeBar label="Vision de jeu" value={player.technical.visionDeJeu} estimate={est('visionDeJeu', player.technical.visionDeJeu)} />
          <AttributeBar label="Conservation" value={player.technical.conservation} estimate={est('conservation', player.technical.conservation)} />
          <AttributeBar label="Prise de balle haute" value={player.technical.prisedeballeHaute} estimate={est('prisedeballeHaute', player.technical.prisedeballeHaute)} />
          <AttributeBar label="Déblayage" value={player.technical.deblayage} estimate={est('deblayage', player.technical.deblayage)} />
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Attributs physiques</div>
          <AttributeBar label="Vitesse" value={player.physical.vitesse} estimate={est('vitesse', player.physical.vitesse)} />
          <AttributeBar label="Puissance" value={player.physical.puissance} estimate={est('puissance', player.physical.puissance)} />
          <AttributeBar label="Endurance" value={player.physical.endurance} estimate={est('endurance', player.physical.endurance)} />
          <AttributeBar label="Détente" value={player.physical.detente} estimate={est('detente', player.physical.detente)} />
          <AttributeBar label="Robustesse" value={player.physical.robustesse} estimate={est('robustesse', player.physical.robustesse)} />
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Attributs mentaux</div>
          <AttributeBar label="Décision" value={player.mental.decision} estimate={est('decision', player.mental.decision)} />
          <AttributeBar label="Leadership" value={player.mental.leadership} estimate={est('leadership', player.mental.leadership)} />
          <AttributeBar label="Sang-froid" value={player.mental.sangFroid} estimate={est('sangFroid', player.mental.sangFroid)} />
          <AttributeBar label="Agressivité" value={player.mental.agressivite} estimate={est('agressivite', player.mental.agressivite)} />
          <AttributeBar label="Professionnalisme" value={player.mental.professionnalisme} estimate={est('professionnalisme', player.mental.professionnalisme)} />
          <AttributeBar label="Discipline" value={player.mental.discipline} estimate={est('discipline', player.mental.discipline)} />
        </div>

        {subStats.length > 0 && (
          <div className="dashboard-panel">
            <div className="panel-tag">Sub-stats poste</div>
            {subStats.map(s => (
              <AttributeBar key={s.label} label={s.label} value={s.value} estimate={est(s.label, s.value)} />
            ))}
          </div>
        )}

        {/* ---- Rôles (V0.35) ------------------------------------------------
            Le poste dit où il joue, le rôle dit comment. On montre les deux ou
            trois rôles de son poste classés par affinité : c'est ce qui rend
            lisible le choix qu'on fera en composition, et ce qui distingue deux
            joueurs de même niveau au même poste. */}
        {roleFits.length > 0 && (
          <div className="dashboard-panel">
            <div className="panel-tag">Rôles</div>
            <ul className="role-fit-list">
              {roleFits.map(({ role, score }, i) => {
                const fit = fitLabel(score);
                return (
                  <li key={role.id} className={`role-fit ${fit.tone} ${i === 0 ? 'primary' : ''}`}>
                    <div className="rf-head">
                      <span className="rf-label">{role.label}</span>
                      <span className="rf-verdict">{fit.label}</span>
                    </div>
                    <p className="rf-desc">{role.description}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="dashboard-panel">
          <div className="panel-tag">Personnalité ({player.traits.length} traits)</div>
          <div className="trait-chips">
            {player.traits.map(t => <TraitChip key={t as string} traitId={t as string} />)}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Mood</div>
          <div className="mood-section">
            <div className="mood-bar-wrap">
              <div className={`mood-bar ${moodColor(mood)}`} style={{ width: `${mood}%` }} />
            </div>
            <span className="mood-value">{mood}/100</span>
          </div>
          <div className="mood-mods">
            <div className="mood-mods-tag">Pourquoi ?</div>
            {topMods.map(m => (
              <div key={m.source} className={`mood-mod ${m.delta > 0 ? 'positive' : m.delta < 0 ? 'negative' : ''}`}>
                <span className="mm-reason">{m.reason}</span>
                <span className="mm-delta">{m.delta > 0 ? '+' : ''}{m.delta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">État dynamique</div>
          <AttributeBar label="Forme" value={player.dynamic.forme} />
          <AttributeBar label="Fatigue (inverse)" value={100 - player.dynamic.fatigue} />
          {player.dynamic.injury && (
            <div className="injury-box">
              <div style={{ fontWeight: 600, color: 'var(--red, #c44)' }}>
                ⚠ Blessé — {INJURY_LABEL[player.dynamic.injury.type]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Retour estimé : J{player.dynamic.injury.estimatedReturnAt}
                {player.dynamic.injury.hasSequela && ' • risque de séquelle'}
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="panel-tag">Contrat</div>
          <ul className="finances-lines">
            <li><span>Période</span>
              <strong>{player.contract.startSeason}–{player.contract.endSeason}</strong>
            </li>
            <li><span>Salaire annuel</span>
              <strong>{formatEurosShort(player.contract.annualSalary)}</strong>
            </li>
            <li><span>Saisons restantes</span>
              <strong>{Math.max(0, player.contract.endSeason - currentSeason)}</strong>
            </li>
            {player.freeAgent && (
              <li className="separator">
                <span style={{ color: 'var(--red, #c44)' }}>Joueur libre — sans club</span>
              </li>
            )}
            {!player.freeAgent && player.contract.endSeason === currentSeason && (
              <li className="separator">
                <span style={{ color: 'var(--accent, var(--green))' }}>Dernière année — décision attendue</span>
              </li>
            )}
            {/* V0.64 — les clauses signées. Un contrat qui les porte sans les
                montrer laisserait le manager découvrir sa clause libératoire le
                jour où un club l'active. */}
            {player.contract.releaseClause !== undefined && (
              <li><span>Clause libératoire</span>
                <strong>{formatEurosShort(player.contract.releaseClause)}</strong>
              </li>
            )}
            {player.contract.bonuses?.perMatch !== undefined && (
              <li><span>Prime par match</span>
                <strong>{formatEurosShort(player.contract.bonuses.perMatch)}</strong>
              </li>
            )}
            {player.contract.salaryProgression !== undefined && (
              <li><span>Salaire progressif</span>
                <strong>+{Math.round(player.contract.salaryProgression * 100)} %/an</strong>
              </li>
            )}
            {player.contract.sellOn !== undefined && (
              <li><span>Dû à son ancien club</span>
                <strong>{Math.round(player.contract.sellOn.percent * 100)} % de sa revente</strong>
              </li>
            )}
          </ul>

          {contract && !player.freeAgent && (
            <ContractTalks contract={contract} currentSalary={player.contract.annualSalary} />
          )}
        </div>

        {/* V0.59 — le registre de carrière. On ne l'affiche qu'à partir d'une
            saison consignée : un joueur qui débute n'a pas de tableau vide à
            contempler. */}
        {career && career.lines.length > 0 && (() => {
          const t = careerTotals(career);
          return (
            <div className="dashboard-panel career-panel">
              <div className="panel-tag">Carrière ({t.seasons} saison{t.seasons > 1 ? 's' : ''})</div>
              <table className="career-table">
                <thead>
                  <tr>
                    <th>Saison</th><th>Club</th>
                    <th className="num">M</th><th className="num">Min</th>
                    <th className="num">E</th><th className="num">Sél.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...career.lines].reverse().map(l => (
                    <tr key={`${l.season}_${l.clubId as string}`}>
                      <td>
                        {l.season}-{String((l.season + 1) % 100).padStart(2, '0')}
                        {l.onLoan && <span className="career-loan" title="Saison en prêt">prêt</span>}
                      </td>
                      <td>{clubNameOf?.(l.clubId) ?? (l.clubId as string)}</td>
                      <td className="num">{l.matches}</td>
                      <td className="num">{l.minutes}</td>
                      <td className="num">{l.tries}</td>
                      <td className="num">{l.caps > 0 ? l.caps : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="num">{t.matches}</td>
                    <td className="num">{t.minutes}</td>
                    <td className="num">{t.tries}</td>
                    <td className="num">{t.caps > 0 ? t.caps : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}

        {topRelations.length > 0 && (
          <div className="dashboard-panel">
            <div className="panel-tag">Relations clés ({topRelations.length})</div>
            <ul className="relations-list">
              {topRelations.map(r => {
                const otherId = r.fromId === player.id ? r.toId : r.fromId;
                const other = playersById.get(otherId);
                if (!other) return null;
                const cls = r.score >= 50 ? 'rel-pos' : r.score >= -20 ? 'rel-neutral' : r.score >= -50 ? 'rel-rival' : 'rel-conflict';
                return (
                  <li key={otherId as string} className={cls}>
                    <button
                      type="button"
                      className="rel-link"
                      onClick={() => onSelectPlayer?.(other)}
                      disabled={!onSelectPlayer}
                    >
                      {other.firstName} {other.lastName}
                    </button>
                    <span className="rel-type" title={r.lastReason ?? ''}>{RELATION_LABEL[r.type]}</span>
                    <span className="rel-score">{r.score > 0 ? '+' : ''}{r.score}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * V0.64 — la table de discussion du contrat.
 *
 * Deux boutons et un chiffre : ce qu'il réclame, et ce qu'il coûterait de le
 * laisser partir. On affiche la contre-proposition à 90 % parce que c'est là que
 * se joue la négociation : un loyal l'accepte, un ambitieux la prend pour un
 * refus, et le manager apprend à qui il a affaire.
 */
function ContractTalks({
  contract, currentSalary,
}: {
  readonly contract: NonNullable<Props['contract']>;
  readonly currentSalary: number;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [confirmingExit, setConfirmingExit] = useState(false);

  return (
    <div className="contract-talks">
      <div className="ct-agent">Agent : {contract.agentName}</div>

      {contract.request ? (
        <>
          <p className="ct-demand">
            {contract.request.reason} Il demande{' '}
            <strong>{formatEurosShort(contract.request.annualSalary)}/an</strong>
            {contract.request.extraYears > 0
              && ` et ${contract.request.extraYears} saison de plus`}
            {' '}(il touche {formatEurosShort(currentSalary)}).
          </p>
          <div className="ct-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setNote(contract.onRenegotiate(
                contract.request!.annualSalary, contract.request!.extraYears,
              ))}
            >
              Accepter sa demande
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setNote(contract.onRenegotiate(
                Math.round(contract.request!.annualSalary * 0.9), contract.request!.extraYears,
              ))}
            >
              Proposer 90 %
            </button>
          </div>
        </>
      ) : (
        <p className="ct-demand ct-quiet">Il ne réclame rien pour l'instant.</p>
      )}

      {contract.terminationCost > 0 && (
        <div className="ct-actions">
          {confirmingExit ? (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setNote(contract.onTerminate(contract.terminationCost));
                  setConfirmingExit(false);
                }}
              >
                Confirmer : {formatEurosShort(contract.terminationCost)}
              </button>
              <button type="button" className="modal-skip" onClick={() => setConfirmingExit(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button type="button" className="modal-skip" onClick={() => setConfirmingExit(true)}>
              Résilier à l'amiable ({formatEurosShort(contract.terminationCost)})
            </button>
          )}
        </div>
      )}

      {note !== null && <p className="ct-note">{note}</p>}
    </div>
  );
}
