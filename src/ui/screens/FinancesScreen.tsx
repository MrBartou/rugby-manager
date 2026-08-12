/**
 * Écran Club / Finances — V0.23, reconstruit.
 *
 * L'écran affichait trois panneaux maigres : un solde, deux totaux, une liste de
 * bilans passés. Aucune lecture possible de la santé du club, aucune idée d'où
 * partait l'argent, et un tiers d'écran vide.
 *
 * Il est refait autour des trois questions qu'un manager se pose vraiment :
 * *où j'en suis*, *où va l'argent*, *où je vais finir la saison*.
 */

import { useMemo } from 'react';
import type { Club, Player } from '../../engine/types.js';
import type { ClubFinances } from '../../engine/club/finances.js';
import { StadiumBackdrop } from '../components/StadiumBackdrop.js';
import { clubIdentity, readableAccent } from '../theme/club-identity.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { POSITION_LINE, PositionBadge, type PositionLine } from '../components/DataBits.js';

interface Props {
  readonly club: Club;
  readonly finances: ClubFinances;
  readonly playerClubRoster: readonly Player[];
  readonly currentSeason: number;
  readonly currentRound: number;
  readonly totalRounds: number;
  readonly onBack?: () => void;
}

function formatEuros(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  return `${Math.round(n / 1_000)} k€`;
}

const LINE_LABEL: Record<PositionLine, string> = {
  AVANTS: 'Avants',
  DEMIS: 'Demis',
  TROIS_QUARTS: 'Trois-quarts',
};

export function FinancesScreen({
  club, finances, playerClubRoster, currentSeason, currentRound, totalRounds, onBack,
}: Props) {
  const active = useMemo(
    () => playerClubRoster.filter(p => !p.retired && !p.freeAgent),
    [playerClubRoster],
  );

  const payroll = active.reduce((a, p) => a + p.contract.annualSalary, 0);
  const net = finances.seasonRevenue - finances.seasonExpenses;

  /**
   * Projection de fin de saison : on extrapole le rythme constaté jusqu'ici.
   * Avant la première journée il n'y a rien à extrapoler — on affiche le solde.
   */
  const projection = currentRound > 1
    ? finances.balance + (net / Math.max(1, currentRound - 1)) * (totalRounds - currentRound + 1)
    : finances.balance;

  // Répartition de la masse salariale par ligne : c'est là qu'on voit si le club
  // paie surtout ses avants ou ses trois-quarts.
  const byLine = useMemo(() => {
    const acc: Record<PositionLine, number> = { AVANTS: 0, DEMIS: 0, TROIS_QUARTS: 0 };
    for (const p of active) acc[POSITION_LINE[p.position]] += p.contract.annualSalary;
    return acc;
  }, [active]);

  const topEarners = useMemo(
    () => [...active].sort((a, b) => b.contract.annualSalary - a.contract.annualSalary).slice(0, 8),
    [active],
  );

  const maxFlow = Math.max(finances.seasonRevenue, finances.seasonExpenses, 1);
  const accent = readableAccent(clubIdentity(club.id as string).primary);

  return (
    <section className="finances-screen">
      {/* En-tête : la santé du club en un coup d'œil. */}
      <div className="fin-hero">
        <StadiumBackdrop className="fin-hero-bg" seed={club.id as string} accent={accent} intensity={0.35} />

        <div className="fin-hero-left">
          <ClubCrest clubId={club.id as string} initials={club.shortName} size={54} />
          <div>
            <h2 className="fin-club">{club.name}</h2>
            <div className="fin-club-meta">
              {club.city} · {club.stadiumCapacity.toLocaleString('fr-FR')} places · réputation {club.reputation}
            </div>
          </div>
        </div>

        <div className="fin-hero-balance">
          <span className="fin-balance-label">Trésorerie</span>
          <span className={`fin-balance-value ${finances.balance < 0 ? 'neg' : ''}`}>
            {formatEuros(finances.balance)}
          </span>
          <span className={`fin-projection ${projection < 0 ? 'neg' : projection > finances.balance ? 'pos' : ''}`}>
            Projection fin de saison : {formatEuros(projection)}
          </span>
        </div>

        {onBack && <button onClick={onBack} type="button" className="ph-back">← Retour</button>}
      </div>

      <div className="fin-grid">
        {/* Flux de la saison, comparés visuellement plutôt qu'alignés en colonnes. */}
        <div className="dashboard-panel fin-flows">
          <div className="panel-tag">Saison {currentSeason}-{(currentSeason + 1).toString().slice(-2)}</div>

          <div className="flow-row">
            <div className="flow-head">
              <span className="flow-label">Recettes</span>
              <span className="flow-value pos">{formatEuros(finances.seasonRevenue)}</span>
            </div>
            <div className="flow-track">
              <div className="flow-fill pos" style={{ width: `${(finances.seasonRevenue / maxFlow) * 100}%` }} />
            </div>
          </div>

          <div className="flow-row">
            <div className="flow-head">
              <span className="flow-label">Dépenses</span>
              <span className="flow-value neg">{formatEuros(finances.seasonExpenses)}</span>
            </div>
            <div className="flow-track">
              <div className="flow-fill neg" style={{ width: `${(finances.seasonExpenses / maxFlow) * 100}%` }} />
            </div>
          </div>

          <div className="flow-net">
            <span>Résultat net</span>
            <strong className={net >= 0 ? 'pos' : 'neg'}>{net >= 0 ? '+' : ''}{formatEuros(net)}</strong>
          </div>

          <p className="fin-note">
            {currentRound <= 1
              ? 'La saison n\'a pas commencé : rien à extrapoler pour l\'instant.'
              : `Rythme calculé sur ${currentRound - 1} journée${currentRound > 2 ? 's' : ''} jouée${currentRound > 2 ? 's' : ''}.`}
          </p>
        </div>

        {/* Masse salariale : le poste de dépense structurant. */}
        <div className="dashboard-panel fin-payroll">
          <div className="panel-tag">Masse salariale</div>

          <div className="payroll-top">
            <span className="payroll-total">{formatEuros(payroll)}</span>
            <span className="payroll-sub">
              {active.length} joueurs · {formatEuros(payroll / Math.max(1, active.length))} en moyenne
            </span>
          </div>

          <div className="payroll-split">
            {(Object.keys(byLine) as PositionLine[]).map(line => {
              const share = payroll > 0 ? (byLine[line] / payroll) * 100 : 0;
              return (
                <div key={line} className="payroll-line">
                  <span className="payroll-line-label">{LINE_LABEL[line]}</span>
                  <span className="payroll-line-track">
                    <span className={`payroll-line-fill line-${line.toLowerCase()}`} style={{ width: `${share}%` }} />
                  </span>
                  <span className="payroll-line-value">{Math.round(share)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Les plus gros salaires : ce sont eux qu'on vend ou qu'on prolonge. */}
        <div className="dashboard-panel fin-earners">
          <div className="panel-tag">Plus gros salaires</div>
          <table className="squad-table compact">
            <tbody>
              {topEarners.map(p => (
                <tr key={p.id}>
                  <td className="c-pos"><PositionBadge position={p.position} /></td>
                  <td className="c-name"><span className="sq-name">{p.firstName} {p.lastName}</span></td>
                  <td className="num">{currentSeason - Number(p.birthDate.slice(0, 4))} ans</td>
                  <td className="num">jusqu'en {p.contract.endSeason}</td>
                  <td className="num potential">{formatEuros(p.contract.annualSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Historique */}
        <div className="dashboard-panel fin-history">
          <div className="panel-tag">Bilans antérieurs</div>
          {finances.pastSeasons.length === 0 && (
            <p className="fin-note">Première saison : aucun bilan clôturé.</p>
          )}
          {finances.pastSeasons.length > 0 && (
            <table className="squad-table compact">
              <thead>
                <tr>
                  <th>Saison</th><th>Recettes</th><th>Dépenses</th><th>Résultat</th><th>Solde</th>
                </tr>
              </thead>
              <tbody>
                {[...finances.pastSeasons].reverse().map(s => {
                  const result = s.revenue - s.expenses;
                  return (
                    <tr key={s.seasonStart}>
                      <td className="num">{s.seasonStart}-{(s.seasonStart + 1).toString().slice(-2)}</td>
                      <td className="num pos">{formatEuros(s.revenue)}</td>
                      <td className="num neg">{formatEuros(s.expenses)}</td>
                      <td className={`num ${result >= 0 ? 'pos' : 'neg'}`}>
                        {result >= 0 ? '+' : ''}{formatEuros(result)}
                      </td>
                      <td className="num">{formatEuros(s.closingBalance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
