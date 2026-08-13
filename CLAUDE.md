# Conventions du projet

Ce fichier est lu au début de chaque session. Il fixe les règles de travail sur
Le Quinze. Il ne décrit pas le jeu (voir `docs/design/`) ni son état (voir
`docs/STATUS.md`) ni ce qui vient ensuite (voir `docs/ROADMAP.md`).

## Écriture

**Pas de tiret cadratin.** Ni dans le code, ni dans les commentaires, ni dans la
documentation, ni dans les messages de commit, ni dans les notes de release, ni
dans les réponses en conversation. Le caractère `—` est proscrit. À la place :
deux-points, virgules, parenthèses, ou deux phrases.

Le reste du style de commentaire ne change pas : on explique **pourquoi** une
chose existe et quel défaut elle corrige, pas ce que fait la ligne suivante.

Langue : français dans le code, les commentaires, la documentation et la
conversation. Anglais dans les messages de commit, les titres de pull request et
les notes de release.

## Workflow git

`main` est l'état publié. `dev` est la branche de travail. **Aucun commit direct
sur `main`.**

Pour chaque version :

1. Plusieurs petits commits sur `dev`, un par intention, message court en
   anglais, préfixé `feat:`, `fix:`, `test:`, `refactor:`, `perf:`, `chore:` ou
   `docs:`.
2. Avant de proposer la fusion, tout doit être vert : `npm run typecheck`,
   `npm run lint`, `npm run test`, `npm run build`, et `npm run calibrate` si le
   moteur de match a bougé.
3. Pull request `dev` vers `main`, titre et corps en anglais, décrivant ce que la
   version apporte et ce qu'elle corrige.
4. Fusion, puis tag annoté, puis release GitHub dont les notes reprennent la
   section correspondante du CHANGELOG, traduite en anglais.
5. `docs/CHANGELOG.md` et `docs/STATUS.md` sont mis à jour dans la version
   elle-même, pas après coup.

## Numérotation

Format `vMAJEUR.MINEUR.CORRECTIF`, tag préfixé `v`.

- **Une version de la roadmap égale un incrément mineur** : `v0.60.0`, puis
  `v0.61.0`. Chacune a un thème, comme depuis la V0.13.
- **Correctif** pour ce qui part après une release sans rien ajouter :
  `v0.60.1`. Un correctif ne fait pas l'objet d'une entrée de roadmap, mais il a
  sa pull request, son tag et sa release.
- **Majeur reste à 0** jusqu'à la sortie publique. `v1.0.0` est la mise en vente.
- Les jalons de la roadmap nommés `V0.9` (bêta privée) et `V1.0` (release)
  viennent du plan d'origine et ne sont pas des numéros de séquence : `v0.9.0`
  se classerait avant `v0.59.0`. La bêta privée sera taguée **`v0.90.0`**.

## Attribution

Les commits sont faits sous le compte `MrBartou`
(`anthony.denin@outlook.com`). **Aucune mention d'assistance par IA** nulle part :
ni `Co-Authored-By`, ni signature générée, ni référence dans les messages, les
pull requests ou les notes de release.

## Frontière moteur et interface

`src/engine/` est pur : pas de `Math.random`, pas de `new Date`, pas d'accès au
stockage, pas de React. Le hasard passe par `createRng(seed)`. Une règle ESLint
le vérifie.

Corollaire appris à ses dépens : aucune règle de jeu ne vit dans
`src/ui/App.tsx`. Ce qui décide d'un résultat appartient au moteur, où on peut
le tester.

## Vérification

Une fonctionnalité n'est pas finie parce qu'elle compile. Elle l'est quand elle
est **atteignable en jeu** et qu'on l'a vue fonctionner. Le défaut récurrent de
ce projet est le code écrit mais jamais branché : huit champs déclarés et lus
nulle part ont été trouvés entre la V0.50 et la V0.58.

Deux règles de mesure, apprises en se trompant :

- ne jamais affirmer un écart plus petit que le bruit de l'échantillon. Sur 400
  matchs, l'erreur type sur un taux de victoire est d'environ 2,5 points ;
- mesurer ce que le moteur produit avant de fixer un coefficient, plutôt que de
  supposer une valeur plausible.
