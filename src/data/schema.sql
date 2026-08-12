-- =============================================================================
-- Schéma SQLite — V0.2
-- =============================================================================
-- Référence : 09-architecture-logicielle.md (event sourcing + saves portables).
--
-- V0.2 ne stocke que les matchs sauvegardés. À partir de V0.3 (boucle
-- hebdomadaire) le schéma s'étendra : saisons, calendrier, mood, relations…
--
-- En V0.2 l'implémentation runtime utilise localStorage (ce schéma documente
-- la cible long terme). Le passage à sql.js + IndexedDB se fait par swap de
-- l'implémentation `MatchSaveRepository` sans toucher au reste.
-- =============================================================================

-- Métadonnées des sauvegardes (1 row par match sauvegardé)
CREATE TABLE IF NOT EXISTS saved_matches (
  save_id          TEXT PRIMARY KEY,
  display_name     TEXT NOT NULL,                -- "Toulouse 21-12 UBB"
  saved_at         TEXT NOT NULL,                -- ISO 8601
  schema_version   TEXT NOT NULL,                -- ex : "0.2.0"

  -- Identité du match
  home_club_id     TEXT NOT NULL,
  away_club_id     TEXT NOT NULL,
  match_seed       TEXT NOT NULL,

  -- Aperçu rapide (sans recharger les phases)
  home_score       INTEGER NOT NULL,
  away_score       INTEGER NOT NULL,
  home_tries       INTEGER NOT NULL,
  away_tries       INTEGER NOT NULL,
  narrative_summary TEXT NOT NULL,

  -- Source de vérité pour le replay : log des décisions en JSON
  -- (la séquence de phases est dérivée déterministiquement de seed + decisions)
  decision_log_json TEXT NOT NULL                -- JSON array de DecisionRecord
);

CREATE INDEX IF NOT EXISTS idx_saves_recent ON saved_matches (saved_at DESC);

-- Index par club (V0.3 : retrouver "tous mes matchs avec Toulouse")
CREATE INDEX IF NOT EXISTS idx_saves_home_club ON saved_matches (home_club_id);
CREATE INDEX IF NOT EXISTS idx_saves_away_club ON saved_matches (away_club_id);

-- =============================================================================
-- Tables prévues V0.3+ (commentées — ajout au moment où elles seront utiles)
-- =============================================================================
--
-- CREATE TABLE seasons (...);
-- CREATE TABLE rosters (...);              -- effectif par club et par saison
-- CREATE TABLE player_state (...);         -- mood, fatigue, blessures
-- CREATE TABLE relationships (...);        -- graphe joueurs (M6)
-- CREATE TABLE traits_revealed (...);      -- scouting progressif (M3)
-- CREATE TABLE league_standings (...);     -- classement Top 14 par journée
