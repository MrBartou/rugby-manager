/**
 * Dossier d'avant-match — V0.36.
 *
 * Ce que le staff a réuni sur l'adversaire : sa forme, la manière dont il joue,
 * ses lignes fortes et faibles, ses hommes dangereux et ses absents. Le tout
 * filtré par la connaissance qu'on en a — un adversaire jamais observé ne
 * livre rien, et c'est ce qui donne au scouting une utilité hebdomadaire.
 */

import type { OpponentReport } from '../../engine/club/opponent-report.js';
import { reportHint } from '../../engine/club/opponent-report.js';
import { CERTAINTY_LABEL } from '../../engine/club/scouting.js';
import {
  DEFENSIVE_LINE_LABEL,
  OCCUPATION_LABEL,
  SET_PIECE_LABEL,
} from '../../engine/match/tactics.js';
import { FormGuide, PositionBadge } from './DataBits.js';

interface Props {
  readonly report: OpponentReport;
  /**
   * V0.43 — mission d'observation sur ce club. Absent quand l'appelant ne gère
   * pas le scouting (dossier consulté hors préparation de match).
   */
  readonly scouting?: {
    readonly assigned: boolean;
    /** Faux quand les créneaux du scout sont déjà pris. */
    readonly canAssign: boolean;
    readonly slotCost: number;
    readonly onToggle: () => void;
  };
}

export function OpponentDossier({ report, scouting }: Props) {
  const focus = report.expectedPlan.setPiecesFocus.filter(f => f !== 'NONE');

  return (
    <div className="dashboard-panel dossier">
      <div className="dossier-head">
        <div className="panel-tag">Dossier — {report.club.name}</div>
        <span className={`dossier-certainty ${report.certainty.toLowerCase()}`}>
          {CERTAINTY_LABEL[report.certainty]}
        </span>
      </div>

      {/* Jusqu'ici le brouillard ne se levait qu'en affrontant l'équipe : on ne
          pouvait rien préparer avant de l'avoir déjà jouée. */}
      {scouting && (
        <div className="dossier-scout">
          <button
            type="button"
            className={`dossier-scout-btn ${scouting.assigned ? 'active' : ''}`}
            disabled={!scouting.assigned && !scouting.canAssign}
            onClick={scouting.onToggle}
          >
            {scouting.assigned ? 'Rappeler le scout' : 'Envoyer un scout sur ce club'}
          </button>
          <span className="dossier-scout-hint">
            {scouting.assigned
              ? 'Sous observation — le dossier s\'affinera à chaque journée.'
              : scouting.canAssign
                ? `Mobilise ${scouting.slotCost} créneaux d'observation.`
                : 'Créneaux d\'observation déjà tous pris.'}
          </span>
        </div>
      )}

      <div className="dossier-top">
        <div className="dos-item">
          <span className="dos-label">Forme</span>
          <FormGuide results={report.form} />
        </div>
        <div className="dos-item">
          <span className="dos-label">Classement</span>
          <span className="dos-value">{report.rank ? `${report.rank}ᵉ` : '—'}</span>
        </div>
      </div>

      {/* Le plan adverse se déduit de l'identité du club : c'est une lecture
          publique, elle ne dépend donc pas du scouting. */}
      <div className="dos-plan">
        <span className="dos-label">Manière de jouer</span>
        <span className="dos-plan-line">
          {OCCUPATION_LABEL[report.expectedPlan.occupation]}
          {' · '}défense {DEFENSIVE_LINE_LABEL[report.expectedPlan.defensiveLine].toLowerCase()}
          {focus.length > 0 && ` · travaille ${focus.map(f => SET_PIECE_LABEL[f as 'MELEE' | 'TOUCHE' | 'MAUL'].toLowerCase()).join(' et ')}`}
        </span>
      </div>

      <ul className="dos-units">
        {report.units.map(u => (
          <li key={u.unit} className={u.known && u.versusLeague >= 5 ? 'strong' : u.known && u.versusLeague <= -5 ? 'weak' : ''}>
            <span className="du-label">{u.label}</span>
            <span className="du-rating">{u.display}</span>
            <span className="du-delta">
              {u.known ? `${u.versusLeague >= 0 ? '+' : ''}${u.versusLeague}` : ''}
            </span>
          </li>
        ))}
      </ul>

      <p className="dos-hint">{reportHint(report)}</p>

      {/* V0.65 — l'avertissement de touche. Il vient avant les menaces parce
          qu'il porte sur nous : c'est la seule ligne du dossier sur laquelle le
          manager peut encore agir avant le coup d'envoi. */}
      {report.lineoutWarning !== undefined && (
        <p className="dos-warning">{report.lineoutWarning}</p>
      )}

      {report.threats.length > 0 && (
        <div className="dos-block">
          <span className="dos-label">À surveiller</span>
          <ul className="dos-threats">
            {report.threats.map(t => (
              <li key={t.player.id as string}>
                <PositionBadge position={t.player.position} />
                <span className="dt-name">{t.player.lastName}</span>
                <span className="dt-reason">{t.reason}</span>
                <span className="dt-rating">{t.rating}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.unavailable.length > 0 && (
        <div className="dos-block">
          <span className="dos-label">Absents ({report.unavailable.length})</span>
          <p className="dos-absents">
            {report.unavailable.slice(0, 6).map(p => p.lastName).join(', ')}
            {report.unavailable.length > 6 && `, +${report.unavailable.length - 6}`}
          </p>
        </div>
      )}
    </div>
  );
}
