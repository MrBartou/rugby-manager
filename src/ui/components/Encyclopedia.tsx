/**
 * L'encyclopédie, en surimpression : V0.62.
 *
 * Elle s'ouvre par-dessus l'écran où l'on se trouve, sur l'entrée qui répond à
 * la question qu'on s'y pose. Un glossaire qu'il faudrait parcourir depuis le
 * début à chaque fois ne serait pas contextuel, ce serait une annexe.
 *
 * ## Ce que la première version ratait
 *
 * Une liste à plat, dix termes, et un pavé de texte à droite. On ne savait ni
 * où l'on était, ni ce qu'il y avait à lire à côté. Trois manques, corrigés
 * ici : les entrées sont **rangées par thème**, chacune s'ouvre sur **une
 * phrase** avant le paragraphe (on ouvre un glossaire pour débloquer une
 * décision, pas pour s'instruire), et les renvois vers les notions voisines
 * sont cliquables, parce qu'un terme de rugby en appelle toujours un autre.
 */

import { useMemo, useState } from 'react';
import {
  GLOSSARY,
  GLOSSARY_TOPIC_LABEL,
  entriesByTopic,
  entryById,
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
  const [selectedId, setSelectedId] = useState(initialEntryId ?? GLOSSARY[0]?.id ?? '');

  const results = useMemo(() => searchGlossary(query), [query]);
  const groupes = useMemo(() => entriesByTopic(results), [results]);
  const selected: GlossaryEntry | undefined =
    results.find(e => e.id === selectedId) ?? results[0];

  return (
    <div className="modal-backdrop ency-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal encyclopedia" onClick={e => e.stopPropagation()}>
        <header className="ency-head">
          <div className="ency-head-title">
            <span className="panel-tag">Encyclopédie</span>
            <p className="ency-head-sub">
              Ce que les mots du rugby professionnel changent pour vous.
            </p>
          </div>
          <input
            className="ency-search"
            type="search"
            placeholder="Chercher : JIFF, mercato, bonus…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </header>

        <div className="ency-body">
          <nav className="ency-list" aria-label="Termes">
            {groupes.map(groupe => (
              <section key={groupe.topic} className="ency-group">
                <h4 className="ency-group-title">{GLOSSARY_TOPIC_LABEL[groupe.topic]}</h4>
                <ul>
                  {groupe.entries.map(entry => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={entry.id === selected?.id ? 'active' : ''}
                        onClick={() => setSelectedId(entry.id)}
                      >
                        {entry.term}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {results.length === 0 && (
              <p className="ency-empty">
                Aucun terme ne correspond. Essayez « cap », « bonus » ou « prêt ».
              </p>
            )}
          </nav>

          {selected && (
            <article className="ency-entry" key={selected.id}>
              <span className={`ency-chip topic-${selected.topic.toLowerCase()}`}>
                {GLOSSARY_TOPIC_LABEL[selected.topic]}
              </span>
              <h3>{selected.term}</h3>

              {/* L'essentiel avant le détail : un lecteur qui ouvre un
                  glossaire cherche à débloquer une décision, pas à lire. */}
              <p className="ency-short">{selected.inShort}</p>

              <div className="ency-block">
                <span className="ency-label">La définition</span>
                <p>{selected.definition}</p>
              </div>

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

              {selected.seeAlso && selected.seeAlso.length > 0 && (
                <footer className="ency-see-also">
                  <span className="ency-label">À lire ensuite</span>
                  <div className="ency-links">
                    {selected.seeAlso.map(id => {
                      const voisin = entryById(id);
                      if (!voisin) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="ency-link"
                          onClick={() => { setQuery(''); setSelectedId(id); }}
                        >
                          {voisin.term}
                        </button>
                      );
                    })}
                  </div>
                </footer>
              )}
            </article>
          )}
        </div>

        <div className="modal-actions">
          <span className="ency-count">
            {GLOSSARY.length} termes · l'aide s'ouvre sur celui de l'écran où vous êtes
          </span>
          <button type="button" className="primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
