/**
 * Négociation de contrat — V0.43.
 *
 * L'écran doit rendre lisible le seul mécanisme qui compte : **chaque demande
 * se paie**. On affiche donc en permanence ce que le président consent, et ce
 * que chaque terme coûte ou rapporte au manager — sans quoi le joueur cocherait
 * le maximum partout et découvrirait le refus sans comprendre pourquoi.
 */

import { useState } from 'react';
import {
  BUDGET_DEMAND_LABEL,
  DURATION_OPTIONS,
  MODEST_DEMANDS,
  SALARY_TIER_LABEL,
  negotiate,
  patienceFor,
  salaryFor,
  transferBudgetFor,
  type BudgetDemand,
  type Demands,
  type SalaryTier,
} from '../../engine/season/contract-negotiation.js';
import { objectiveWithSalary } from '../../engine/season/contract-negotiation.js';
import type { JobOffer } from '../../engine/season/manager-career.js';
import type { ManagerReputation } from '../../engine/season/manager-reputation.js';
import type { Club } from '../../engine/types.js';
import { ClubCrest } from './ClubCrest.js';

interface Props {
  readonly offer: JobOffer;
  readonly club: Club;
  readonly reputation: ManagerReputation;
  readonly clubShortName: string;
  readonly onSign: (demands: Demands) => void;
  readonly onCancel: () => void;
}

const SALARY_TIERS: readonly SalaryTier[] = ['MODESTE', 'STANDARD', 'ELEVE'];
const BUDGET_DEMANDS: readonly BudgetDemand[] = ['AUCUNE', 'RAISONNABLE', 'AMBITIEUSE'];

function euros(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M€` : `${Math.round(n / 1_000)} k€`;
}

export function NegotiationModal({
  offer, club, reputation, clubShortName, onSign, onCancel,
}: Props) {
  const [demands, setDemands] = useState<Demands>(MODEST_DEMANDS);
  const outcome = negotiate(club, reputation, demands);

  const salary = salaryFor(club, demands.salary);
  const budget = transferBudgetFor(club, demands.budget);
  const patience = patienceFor(demands.seasons, demands.salary);
  const objective = objectiveWithSalary(offer.objective, demands.salary);

  return (
    <div className="modal-backdrop offers-backdrop" role="dialog" aria-modal="true">
      <div className="modal negotiation-modal">
        <div className="modal-header">
          <span className="modal-tag">Négociation</span>
          <h3>
            <ClubCrest clubId={club.id as string} initials={clubShortName} size={28} />
            {club.name}
          </h3>
          <p className="modal-context">{offer.pitch}</p>
        </div>

        <div className="nego-terms">
          <Term
            label="Durée du contrat"
            hint="Un bail long achète de la patience au bureau."
            options={DURATION_OPTIONS.map(n => ({
              key: String(n),
              label: `${n} saison${n > 1 ? 's' : ''}`,
              active: demands.seasons === n,
              onPick: () => setDemands(d => ({ ...d, seasons: n })),
            }))}
          />
          <Term
            label="Salaire"
            hint="Se payer cher durcit la mission et raccourcit le sursis."
            options={SALARY_TIERS.map(t => ({
              key: t,
              label: SALARY_TIER_LABEL[t],
              active: demands.salary === t,
              onPick: () => setDemands(d => ({ ...d, salary: t })),
            }))}
          />
          <Term
            label="Enveloppe de transfert"
            hint="Ce qui part au mercato ne va pas dans votre poche."
            options={BUDGET_DEMANDS.map(b => ({
              key: b,
              label: BUDGET_DEMAND_LABEL[b],
              active: demands.budget === b,
              onPick: () => setDemands(d => ({ ...d, budget: b })),
            }))}
          />
        </div>

        {/* Ce que ces termes donnent concrètement : sans ce récapitulatif, les
            paliers resteraient des mots et la contrepartie serait invisible. */}
        <ul className="nego-summary">
          <li><span>Salaire annuel</span><strong>{euros(salary)}</strong></li>
          <li><span>Renfort promis</span><strong>{budget > 0 ? euros(budget) : '—'}</strong></li>
          <li>
            <span>Saisons d'échec tolérées</span>
            <strong>{patience}</strong>
          </li>
          <li>
            <span>Mission fixée</span>
            <strong className={objective.kind !== offer.objective.kind ? 'nego-harder' : ''}>
              {objective.label}
            </strong>
          </li>
        </ul>

        <p className={`nego-reaction ${outcome.accepted ? 'ok' : 'ko'}`}>
          {outcome.reaction}
        </p>

        <div className="modal-footer nego-footer">
          <button type="button" className="modal-skip" onClick={onCancel}>
            Revenir aux offres
          </button>
          {/* Un refus n'est pas une impasse : le président revient avec ce qu'il
              consent, et l'accepter est à un clic. */}
          {!outcome.accepted && outcome.counter && (
            <button
              type="button"
              className="secondary"
              onClick={() => setDemands(outcome.counter!)}
            >
              Accepter sa contre-proposition
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={!outcome.accepted}
            onClick={() => onSign(demands)}
          >
            Signer
          </button>
        </div>
      </div>
    </div>
  );
}

function Term({
  label, hint, options,
}: {
  readonly label: string;
  readonly hint: string;
  readonly options: readonly {
    readonly key: string;
    readonly label: string;
    readonly active: boolean;
    readonly onPick: () => void;
  }[];
}) {
  return (
    <div className="nego-term">
      <div className="nego-term-head">
        <span className="nego-term-label">{label}</span>
        <span className="nego-term-hint">{hint}</span>
      </div>
      <div className="nego-choices">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            className={`nego-choice ${o.active ? 'active' : ''}`}
            aria-pressed={o.active}
            onClick={o.onPick}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
