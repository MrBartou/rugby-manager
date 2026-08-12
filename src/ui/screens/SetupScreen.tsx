import { useEffect, useState } from 'react';
import { ClubCrest } from '../components/ClubCrest.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import type { Club } from '../../engine/types.js';
import type { PreloadedDecision } from '../../engine/match/session.js';
import { matchSaveRepository, type SavedMatchMeta } from '../../data/match-save-repository.js';

interface Props {
  readonly clubs: readonly Club[];
  readonly onStart: (homeClubId: string, awayClubId: string, seed: string) => void;
  readonly onLoad: (homeClubId: string, awayClubId: string, seed: string, decisions: readonly PreloadedDecision[]) => void;
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

export function SetupScreen({ clubs, onStart, onLoad }: Props) {
  const defaultHome = clubs[0]?.id ?? '';
  const defaultAway = clubs[1]?.id ?? clubs[0]?.id ?? '';
  const [homeId, setHomeId] = useState<string>(defaultHome);
  const [awayId, setAwayId] = useState<string>(defaultAway);
  const [seed, setSeed] = useState<string>(String(Math.floor(Math.random() * 1_000_000)));
  const [saves, setSaves] = useState<readonly SavedMatchMeta[]>([]);
  const [savesLoaded, setSavesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    matchSaveRepository.list().then(list => {
      if (!cancelled) {
        setSaves(list);
        setSavesLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshSaves = (): void => {
    matchSaveRepository.list().then(setSaves);
  };

  const loadSave = async (saveId: string): Promise<void> => {
    const save = await matchSaveRepository.load(saveId);
    if (!save) return;
    onLoad(save.homeClubId, save.awayClubId, save.matchSeed, save.decisionLog);
  };

  const deleteSave = async (saveId: string): Promise<void> => {
    await matchSaveRepository.delete(saveId);
    refreshSaves();
  };

  const homeClub = clubs.find(c => c.id === homeId);
  const awayClub = clubs.find(c => c.id === awayId);

  const canStart = homeId && awayId && homeId !== awayId;

  const onPlay = (): void => {
    if (!canStart) return;
    onStart(homeId, awayId, seed);
  };

  const newSeed = (): void => setSeed(String(Math.floor(Math.random() * 1_000_000)));

  return (
    <section className="setup">
      <div>
        <h2>Composer un match</h2>
        <p className="help">
          Choisis deux clubs du Top 14, fixe un seed pour rejouer le même match, puis lance.
          La simulation tourne en mode hors-ligne (pas de licence officielle, données dev).
        </p>
      </div>

      <div className="setup-row">
        <div
          className="team-card"
          style={homeClub ? { ['--card-color' as string]: readableAccent(clubIdentity(homeClub.id as string).primary) } : undefined}
        >
          <label>Domicile</label>
          {homeClub && (
            <div className="team-card-crest">
              <ClubCrest clubId={homeClub.id as string} initials={homeClub.shortName} size={56} />
            </div>
          )}
          <select value={homeId} onChange={e => setHomeId(e.target.value)}>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {homeClub && <div className="meta">{clubMeta(homeClub)}</div>}
        </div>

        <div className="vs">VS</div>

        <div
          className="team-card"
          style={awayClub ? { ['--card-color' as string]: readableAccent(clubIdentity(awayClub.id as string).primary) } : undefined}
        >
          <label>Extérieur</label>
          {awayClub && (
            <div className="team-card-crest">
              <ClubCrest clubId={awayClub.id as string} initials={awayClub.shortName} size={56} />
            </div>
          )}
          <select value={awayId} onChange={e => setAwayId(e.target.value)}>
            {clubs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {awayClub && <div className="meta">{clubMeta(awayClub)}</div>}
        </div>
      </div>

      <div className="setup-controls">
        <label>
          Seed
          <input type="text" value={seed} onChange={e => setSeed(e.target.value)} />
        </label>
        <button onClick={newSeed} type="button">Aléatoire</button>
        <div style={{ flex: 1 }} />
        <button
          className="primary"
          onClick={onPlay}
          disabled={!canStart}
          type="button"
        >
          Lancer le match
        </button>
      </div>

      {homeId === awayId && (
        <div style={{ color: 'var(--yellow)', fontSize: 13 }}>
          Choisis deux clubs différents.
        </div>
      )}

      {savesLoaded && saves.length > 0 && (
        <div className="saves-list">
          <div className="saves-tag">Mes matchs sauvegardés ({saves.length})</div>
          <ul>
            {saves.map(s => (
              <li key={s.saveId}>
                <div className="save-main">
                  <div className="save-title">{s.displayName}</div>
                  <div className="save-meta">
                    {new Date(s.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    {' • '}
                    {s.homeTries}-{s.awayTries} essais
                  </div>
                </div>
                <div className="save-actions">
                  <button onClick={() => loadSave(s.saveId)} type="button">Charger</button>
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
