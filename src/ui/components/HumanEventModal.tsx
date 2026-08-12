import type { HumanEvent } from '../../engine/human/events.js';
import { useDismiss } from './useDismiss.js';

interface Props {
  readonly event: HumanEvent;
  readonly remaining: number;
  readonly onChoose: (optionId: string) => void;
  readonly onSkip: () => void;
}

const TYPE_LABEL: Record<HumanEvent['type'], string> = {
  CONFLIT_VESTIAIRE: 'Conflit vestiaire',
  DEMANDE_INDIVIDUELLE: 'Demande individuelle',
  MENTOR_PROPOSE: 'Tutorat proposé',
  STAR_FATIGUEE: 'Cadre épuisé',
  PRESSE_NEGATIVE: 'Crise médiatique',
  VULNERABILITE_MENTALE: 'Vulnérabilité mentale',
  EVENT_POSITIF: 'Moment positif',
  INCIDENT_PRESSE_JOUEUR: 'Polémique joueur',
  AMBITION_TRANSFERT: 'Tentation extérieure',
  CONFLIT_POSTE: 'Concurrence sur un poste',
};

export function HumanEventModal({ event, remaining, onChoose, onSkip }: Props) {
  const { closing, dismiss } = useDismiss();
  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
      {/* Effet "pile" : cartes fantômes derrière indiquant la queue */}
      {remaining > 1 && (
        <>
          {remaining > 2 && <div className="modal-stack-card stack-2" aria-hidden />}
          <div className="modal-stack-card stack-1" aria-hidden />
        </>
      )}
      <div className="modal">
        <div className="modal-header">
          <span className="modal-tag">{TYPE_LABEL[event.type]} · J{event.atRound}</span>
          <h3>{event.title}</h3>
          <p className="modal-context">{event.context}</p>
          {remaining > 1 && (
            <span className="modal-queue-badge" aria-label={`${remaining - 1} en attente`}>
              +{remaining - 1} en attente
            </span>
          )}
        </div>
        <div className="modal-options">
          {event.options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`option ${opt.id === event.defaultOptionId ? 'option-default' : ''}`}
              onClick={() => dismiss(() => onChoose(opt.id))}
            >
              <strong>{opt.label}</strong>
              <span>{opt.description}</span>
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => dismiss(onSkip)} className="modal-skip">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
