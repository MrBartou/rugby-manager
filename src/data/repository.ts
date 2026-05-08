/**
 * Repository pattern — abstraction de la couche persistance.
 *
 * RÈGLE : aucun appel SQLite direct dans la logique métier.
 * Tout passe par cette interface (cf. 09-architecture-logicielle.md, section A.2).
 *
 * Implémentations :
 *   - LocalSQLiteRepository (v1) — fichier .save SQLite local, exécuté côté Tauri
 *   - RemoteAPIRepository (v2) — REST/GraphQL vers le backend de ligue
 *
 * Le swap se fait à l'injection (root du store/app) — le reste du code
 * ne sait pas quelle implémentation est utilisée.
 */

import type { GameState } from '../engine/types.js';
import type { GameEvent } from '../engine/events.js';

/** Métadonnées d'une partie sauvegardée (visibles dans l'UI "charger une save"). */
export interface SaveMetadata {
  readonly saveId: string;
  readonly displayName: string;          // ex : "Toulouse — Saison 2025-26"
  readonly seasonYear: number;
  readonly currentRound: number;
  readonly clubName: string;
  readonly savedAt: string;              // ISO 8601
  readonly playtimeMinutes: number;
  readonly schemaVersion: string;        // pour migration ascendante
}

/** Format d'export d'une partie (cf. 09-architecture-logicielle.md, section A.4). */
export interface ExportedSave {
  readonly version: string;
  readonly seed: string;
  readonly events: readonly GameEvent[];
  readonly metadata: SaveMetadata;
}

/** Interface de la couche persistance — implémentée par v1 (SQLite) ou v2 (API). */
export interface GameRepository {
  /** Liste les saves disponibles. */
  listSaves(): Promise<readonly SaveMetadata[]>;

  /** Charge une partie complète (état + historique d'events). */
  loadGame(saveId: string): Promise<GameState>;

  /** Sauvegarde une partie (snapshot de l'état + events depuis la dernière save). */
  saveGame(state: GameState, displayName: string): Promise<SaveMetadata>;

  /** Persiste un événement (append-only event log). */
  recordEvent(saveId: string, event: GameEvent): Promise<void>;

  /** Persiste plusieurs événements en une transaction. */
  recordEvents(saveId: string, events: readonly GameEvent[]): Promise<void>;

  /** Exporte une partie au format JSON portable. */
  exportSave(saveId: string): Promise<ExportedSave>;

  /** Importe une partie depuis un export. */
  importSave(exported: ExportedSave): Promise<SaveMetadata>;

  /** Supprime une save. */
  deleteSave(saveId: string): Promise<void>;
}

/** Erreurs typées pour la couche repository. */
export class RepositoryError extends Error {
  constructor(message: string, public readonly code: RepositoryErrorCode) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export type RepositoryErrorCode =
  | 'SAVE_NOT_FOUND'
  | 'CORRUPTED_SAVE'
  | 'SCHEMA_VERSION_INCOMPATIBLE'
  | 'STORAGE_FULL'
  | 'NETWORK_ERROR'
  | 'AUTH_REQUIRED'
  | 'UNKNOWN';
