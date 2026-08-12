import type {
  ContractDecision,
  ContractDecisionOptionId,
  ContractDecisionResolution,
} from '../../engine/club/contract-decisions.js';
import { useDismiss } from './useDismiss.js';

interface Props {
  readonly decision: ContractDecision;
  readonly remaining: number;
  readonly lastResolution: ContractDecisionResolution | null;
  readonly onChoose: (optionId: ContractDecisionOptionId) => void;
  readonly onSkip: () => void;
  readonly onAcknowledge: () => void;
}

function formatEuros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}

export function ContractDecisionModal({
  decision, remaining, lastResolution, onChoose, onSkip, onAcknowledge,
}: Props) {
  const { closing, dismiss } = useDismiss();

  if (lastResolution) {
    const { outcome } = lastResolution;
    return (
      <div className={`modal-backdrop ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
        <div className="modal">
          <div className="modal-header">
            <span className="modal-tag">Contrat · Réponse</span>
            <h3>
              {outcome.kind === 'RENEWED' && 'Accord trouvé'}
              {outcome.kind === 'REFUSED' && 'Refus du joueur'}
              {outcome.kind === 'RELEASED' && 'Joueur libéré'}
            </h3>
            <p className="modal-context">
              {outcome.kind === 'RENEWED' &&
                `Contrat signé : ${formatEuros(outcome.newContract.annualSalary)}/an jusqu'à ${outcome.newContract.endSeason}.`}
              {outcome.kind === 'REFUSED' && outcome.reason}
              {outcome.kind === 'RELEASED' &&
                'Le joueur quittera le club en fin de saison. Il deviendra agent libre.'}
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="primary" onClick={() => dismiss(onAcknowledge)}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
      {remaining > 1 && (
        <>
          {remaining > 2 && <div className="modal-stack-card stack-2" aria-hidden />}
          <div className="modal-stack-card stack-1" aria-hidden />
        </>
      )}
      <div className="modal">
        <div className="modal-header">
          <span className="modal-tag">Contrat · Fin de saison</span>
          <h3>{decision.playerFirstName} {decision.playerLastName} ({decision.age} ans)</h3>
          <p className="modal-context">
            Contrat actuel : {formatEuros(decision.currentAnnualSalary)}/an. Que proposez-vous ?
          </p>
          {remaining > 1 && (
            <span className="modal-queue-badge" aria-label={`${remaining - 1} en attente`}>
              +{remaining - 1} en attente
            </span>
          )}
        </div>
        <div className="modal-options">
          {decision.options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className="option"
              onClick={() => dismiss(() => onChoose(opt.id))}
            >
              <strong>{opt.label}</strong>
              <span>{opt.description}</span>
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => dismiss(onSkip)} className="modal-skip">
            Décider plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
