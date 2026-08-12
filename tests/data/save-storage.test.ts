/**
 * Le stockage ne perd plus tout : v0.60.
 *
 * `readStorage()` avalait **toute** erreur dans un `catch` qui renvoyait un
 * stockage vide. Une seule entrée mal formée faisait donc disparaître la
 * totalité des parties, et la sauvegarde automatique suivante réécrivait le bloc
 * entier par-dessus : la perte devenait définitive au bout d'une journée de jeu,
 * sans que le joueur voie jamais la moindre cause.
 *
 * Ce qui est vérifié ici : une entrée abîmée n'emporte pas les autres, la perte
 * est signalée au lieu d'être silencieuse, une copie de secours est prise avant
 * chaque écrasement, et le stockage plein produit un message exploitable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SaveWriteError,
  restoreBackup,
  seasonSaveRepository,
  storageHealth,
} from '@/data/season-save-repository.js';

/**
 * Substitut de `localStorage`, l'environnement de test étant Node.
 *
 * Écrit avant l'import du dépôt : celui-ci lit le stockage au premier appel, pas
 * au chargement du module, mais autant ne pas dépendre de ce détail.
 */
class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, String(v)); }
  removeItem(k: string): void { this.data.delete(k); }
  key(i: number): string | null { return [...this.data.keys()][i] ?? null; }
}

const memory = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memory;
(globalThis as unknown as { Storage: unknown }).Storage = MemoryStorage;

const KEY = 'rm_seasons_v0';
const BACKUP = 'rm_seasons_v0_backup';

/** Une entrée minimale mais valide, telle que le dépôt l'attend. */
const partie = (saveId: string) => ({
  saveId,
  displayName: `Partie ${saveId}`,
  savedAt: '2026-08-12T20:00:00.000Z',
  schemaVersion: '0.5.0',
  playerClubId: 'toulouse',
  seed: 's',
  currentRound: 12,
  currentSeason: 2025,
  playerRank: 3,
  playerLeaguePoints: 42,
  history: [],
  standings: [],
  clubIds: ['toulouse'],
  playerOverrides: [],
  financesByClub: [],
  careerHistory: { seasons: [] },
  managerReputation: { score: 30, seasonsManaged: 0, titlesWon: 0 },
  objective: { kind: 'TOP_10', targetRank: 10, label: 'Top 10' },
  boardConfidence: { score: 60, consecutiveFailures: 0, fired: false },
});

function ecrireBrut(saves: Record<string, unknown>): void {
  localStorage.setItem(KEY, JSON.stringify({ version: '0.5.0', saves }));
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('une entrée abîmée n\'emporte pas les autres', () => {
  it('charge les parties saines et met la mauvaise de côté', async () => {
    ecrireBrut({
      bonne: partie('bonne'),
      cassee: { saveId: 'cassee' },
      autre: partie('autre'),
    });

    const liste = await seasonSaveRepository.list();
    expect(liste.map(s => s.saveId).sort()).toEqual(['autre', 'bonne']);
    expect(storageHealth().corrupted).toEqual(['cassee']);
    expect(storageHealth().totalLoss).toBe(false);
  });

  it('un bloc entièrement illisible est signalé, pas confondu avec un stockage vide', () => {
    localStorage.setItem(KEY, '{ ceci n\'est pas du JSON');
    void seasonSaveRepository.list();
    expect(storageHealth().totalLoss).toBe(true);
  });

  it('un stockage réellement vide n\'alarme personne', async () => {
    expect(await seasonSaveRepository.list()).toEqual([]);
    expect(storageHealth().totalLoss).toBe(false);
    expect(storageHealth().corrupted).toEqual([]);
  });
});

describe('rien n\'est écrasé sans copie de secours', () => {
  it('conserve l\'état précédent avant d\'écrire', async () => {
    ecrireBrut({ ancienne: partie('ancienne') });
    await seasonSaveRepository.save(partie('nouvelle') as never);

    const backup = JSON.parse(localStorage.getItem(BACKUP) ?? '{}') as { saves?: Record<string, unknown> };
    expect(Object.keys(backup.saves ?? {})).toEqual(['ancienne']);
  });

  it('la restauration ramène les parties de la copie', async () => {
    ecrireBrut({ ancienne: partie('ancienne') });
    await seasonSaveRepository.save(partie('nouvelle') as never);

    // Le bloc principal devient illisible après coup.
    localStorage.setItem(KEY, 'corrompu');
    expect(restoreBackup()).toBe(1);

    const liste = await seasonSaveRepository.list();
    expect(liste.map(s => s.saveId)).toEqual(['ancienne']);
  });

  it('et ne prétend rien récupérer quand il n\'y a rien', () => {
    expect(restoreBackup()).toBe(0);
  });
});

describe('le stockage plein le dit', () => {
  it('donne une cause et un remède au lieu d\'un échec muet', async () => {
    const quota = new Error('quota');
    quota.name = 'QuotaExceededError';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string) => {
      if (k === KEY) throw quota;
    });

    await expect(seasonSaveRepository.save(partie('x') as never))
      .rejects.toBeInstanceOf(SaveWriteError);

    try {
      await seasonSaveRepository.save(partie('x') as never);
    } catch (e) {
      expect((e as SaveWriteError).cause_).toBe('QUOTA');
      expect((e as SaveWriteError).message).toMatch(/place|plein/i);
    }
  });
});
