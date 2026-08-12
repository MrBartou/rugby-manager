/**
 * MatchSaveRepository — abstraction de la persistance des sauvegardes de match.
 *
 * V0.2 : 1 implémentation localStorage. Voir `schema.sql` pour la cible SQLite.
 *
 * Suit le pattern Repository de 09-architecture-logicielle.md, section A.2 :
 * tout passe par l'interface, l'UI ne sait pas quelle implémentation est branchée.
 * En V0.3+ on ajoutera `LocalSQLiteRepository` (sql.js + IndexedDB) et `RemoteAPIRepository`
 * sans toucher au reste du code.
 */

import type { DecisionRecord } from '../engine/match/session.js';

// =============================================================================
// Types
// =============================================================================

export const SCHEMA_VERSION = '0.2.0';

/** Métadonnées d'une sauvegarde (affichées dans la liste "mes matchs"). */
export interface SavedMatchMeta {
  readonly saveId: string;
  readonly displayName: string;
  readonly savedAt: string;
  readonly schemaVersion: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly matchSeed: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly homeTries: number;
  readonly awayTries: number;
  readonly narrativeSummary: string;
}

/** Sauvegarde complète : metadata + log des décisions (suffisant pour rejouer). */
export interface SavedMatch extends SavedMatchMeta {
  readonly decisionLog: readonly DecisionRecord[];
}

export interface MatchSaveRepository {
  list(): Promise<readonly SavedMatchMeta[]>;
  load(saveId: string): Promise<SavedMatch | undefined>;
  save(match: SavedMatch): Promise<void>;
  delete(saveId: string): Promise<void>;
}

// =============================================================================
// Erreurs typées
// =============================================================================

export type RepositoryErrorCode =
  | 'SAVE_NOT_FOUND'
  | 'CORRUPTED_SAVE'
  | 'SCHEMA_VERSION_INCOMPATIBLE'
  | 'STORAGE_FULL'
  | 'UNKNOWN';

export class MatchRepositoryError extends Error {
  constructor(message: string, public readonly code: RepositoryErrorCode) {
    super(message);
    this.name = 'MatchRepositoryError';
  }
}

// =============================================================================
// Implémentation localStorage
// =============================================================================

const STORAGE_KEY = 'rm_saved_matches_v0';

interface StorageShape {
  readonly version: string;
  readonly saves: Record<string, SavedMatch>;
}

function readStorage(): StorageShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: SCHEMA_VERSION, saves: {} };
    const parsed = JSON.parse(raw) as StorageShape;
    if (!parsed || typeof parsed !== 'object' || !parsed.saves) {
      return { version: SCHEMA_VERSION, saves: {} };
    }
    return parsed;
  } catch {
    return { version: SCHEMA_VERSION, saves: {} };
  }
}

function writeStorage(s: StorageShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      throw new MatchRepositoryError('Stockage saturé.', 'STORAGE_FULL');
    }
    throw new MatchRepositoryError(`Erreur d'écriture localStorage : ${String(e)}`, 'UNKNOWN');
  }
}

class LocalStorageMatchRepository implements MatchSaveRepository {
  async list(): Promise<readonly SavedMatchMeta[]> {
    const data = readStorage();
    return Object.values(data.saves)
      .map(s => ({
        saveId: s.saveId,
        displayName: s.displayName,
        savedAt: s.savedAt,
        schemaVersion: s.schemaVersion,
        homeClubId: s.homeClubId,
        awayClubId: s.awayClubId,
        matchSeed: s.matchSeed,
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        homeTries: s.homeTries,
        awayTries: s.awayTries,
        narrativeSummary: s.narrativeSummary,
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async load(saveId: string): Promise<SavedMatch | undefined> {
    const data = readStorage();
    const save = data.saves[saveId];
    if (!save) return undefined;
    if (save.schemaVersion !== SCHEMA_VERSION) {
      throw new MatchRepositoryError(
        `Schéma incompatible : ${save.schemaVersion} (attendu ${SCHEMA_VERSION})`,
        'SCHEMA_VERSION_INCOMPATIBLE',
      );
    }
    return save;
  }

  async save(match: SavedMatch): Promise<void> {
    const data = readStorage();
    writeStorage({
      version: SCHEMA_VERSION,
      saves: { ...data.saves, [match.saveId]: match },
    });
  }

  async delete(saveId: string): Promise<void> {
    const data = readStorage();
    if (!(saveId in data.saves)) return;
    const next = { ...data.saves };
    delete next[saveId];
    writeStorage({ version: SCHEMA_VERSION, saves: next });
  }
}

/** Instance partagée injectée à la racine (cf. discipline 09-archi A.2). */
export const matchSaveRepository: MatchSaveRepository = new LocalStorageMatchRepository();

// =============================================================================
// Helpers UI
// =============================================================================

export function generateSaveId(): string {
  return `save_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function defaultDisplayName(homeShort: string, awayShort: string, homeScore: number, awayScore: number): string {
  return `${homeShort} ${homeScore}-${awayScore} ${awayShort}`;
}
