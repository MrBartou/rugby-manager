/**
 * Direction du club — V0.45.
 *
 * L'écran doit rendre visible ce qui, jusqu'ici, n'existait pas : une
 * **destination pour l'argent**. La trésorerie s'accumulait sans usage — 116 M€
 * observés sur une partie — faute du moindre chantier à lancer.
 *
 * ## Trois blocs, trois horizons
 *
 *  - les **chantiers** engagent des saisons : on n'en mène qu'un à la fois ;
 *  - les **réglages** commerciaux se rejouent chaque année et produisent leur
 *    effet immédiatement ;
 *  - la **projection** dit ce que tout cela rapporte, sans quoi on choisirait à
 *    l'aveugle.
 */

import {
  MARKETING_LABEL,
  MARKETING_PLAN,
  MAX_LEVEL,
  PROJECT_EFFECT,
  PROJECT_LABEL,
  TICKET_LABEL,
  TICKET_POLICY,
  canLaunch,
  commercialCost,
  homeAdvantageBonus,
  levelOf,
  matchdayRevenue,
  merchandisingRevenue,
  projectCost,
  projectDuration,
  sponsorRevenue,
  stadiumCapacityFor,
  type ClubFacilities,
  type ClubPlan,
  type MarketingLevel,
  type OngoingProject,
  type ProjectKind,
  type TicketPolicy,
} from '../../engine/club/club-management.js';
import type { Club } from '../../engine/types.js';

interface Props {
  readonly club: Club;
  readonly facilities: ClubFacilities;
  readonly ongoing: OngoingProject | undefined;
  readonly plan: ClubPlan;
  readonly balance: number;
  readonly winsRatio: number;
  readonly currentSeason: number;
  readonly onSetPlan: (plan: ClubPlan) => void;
  readonly onLaunch: (kind: ProjectKind) => void;
  readonly onBack: () => void;
}

const PROJECTS: readonly ProjectKind[] = [
  'STADE', 'CENTRE_ENTRAINEMENT', 'CENTRE_MEDICAL', 'BOUTIQUE',
];

function millions(n: number): string {
  return `${(n / 1_000_000).toFixed(2)} M€`;
}

export function ClubDirectionScreen({
  club, facilities, ongoing, plan, balance, winsRatio, currentSeason,
  onSetPlan, onLaunch, onBack,
}: Props) {
  const matchday = matchdayRevenue({ club, facilities, plan, winsRatio });
  const merch = merchandisingRevenue({ club, facilities, plan, winsRatio });
  const sponsors = sponsorRevenue(club, plan);
  const marketing = commercialCost(plan);

  // 13 matchs à domicile sur une saison régulière de 26 journées.
  const seasonMatchday = matchday.revenue * 13;
  const netCommercial = seasonMatchday + merch + sponsors - marketing;

  return (
    <section className="screen direction-screen">
      <div className="screen-head">
        <h2>Direction du club</h2>
        <span className="screen-head-meta">
          {stadiumCapacityFor(club, facilities).toLocaleString('fr-FR')} places · trésorerie {millions(balance)}
        </span>
        <button type="button" className="modal-skip" onClick={onBack}>← Retour</button>
      </div>

      {/* ---- Projection ------------------------------------------------- */}
      <div className="dashboard-panel">
        <div className="panel-tag">Projection sur la saison</div>
        <ul className="dir-projection">
          <li>
            <span>Billetterie (13 matchs)</span>
            <strong>{millions(seasonMatchday)}</strong>
            <em>{matchday.attendance.toLocaleString('fr-FR')} spectateurs · {Math.round(matchday.fillRate * 100)} % de remplissage</em>
          </li>
          <li>
            <span>Sponsors et droits TV</span>
            <strong>{millions(sponsors)}</strong>
            <em>majorés par la campagne</em>
          </li>
          <li>
            <span>Boutique et merchandising</span>
            <strong>{millions(merch)}</strong>
            <em>dépend des résultats et de la boutique</em>
          </li>
          <li className="dir-cost">
            <span>Coût des campagnes</span>
            <strong>−{millions(marketing)}</strong>
            <em>&nbsp;</em>
          </li>
          <li className="dir-total">
            <span>Produit commercial net</span>
            <strong>{millions(netCommercial)}</strong>
            <em>hors salaires et transferts</em>
          </li>
        </ul>
      </div>

      {/* ---- Réglages ---------------------------------------------------- */}
      <div className="dashboard-panel">
        <div className="panel-tag">Politique commerciale</div>

        <div className="prep-row">
          <div className="prep-label">Prix des places</div>
          <div className="seg-btn">
            {(Object.keys(TICKET_LABEL) as TicketPolicy[]).map(t => (
              <button
                key={t}
                type="button"
                className={t === plan.ticket ? 'active' : ''}
                onClick={() => onSetPlan({ ...plan, ticket: t })}
              >
                {TICKET_LABEL[t]}
              </button>
            ))}
          </div>
          {/* Le compromis doit se lire : remplir ou encaisser. */}
          <div className="prep-hint">
            {TICKET_POLICY[plan.ticket].price} € la place ·{' '}
            {TICKET_POLICY[plan.ticket].fillDelta > 0
              ? `+${Math.round(TICKET_POLICY[plan.ticket].fillDelta * 100)} % de remplissage`
              : TICKET_POLICY[plan.ticket].fillDelta < 0
                ? `${Math.round(TICKET_POLICY[plan.ticket].fillDelta * 100)} % de remplissage`
                : 'remplissage de référence'}
            {' — une enceinte pleine vaut '}
            {homeAdvantageBonus(matchday.fillRate) >= 0 ? '+' : ''}
            {homeAdvantageBonus(matchday.fillRate)}
            {' de discipline tactique à domicile.'}
          </div>
        </div>

        <div className="prep-row">
          <div className="prep-label">Campagne marketing</div>
          <div className="seg-btn">
            {(Object.keys(MARKETING_LABEL) as MarketingLevel[]).map(m => (
              <button
                key={m}
                type="button"
                className={m === plan.marketing ? 'active' : ''}
                onClick={() => onSetPlan({ ...plan, marketing: m })}
              >
                {MARKETING_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="prep-hint">
            {MARKETING_PLAN[plan.marketing].cost > 0
              ? `${Math.round(MARKETING_PLAN[plan.marketing].cost / 1000)} k€ par saison`
              : 'Aucune dépense — mais la marque s\'efface'}
            {' · sponsors '}{Math.round(MARKETING_PLAN[plan.marketing].sponsorBonus * 100)} %
            {', boutique +'}{Math.round(MARKETING_PLAN[plan.marketing].merchBonus * 100)} %
          </div>
        </div>
      </div>

      {/* ---- Chantiers --------------------------------------------------- */}
      <div className="dashboard-panel">
        <div className="panel-tag">Chantiers</div>

        {ongoing && (
          <div className="dir-ongoing">
            <span className="do-name">{PROJECT_LABEL[ongoing.kind]} — niveau {ongoing.targetLevel}</span>
            <span className="do-eta">
              livraison à l'intersaison {ongoing.readyAtSeason}
            </span>
            <span className="do-cost">{millions(ongoing.totalCost)} engagés</span>
          </div>
        )}

        <ul className="dir-projects">
          {PROJECTS.map(kind => {
            const level = levelOf(facilities, kind);
            const target = level + 1;
            const check = canLaunch({ facilities, ongoing, kind, balance });
            const cost = projectCost(kind, target);

            return (
              <li key={kind} className="dir-project">
                <div className="dp-head">
                  <span className="dp-name">{PROJECT_LABEL[kind]}</span>
                  <span className="dp-level">
                    {/* Une jauge dit le chemin parcouru mieux qu'un nombre. */}
                    {Array.from({ length: MAX_LEVEL }, (_, i) => (
                      <span key={i} className={`dp-pip ${i < level ? 'on' : ''}`} />
                    ))}
                  </span>
                </div>
                <p className="dp-effect">{PROJECT_EFFECT[kind]}</p>
                <div className="dp-foot">
                  <span className="dp-cost">
                    {level >= MAX_LEVEL
                      ? 'Niveau maximum'
                      : `${millions(cost)} · ${projectDuration(kind)} saison${projectDuration(kind) > 1 ? 's' : ''}`}
                  </span>
                  <button
                    type="button"
                    className="primary dp-launch"
                    disabled={!check.allowed}
                    title={check.reason}
                    onClick={() => onLaunch(kind)}
                  >
                    Lancer
                  </button>
                </div>
                {!check.allowed && check.reason && (
                  <p className="dp-blocked">{check.reason}</p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="academy-note">
          Un chantier lancé cette saison est livré à l'intersaison {currentSeason + 1} au plus tôt.
          Un seul à la fois : il faut choisir ce qu'on bâtit en premier.
        </p>
      </div>
    </section>
  );
}
