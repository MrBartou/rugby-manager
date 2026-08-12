/**
 * Tests des fenêtres de mercato — V0.30.
 *
 * Le point à protéger : la contrainte calendaire est la **même pour le manager
 * et pour l'IA**. Un statut lisible partout, une seule source de vérité.
 */

import { describe, expect, it } from 'vitest';
import {
  TRANSFER_WINDOWS,
  isTransferWindowOpen,
  isWindowOpeningRound,
  nextWindow,
  transferWindowStatus,
  windowForRound,
} from '../../src/engine/season/transfer-window.js';

describe('fenêtres de mercato', () => {
  it('ouvre le marché en début de saison puis à la trêve', () => {
    expect(windowForRound(1)?.id).toBe('ESTIVAL');
    expect(windowForRound(3)?.id).toBe('ESTIVAL');
    expect(windowForRound(13)?.id).toBe('HIVERNAL');
    expect(windowForRound(16)?.id).toBe('HIVERNAL');
  });

  it('ferme le marché entre les deux fenêtres et jusqu\'à la fin de saison', () => {
    for (const round of [4, 8, 12, 17, 26]) {
      expect(isTransferWindowOpen(round)).toBe(false);
    }
  });

  it('ne signale l\'ouverture qu\'à la journée exacte', () => {
    expect(isWindowOpeningRound(13, 'HIVERNAL')).toBe(true);
    // Sinon le marché serait rejoué à chaque journée de la fenêtre.
    expect(isWindowOpeningRound(14, 'HIVERNAL')).toBe(false);
    expect(isWindowOpeningRound(13, 'ESTIVAL')).toBe(false);
  });

  it('les fenêtres ne se chevauchent pas', () => {
    const sorted = [...TRANSFER_WINDOWS].sort((a, b) => a.opensAt - b.opensAt);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.opensAt).toBeGreaterThan(sorted[i - 1]!.closesAfter);
    }
  });

  it('annonce la prochaine fenêtre quand le marché est fermé', () => {
    expect(nextWindow(5)?.id).toBe('HIVERNAL');
    const status = transferWindowStatus(8);
    expect(status.open).toBe(false);
    expect(status.roundsUntilNext).toBe(5);
    expect(status.summary).toMatch(/J13/);
  });

  it('prévient qu\'il ne reste plus de fenêtre cette saison', () => {
    const status = transferWindowStatus(20);
    expect(status.open).toBe(false);
    expect(status.next).toBeUndefined();
    expect(status.summary).toMatch(/intersaison/i);
  });

  it('signale le dernier jour d\'une fenêtre', () => {
    expect(transferWindowStatus(16).summary).toMatch(/dernier jour/i);
    expect(transferWindowStatus(14).roundsLeft).toBe(2);
  });
});
