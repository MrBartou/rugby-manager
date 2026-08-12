/**
 * Propositions de clubs — V0.41.
 *
 * Le moment où la carrière bascule. Un manager en poste peut partir pour plus
 * gros ; un manager limogé retrouve un banc au lieu de retourner à l'écran de
 * sélection.
 *
 * L'écran doit rendre lisibles les deux termes de la décision : la **stature**
 * du club qui appelle, et ce que son board **attendra** — car c'est cet
 * objectif qui décidera, deux saisons plus tard, si l'on est reconduit ou
 * remercié.
 */

import type { JobOffer } from '../../engine/season/manager-career.js';
import { reputationLabel, type ManagerReputation } from '../../engine/season/manager-reputation.js';
import { ClubCrest } from './ClubCrest.js';

interface Props {
  readonly offers: readonly JobOffer[];
  readonly reputation: ManagerReputation;
  /** Vrai quand le manager n'a plus de club : il ne peut pas décliner tout. */
  readonly unemployed: boolean;
  readonly currentClubName?: string;
  readonly clubShortName: (clubId: string) => string;
  readonly onAccept: (offer: JobOffer) => void;
  readonly onDecline: () => void;
}

export function JobOfferModal({
  offers, reputation, unemployed, currentClubName, clubShortName, onAccept, onDecline,
}: Props) {
  if (offers.length === 0) return null;

  return (
    // Au-dessus des modales de routine (tutorat, blessure) : tant que le banc
    // n'est pas repris, plus rien d'autre ne se décide.
    <div className="modal-backdrop offers-backdrop" role="dialog" aria-modal="true">
      <div className="modal offers-modal">
        <div className="modal-header">
          <span className="modal-tag">
            {unemployed ? 'Vous êtes sans club' : 'On vous veut ailleurs'}
          </span>
          <h3>{offers.length} proposition{offers.length > 1 ? 's' : ''}</h3>
          <p className="modal-context">
            {reputationLabel(reputation.score)} · réputation {reputation.score}/100
            {reputation.titlesWon > 0 && ` · ${reputation.titlesWon} Brennus`}
          </p>
          {unemployed && (
            <p className="modal-context offers-warning">
              Sans club, il faut reprendre un banc pour continuer. Votre réputation
              s'érode déjà d'être resté sur le carreau.
            </p>
          )}
        </div>

        <ul className="offers-list-career">
          {offers.map(offer => (
            <li key={offer.clubId as string} className="offer-card">
              <ClubCrest
                clubId={offer.clubId as string}
                initials={clubShortName(offer.clubId as string)}
                size={40}
              />

              <div className="oc-body">
                <div className="oc-head">
                  <span className="oc-club">{offer.clubName}</span>
                  <span className="oc-stature">stature {offer.stature}</span>
                </div>
                <p className="oc-pitch">{offer.pitch}</p>
                {/* L'objectif est le vrai contenu du contrat : c'est lui qui
                    décidera d'un maintien ou d'un limogeage. */}
                <div className="oc-objective">
                  <span className="oco-label">Objectif fixé</span>
                  <span className="oco-value">{offer.objective.label}</span>
                </div>
              </div>

              <button type="button" className="primary oc-accept" onClick={() => onAccept(offer)}>
                Signer
              </button>
            </li>
          ))}
        </ul>

        {/* V0.43 — décliner est enfin une vraie option pour un manager sans
            club : l'année sabbatique existe. On dit franchement ce qu'elle
            coûte, car son seul effet mécanique est une érosion. */}
        <div className="modal-footer">
          <button type="button" className="modal-skip" onClick={onDecline}>
            {unemployed
              ? 'Attendre — prendre une année sabbatique'
              : `Rester à ${currentClubName ?? 'mon club'}`}
          </button>
          {unemployed && (
            <span className="offers-decline-hint">
              Votre réputation continuera de s'éroder tant que vous serez sans banc.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
