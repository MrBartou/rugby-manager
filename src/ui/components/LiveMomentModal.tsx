import type { LiveMoment } from '../../engine/match/live-moments.js';
import { staffRoleLabel, type StaffMember } from '../../engine/club/staff.js';
import { useDismiss } from './useDismiss.js';

interface Props {
  readonly moment: LiveMoment;
  readonly staff: readonly StaffMember[];
  readonly onChoose: (optionId: string) => void;
  readonly onSkip: () => void;
}

export function LiveMomentModal({ moment, staff, onChoose, onSkip }: Props) {
  const staffByRole = new Map(staff.map(s => [s.role, s] as const));
  const { closing, dismiss } = useDismiss();

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-tag">Décision · {moment.minute}'</span>
          <h3>{moment.prompt}</h3>
          <p className="modal-context">{moment.context}</p>
        </div>
        <div className="modal-options">
          {moment.options.map(opt => {
            const voice = opt.voiceStaffRole ? staffByRole.get(opt.voiceStaffRole) : undefined;
            return (
              <button
                key={opt.id}
                type="button"
                className={`option ${opt.id === moment.defaultOptionId ? 'option-default' : ''}`}
                onClick={() => dismiss(() => onChoose(opt.id))}
              >
                {voice && (
                  <span className="option-voice">
                    <em>"{voice.firstName} {voice.lastName}"</em>
                    <small>{staffRoleLabel(voice.role)}</small>
                  </span>
                )}
                <strong>{opt.label}</strong>
                <span>{opt.description}</span>
              </button>
            );
          })}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => dismiss(onSkip)} className="modal-skip">
            Choisir l'option par défaut
          </button>
        </div>
      </div>
    </div>
  );
}
