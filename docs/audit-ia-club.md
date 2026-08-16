# Audit : ce qu'un club géré par la machine décide, et ce qu'il ne décide pas

> Écrit le 2026-08-16, sur le code de la V0.65. Il répond à une question posée
> après la livraison : « les autres clubs, s'ils ne changent jamais ni rien, ça
> va pas le faire ».
>
> Ce document ne tranche rien. Il établit l'existant, fichier par fichier, pour
> que le découpage en versions se décide sur pièces et non sur une impression.

## Résumé

Le monde déplace ses **joueurs** et fige ses **clubs**. Le vieillissement, les
retraites, la formation, le mercato et les finances tournent pour les trente
clubs. Mais un club, en tant qu'institution, n'a ni mémoire, ni ambition, ni
évolution : son budget, sa réputation, son stade et sa façon de jouer sont ceux
du fichier de données, et le resteront vingt saisons plus tard.

Et pendant un match, un club géré par la machine ne fait rien du tout.

## 1. Ce qui décide pour un club adverse aujourd'hui

| Domaine | Qui décide | Où | Comment |
|---|---|---|---|
| Composition | `pickStartingFifteen` | `data/seed.ts:571` | Les quinze meilleurs disponibles, poste par poste. Aucune rotation, aucun ménagement, aucune politique de jeunes. |
| Plan de match | `planForIdentity` | `match/tactics.ts:179` | Un `switch` sur quatre identités de club, quatre plans figés. |
| Remplacements | personne | | Voir section 2. |
| Mercato | `runAiMarket` | `club/ai-market.ts` | Vraie procédure de décision : marge budgétaire, plafond salarial, besoins par poste, profondeur, urgence, ordre d'achat. Tirage à graine (`ai_market_${seed}_${saison}_${fenêtre}`). |
| Renouvellements | `replenishSquad` | `club/ai-market.ts` | Dégraissage au-dessus du plafond, recomplètement de l'effectif. |
| Formation | `generateYouthIntake` | `club/youth-generation.ts` | Promotion de jeunes pour tous les clubs depuis la V0.60. |
| Vieillissement, retraites | `rolloverSeason` | `season/rollover.ts:88` | Pour tous les joueurs du jeu. |
| Finances | `recordRoundFinances` | `game/season-session.ts` | Salaires par journée, billetterie, sponsors, pour chaque club. |
| Commission (DNCG) | `reviewSeason` | `club/regulations.ts:384` | Boucle sur tous les clubs. |
| Entraîneur | `reviewRivalSeason`, `sackRival` | `season/rival-managers.ts:215` | Sa réputation monte ou descend selon l'écart au rang attendu ; il peut être limogé. |

Autrement dit : le mercato et la démographie sont de vrais systèmes ; le match
et l'institution ne le sont pas.

## 2. Le trou le plus visible : l'adversaire ne se remplace jamais

`substitute()` n'est appelé que depuis l'interface, et par l'effet d'un live
moment (`match/session.ts:886`). Or les live moments ne sont produits que pour
le camp du manager, et la simulation automatique prend systématiquement l'option
par défaut (`match/simulate.ts`). Le seul moment qui propose un remplacement,
« le cadre accuse le coup », a pour défaut `keep` (`match/live-moments.ts:229`).

Conséquence, vérifiable en jeu : **tout adversaire termine ses matchs avec ses
quinze titulaires**, fatigue comprise, pendant que le manager dispose de huit
remplacements. Ce n'est pas un déséquilibre théorique : la fatigue pèse sur
chaque sous-système du moteur depuis la V0.13.

## 3. Ce qui ne bouge jamais

| Attribut | État | Preuve |
|---|---|---|
| `tacticalIdentity` | figée à la création | jamais réassignée hors promotion/relégation |
| `annualBudget` | figé | idem |
| `reputation` du club | figée | seule celle des entraîneurs évolue (`rival-managers.ts:232`) |
| `stadiumCapacity` | figée | jamais agrandie |
| Installations, centre de formation, politique commerciale | réservés au club dirigé | `facilitiesRef`, `clubPlanRef`, `academyRef` sont des références uniques dans `App.tsx` |
| Prêts, joker médical, marché international | réservés au club dirigé | ces trois modules ne connaissent que `playerClubId` |
| Style de l'entraîneur | déclaré, sauvegardé, **jamais lu** | `season/rival-managers.ts:47`, mort depuis la V0.53 |
| Club promu ou relégué | valeurs codées en dur : 14 M€, 12 000 places, réputation 40 | `season/relegation.ts:98` |

Ce dernier point mérite d'être lu deux fois : quel que soit le club qui monte,
son histoire, son stade réel et ses finances, il reçoit les mêmes trois nombres.

## 4. Ce qui manque pour qu'un club vive

Six briques, de la plus structurante à la plus cosmétique.

1. **Une mémoire d'institution.** Un état par club, de quelques champs :
   ambition, politique de recrutement, investissement en formation, patience du
   bureau. Aujourd'hui il n'existe rien de tel, donc rien à faire évoluer.
2. **Une identité qui dérive.** Elle devrait suivre l'entraîneur en poste, ce
   qui donnerait enfin un effet au champ `style`, et l'effectif disponible. Un
   club qui change de coach doit changer de façon de jouer, sur une saison ou
   deux, pas du jour au lendemain.
3. **Une économie qui suit les résultats.** Monter, gagner, remplir son stade
   fait grossir un club ; descendre l'appauvrit. Cela remplacerait les trois
   constantes servies à tout promu.
4. **Une stratégie de recrutement par club.** Le mercato IA applique la même
   procédure aux vingt-neuf. Un formateur devrait promouvoir, un dépensier
   acheter, un pragmatique boucher ses trous.
5. **Un banc utilisé.** Une règle de remplacement pour les camps non dirigés,
   sur la fatigue et le score, avec la même limite de huit que le manager.
6. **Un curseur de compétence unique.** Toutes ces décisions passeraient par un
   `coachSkill` de 0 à 1, dérivé de la réputation et du style de l'entraîneur,
   multiplié par un réglage global. C'est ce curseur que la V0.79 brancherait
   sur ses presets de difficulté, au lieu de réinventer une plomberie.

## 5. Contraintes à respecter

- **Moteur pur.** Pas de `Math.random`, pas de `new Date` : une règle ESLint
  casse le build. Toute décision passe par `createRng(graine)`.
- **Déterminisme.** Même graine, même saison : c'est ce qui rend la calibration
  et les tests possibles. Une IA qui apprendrait en cours de partie devrait
  sauvegarder ce qu'elle a appris, sans quoi un rechargement la rendrait amnésique,
  défaut que ce projet a déjà payé trois fois.
- **Pas de triche.** L'adversaire doit décider avec les informations qu'un
  manager aurait. Un club IA qui lirait la vraie valeur d'un joueur là où le
  scouting impose un brouillard rendrait le scouting décoratif.
- **Point neutre.** Le banc utilisé par les clubs IA **changera** les résultats
  de la calibration : c'est le premier chantier depuis longtemps qui ne peut pas
  être neutre par construction. Il faudra rejouer les douze cibles et, si elles
  sortent, décider si l'on recalibre ou si l'on corrige la règle.
- **Taille de sauvegarde.** Trente clubs multipliés par un état d'institution,
  c'est peu ; trente clubs multipliés par un historique de décisions, c'est
  beaucoup. La V0.63 a tranché ce genre d'arbitrage en persistant une identité
  et une graine plutôt que des effectifs entiers.

## 6. Découpages possibles

Trois options, sans recommandation ici.

**A. La V0.66 devient l'IA de club.** Elle porte déjà l'entraîneur adverse, qui
est celui qui décide pour le club : briques 1 à 6. Les conférences de presse
partiraient en V0.74 et les contrats de staff en V0.75, pour tenir la taille.

**B. On scinde en deux versions.** V0.66 « les clubs vivent » (briques 1, 2, 3,
5), V0.67 « le duel d'entraîneurs » (briques 4 et 6, plus l'ajustement de plan en
match et la mémoire tactique). Tout ce qui suit décale d'un cran, ce que le
projet a déjà payé une fois.

**C. On traite d'abord le banc seul.** La brique 5 est petite, isolée, et corrige
un déséquilibre net. Elle pourrait sortir en correctif de la V0.65 avant qu'on
décide du reste.

## 7. Ce que cet audit ne dit pas

Il n'évalue pas la **qualité** des décisions du mercato IA : personne n'a mesuré
si les clubs gérés par la machine construisent des effectifs cohérents sur dix
saisons, ni si le championnat conserve une hiérarchie crédible. C'est un travail
de mesure, pas de lecture de code, et il faudra le faire avant de régler quoi
que ce soit.
