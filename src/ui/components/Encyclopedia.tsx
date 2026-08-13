/**
 * L'encyclopédie, en surimpression : V0.62.
 *
 * Elle s'ouvre par-dessus l'écran où l'on se trouve, sur l'entrée qui répond à
 * la question qu'on s'y pose. Un glossaire qu'il faudrait parcourir depuis le
 * début à chaque fois ne serait pas contextuel, ce serait une annexe.
 */

import { useMemo, useState } from 'react';
import {
  GLOSSARY,
  GLOSSARY_TOPIC_LABEL,
  searchGlossary,
  type GlossaryEntry,
} from '../encyclopedia.js';

interface Props {
  /** Entrée ouverte d'emblée, choisie selon l'écran d'où l'on vient. */
  readonly initialEntryId?: string;
  readonly onClose: () => void;
}

export function Encyclopedia({ initialEntryId, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(
    initialEntryId ?? GLOSSARY[0]?.id ?? '',
  );

  const results = useMemo(() => searchGlossary(query), [query]);
  const selected: GlossaryEntry | undefined =
    results.find(e => e.id === selectedId) ?? results[0];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal encyclopedia" onClick={e => e.stopPropagation()}>
        <div className="ency-head">
          <div className="panel-tag">Encyclopédie</div>
          <input
            className="squad-search"
            type="search"
            placeholder="Chercher un terme…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="ency-body">
          <ul className="ency-list">
            {results.map(entry => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={entry.id === selected?.id ? 'active' : ''}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className="ency-term">{entry.term}</span>
                  <span className="ency-topic">{GLOSSARY_TOPIC_LABEL[entry.topic]}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="ency-empty">Aucun terme ne correspond.</li>
            )}
          </ul>

          {selected && (
            <article className="ency-entry">
              <h3>{selected.term}</h3>
              <p className="ency-def">{selected.definition}</p>

              <div className="ency-block">
                <span className="ency-label">Ce que ça change pour vous</span>
                <p>{selected.whatItMeans}</p>
              </div>

              {/* Annoncer l'écart avec le règlement réel vaut mieux que laisser
                  un connaisseur le découvrir et croire à un défaut. */}
              {selected.gameNote && (
                <div className="ency-block note">
                  <span className="ency-label">Dans ce jeu</span>
                  <p>{selected.gameNote}</p>
                </div>
              )}
            </article>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
