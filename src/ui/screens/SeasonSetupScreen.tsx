import { useEffect, useState } from 'react';
import { ClubCrest } from '../components/ClubCrest.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import type { Club } from '../../engine/types.js';
import { DIVISION_LABEL, type Division } from '../../engine/season/divisions.js';
import { computeObjective } from '../../engine/season/board-objective.js';
import { seasonSaveRepository, type SeasonSaveMeta } from '../../data/season-save-repository.js';

interface Props {
  readonly clubs: readonly Club[];
  readonly onStartSeason: (playerClubId: string, seed: string) => void;
  readonly onPlaySingleMatch: () => void;
  readonly onLoadSeason: (saveId: string) => void;
}

function clubMeta(c: Club): string {
  const tier =
    c.tier === 'GROS_BUDGET' ? 'gros budget' :
    c.tier === 'BUDGET_MOYEN' ? 'budget moyen' : 'petit budget';
  const ident =
    c.tacticalIdentity === 'JEU_AVANTS' ? "jeu d'avants" :
    c.tacticalIdentity === 'GRAND_ECART' ? 'grand écart' :
    c.tacticalIdentity === 'DEFENSE_DE_FER' ? 'défense de fer' : 'mixte';
  return `${tier} • ${ident} • réputation ${c.reputation}`;
}

/**
 * L'objectif qu'annoncera réellement le board — V0.59.
 *
 * Cet écran affichait une promesse déduite du seul budget du club, et le board
 * en formulait une autre au coup d'envoi : Brive annonçait « Maintien » ici et
 * « Accession » une minute plus tard. Deux sources pour la même promesse, et
 * c'est la première chose qu'on lit en créant une carrière.
 *
 * On appelle donc la même fonction que le board — avec la réputation d'un
 * manager qui débute, puisque c'est le cas de tout le monde sur cet écran.
 */
function clubObjective(c: Club, division: Division): string {
  return computeObjective(c, DEBUTANT_REPUTATION, division).label;
}

/** Réputation d'un manager qui n'a encore rien fait. */
const DEBUTANT_REPUTATION = 30;

export function SeasonSetupScreen({ clubs, onStartSeason, onPlaySingleMatch, onLoadSeason }: Props) {
  // V0.44 — les deux étages sont proposés. Commencer en Pro D2 et bâtir la
  // remontée est un projet de carrière à part entière, pas un lot de consolation.
  const [division, setDivision] = useState<Division>('TOP14');
  const shown = clubs.filter(c => (c.id as string).startsWith('prod2_') === (division === 'PRO_D2'));
  const [selectedId, setSelectedId] = useState<string>(clubs[0]?.id ?? '');
  const [seed, setSeed] = useState<string>(String(Math.floor(Math.random() * 1_000_000)));
  const [seasonSaves, setSeasonSaves] = useState<readonly SeasonSaveMeta[]>([]);

  useEffect(() => {
    let cancelled = false;
    seasonSaveRepository.list().then(list => {
      if (!cancelled) setSeasonSaves(list);
    });
    return () => { cancelled = true; };
  }, []);

  const refreshSaves = (): void => {
    seasonSaveRepository.list().then(setSeasonSaves);
  };

  const deleteSave = async (id: string): Promise<void> => {
    await seasonSaveRepository.delete(id);
    refreshSaves();
  };

  const clubNameById = (id: string): string => clubs.find(c => c.id === id)?.name ?? id;
  const selected = clubs.find(c => c.id === selectedId);

  return (
    <section className="setup">
      <div>
        <h2>Choisir son club</h2>
        <p className="help">
          {/* V0.49 — au vouvoiement, comme partout ailleurs : c'était le
              premier écran lu, et le seul où le jeu changeait de voix. */}
          Vous lancez une saison de {division === 'PRO_D2' ? 30 : 26} journées
          avec le club de votre choix. Vous jouez vos matchs ; les autres
          rencontres sont simulées en arrière-plan.
        </p>
      </div>

      <div className="division-picker" role="tablist">
        {(['TOP14', 'PRO_D2'] as const).map(d => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={division === d}
            className={`division-tab ${division === d ? 'active' : ''}`}
            onClick={() => {
              setDivision(d);
              const first = clubs.find(c => (c.id as string).startsWith('prod2_') === (d === 'PRO_D2'));
              if (first) setSelectedId(first.id);
            }}
          >
            {DIVISION_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="club-grid">
        {shown.map(c => (
          <button
            key={c.id}
            type="button"
            className={`club-card ${c.id === selectedId ? 'selected' : ''}`}
            style={{
              ['--card-color' as string]: readableAccent(clubIdentity(c.id as string).primary),
            }}
            onClick={() => setSelectedId(c.id)}
          >
            <ClubCrest clubId={c.id as string} initials={c.shortName} size={44} />
            <div className="club-card-text">
              <div className="club-card-name">{c.name}</div>
              <div className="club-card-meta">{clubMeta(c)}</div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="objective-banner">
          <span className="label">Objectif saison ({selected.name}) :</span>
          <span className="value">{clubObjective(selected, division)}</span>
        </div>
      )}

      <div className="setup-controls">
        <label>
          Seed
          <input type="text" value={seed} onChange={e => setSeed(e.target.value)} />
        </label>
        <button onClick={() => setSeed(String(Math.floor(Math.random() * 1_000_000)))} type="button">
          Aléatoire
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onPlaySingleMatch} type="button">
          Match isolé →
        </button>
        <button
          className="primary"
          onClick={() => onStartSeason(selectedId, seed)}
          disabled={!selectedId}
          type="button"
        >
          Commencer la saison
        </button>
      </div>

      {seasonSaves.length > 0 && (
        <div className="saves-list">
          <div className="saves-tag">Parties en cours ({seasonSaves.length})</div>
          <ul>
            {seasonSaves.map(s => (
              <li key={s.saveId}>
                <div className="save-main">
                  <div className="save-title">{clubNameById(s.playerClubId)} — {s.displayName}</div>
                  <div className="save-meta">
                    {new Date(s.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    {' • '}
                    Journée {s.currentRound > 26 ? '— Phases finales' : `${s.currentRound}/26`}
                    {' • '}
                    {s.playerRank}e ({s.playerLeaguePoints} pts)
                  </div>
                </div>
                <div className="save-actions">
                  <button onClick={() => onLoadSeason(s.saveId)} type="button">Reprendre</button>
                  <button onClick={() => deleteSave(s.saveId)} type="button" className="danger">×</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
