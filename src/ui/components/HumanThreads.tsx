import type { HumanThread } from '../../engine/human/threads.js';

interface Props {
  readonly threads: readonly HumanThread[];
  readonly onClick: (thread: HumanThread) => void;
}

const KIND_ICON: Record<HumanThread['kind'], string> = {
  PENDING_EVENT: '!',
  CONFLICT: '⚡',
  LOW_MOOD: '↓',
  MENTOR: '★',
  HOT_FORM: '↑',
  CONTRACT_EXPIRING: '€',
  INJURY_LIST: '+',
};

export function HumanThreads({ threads, onClick }: Props) {
  if (threads.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="panel-tag">Vie du vestiaire</div>
        <p className="empty">Pas de fil humain actif. Le vestiaire respire.</p>
      </div>
    );
  }
  return (
    <div className="dashboard-panel threads-panel">
      <div className="panel-tag">Vie du vestiaire ({threads.length})</div>
      <ul className="threads-list">
        {threads.map(t => (
          <li key={t.id}>
            <button
              type="button"
              className={`thread-card thread-${t.tone}`}
              onClick={() => onClick(t)}
            >
              <span className="thread-icon">{KIND_ICON[t.kind]}</span>
              <span className="thread-content">
                <span className="thread-title">{t.title}</span>
                <span className="thread-context">{t.context}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
