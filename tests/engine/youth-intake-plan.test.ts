/**
 * La promotion des jeunes, division par division : V0.62.
 *
 * La boucle vivait dans `App.tsx`, au milieu du câblage de l'intersaison. Elle
 * décide pourtant qui entre dans le monde du jeu, et porte deux règles que rien
 * ne testait : tous les clubs reçoivent leur promotion, et seul le centre du
 * club dirigé suit l'investissement du manager.
 */

import { describe, expect, it } from 'vitest';
import { planYouthIntake } from '@/engine/season/rollover.js';
import type { Club, ClubId, Player, PlayerId } from '@/engine/types.js';

const club = (id: string): Club => ({
  id: id as ClubId,
  name: `Club ${id}`,
  shortName: id.toUpperCase(),
  city: 'Ville',
  tier: 'BUDGET_MOYEN',
  tacticalIdentity: 'MIXTE',
  stadiumCapacity: 15_000,
  annualBudget: 12_000_000,
  salaryCapUsage: 0,
  jiffCount: 15,
  reputation: 60,
});

const n = 60;
const jeune = (id: string, clubId: ClubId): Player => ({
  id: id as PlayerId,
  clubId,
  firstName: 'J', lastName: id, birthDate: '2006-01-01',
  position: 'OUVREUR', secondaryPositions: [], isJiff: true,
  technical: { passe: n, plaquage: n, jeuAuPiedPlace: n, jeuAuPiedDynamique: n, visionDeJeu: n, conservation: n, prisedeballeHaute: n, deblayage: n },
  physical: { vitesse: n, puissance: n, endurance: n, detente: n, robustesse: n },
  mental: { decision: n, leadership: n, sangFroid: n, agressivite: n, professionnalisme: n, discipline: n },
  positionSpecific: {}, traits: [],
  hidden: { potentiel: 80, ambition: 50, determinisme: 50, loyaute: 60, adaptabilite: 50 },
  dynamic: { forme: 70, fatigue: 0, mood: 60, moodModifiers: [] },
  contract: { startSeason: 2026, endSeason: 2029, annualSalary: 40_000 },
});

/** Générateur de test : deux jeunes par club, identifiants jamais réutilisés. */
const generateur = () => {
  const appels: { clubId: string; academyLevel: number; focus?: string }[] = [];
  let compteur = 0;
  return {
    appels,
    generate: (args: {
      club: Club; academyLevel: number; focus?: string;
      existingPlayerIds: ReadonlySet<string>;
    }) => {
      appels.push({
        clubId: args.club.id as string,
        academyLevel: args.academyLevel,
        ...(args.focus ? { focus: args.focus } : {}),
      });
      return [0, 1].map(() => {
        let id = `jeune_${compteur++}`;
        while (args.existingPlayerIds.has(id)) id = `jeune_${compteur++}`;
        return jeune(id, args.club.id);
      });
    },
  };
};

const base = (g: ReturnType<typeof generateur>) => ({
  clubs: [club('mine'), club('autre'), club('prod2')],
  playerClubId: 'mine' as ClubId,
  newSeason: 2027,
  seed: 'test',
  existingPlayerIds: new Set<string>(),
  playerAcademy: { level: 5, focus: 'AVANTS' as const },
  defaultAcademyLevel: () => 2,
  generate: g.generate,
});

describe('tous les clubs reçoivent leur promotion', () => {
  it('y compris ceux de la division qu\'on ne joue pas', () => {
    // V0.60 : la boucle ne parcourait que la division du manager, alors que le
    // vieillissement frappe tout le monde. L'autre étage se vidait.
    const g = generateur();
    const out = planYouthIntake(base(g));

    expect(g.appels.map(a => a.clubId)).toEqual(['mine', 'autre', 'prod2']);
    expect(out.all).toHaveLength(6);
  });

  it('et le club dirigé est isolé pour être annoncé', () => {
    const g = generateur();
    const out = planYouthIntake(base(g));

    expect(out.forPlayerClub).toHaveLength(2);
    expect(out.forPlayerClub.every(p => (p.clubId as string) === 'mine')).toBe(true);
  });
});

describe('le centre du club dirigé suit son investissement', () => {
  it('lui son niveau et son orientation, aux autres celui de leur taille', () => {
    const g = generateur();
    planYouthIntake(base(g));

    const mien = g.appels.find(a => a.clubId === 'mine')!;
    const autre = g.appels.find(a => a.clubId === 'autre')!;
    expect(mien.academyLevel).toBe(5);
    expect(mien.focus).toBe('AVANTS');
    expect(autre.academyLevel).toBe(2);
    expect(autre.focus).toBeUndefined();
  });

  it('sans orientation déclarée, on n\'en invente pas', () => {
    const g = generateur();
    planYouthIntake({ ...base(g), playerAcademy: { level: 3 } });
    expect(g.appels.find(a => a.clubId === 'mine')!.focus).toBeUndefined();
  });
});

describe('deux centres ne sortent pas le même joueur', () => {
  it('les identifiants déjà pris circulent d\'un club à l\'autre', () => {
    const g = generateur();
    const out = planYouthIntake(base(g));
    const ids = out.all.map(p => p.id as string);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('et ceux d\'après rollover sont respectés', () => {
    const g = generateur();
    const out = planYouthIntake({
      ...base(g),
      existingPlayerIds: new Set(['jeune_0', 'jeune_1']),
    });
    expect(out.all.map(p => p.id as string)).not.toContain('jeune_0');
  });
});
