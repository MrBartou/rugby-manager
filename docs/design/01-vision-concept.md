# 1. Vision et concept

> Statut : ✅ Validée

## Pitch en une phrase

Un rugby manager qui prend enfin au sérieux la tactique du sport et la vie du vestiaire.

## Public cible

Les deux : passionnés hardcore **et** casual.

## Les 5 piliers de différenciation

### Pilier 1 — Un moteur de match qui modélise vraiment le rugby

Le rugby a des spécificités structurelles (conquête mêlée + touche, phases de jeu, occupation par le pied) que personne ne simule sérieusement.

- **Vs Pro Rugby Manager 2015** : on modélise les phases de conquête comme des sous-systèmes à part entière, pas comme des cinématiques décoratives. La mêlée est un duel technique, pas un coin flip.
- **Vs FM** : moteur pensé rugby dès le premier jour, pas adapté d'un autre sport. Le jeu au pied, la conquête, les rucks ne sont pas des "events spéciaux", c'est la trame du match.
- **Vs Rugby Manager mobile** : le résultat n'est pas pré-déterminé par la rareté des cartes. Les décisions tactiques pèsent réellement.

### Pilier 2 — Le vestiaire comme mécanique de gameplay, pas comme sous-menu

FM a des "interactions joueur" mais elles tournent en boucle après 6 mois. On va plus loin : le vestiaire est un système vivant qui influence les performances.

- Hiérarchie de leaders qui évolue (capitaine, leader d'attaque, leader défensif, anciens, jeunes ambitieux)
- Cohésion qui se construit ou se brise sur des décisions concrètes (recrutements clivants, gestion des stars, transmissions générationnelles)
- Influence des cadres sur les jeunes mesurable et visible

**Vs PRM 2015 et Rugby Manager mobile** : ils n'ont littéralement rien sur ce volet. **Marché vide.**
**Vs FM** : on remplace un système de dialogues scriptés par un système qui ressemble à un vrai groupe humain.

### Pilier 3 — Profondeur progressive : profond comme FM, accessible comme un bon livre

L'interface et la courbe d'apprentissage sont pensées pour qu'un fan de rugby qui n'a jamais joué à FM s'amuse en 2 heures, mais que la maîtrise prenne des mois.

- Visualisation de l'information avant tableaux Excel
- Couches de complexité optionnelles (déléguer à son staff ce qu'on ne veut pas gérer)
- Tutoriel intégré qui ne traite pas le joueur comme un débile

**Vs FM** : on refuse la dette UI accumulée en 25 ans de patchs successifs.
**Vs Rugby Manager mobile** : on ne sacrifie pas la profondeur sur l'autel de l'accessibilité.

### Pilier 4 — Identité française et Top 14 au cœur du jeu

Pas un détail cosmétique : les règles spécifiques du rugby français (JIFF, salary cap, formation, ancrage régional) sont des **mécaniques de jeu**.

- Système JIFF qui structure activement le recrutement et les choix
- Centre de formation comme institution centrale du club, pas comme simple stat
- Identité régionale qui pèse (un ailier toulousain n'est pas le même profil qu'un ailier rochelais ; recruter à contre-culture du club a un coût humain)

**Vs FM** : on offre ce que les anglos n'ont jamais fait — un Top 14 vivant, pas une ligue exotique de plus.
**Vs PRM 2015** : on va plus loin que la simple licence sur les noms.

### Pilier 5 — Modèle économique premium, sain, sans mécanique prédatrice

Achat unique, pas de loot box, pas de monnaie premium, pas de pay-to-win. **Le jeu se joue, il ne s'exploite pas.**

**Vs Rugby Manager mobile** : opposition frontale au F2P prédateur, argument marketing fort auprès des fans dégoûtés.
**Vs FM** : alignement (FM est premium aussi), signal qui rassure les fans de rugby.

## Mécaniques empruntées (synthèse)

| # | Mécanique | Source | Pilier |
|---|-----------|--------|--------|
| M1 | Live decision moments (5-15 par match) | Motorsport Manager | 1 |
| M2 | Visualisation 2D stylisée du match | Motorsport Manager + Total War | 1 |
| M3 | Attributs cachés + scouting progressif | Football Manager | 1 |
| M4 | Stats rugby avancées (mètres, dominance, JIFF) | OOTP + FM | 1 |
| M5 | Système de traits combinés | Crusader Kings 3 | 2 |
| M6 | Graphe de relations évolutif | CK3 + RimWorld | 2 |
| M7 | Stress comme ressource | CK3 | 2 |
| M8 | Mood/humeur calculée en continu | RimWorld | 2 |
| M9 | Compatibilités/incompatibilités personnages | RimWorld | 2 |
| M10 | Approfondissement relations par interactions | Hades | 2 |
| M11 | Décisions sans bonne réponse + conséquences long-terme | Frostpunk | 2 |
| M12 | Staff comme voix/personnalités, pas info neutres | Disco Elysium + Total War: TK | 2, 3 |
| M13 | Profondeur progressive UI | Motorsport Manager | 3 |
| M14 | Architecture moddable / fichiers de données | Football Manager | 4 |
| M15 | Records et dynasties multi-décennies | OOTP | 4 |

**Lecture rapide** : 4 mécaniques pour le pilier 1, 8 pour le pilier 2, 2 pour le pilier 3, 2 pour le pilier 4. Cohérent avec le positionnement — le pilier 2 est le plus différenciant.

## Pourquoi le joueur revient le lendemain ?

**La réponse choisie :** le joueur revient parce qu'il a *deux* fils ouverts qu'il veut tirer — le match qui arrive (Moteur A), et l'histoire humaine en cours (Moteur B).

L'un est ponctuel et programmé (le rendez-vous), l'autre est continu et émergent (le récit). Les deux se nourrissent : ce qui se passe humainement influence le match, et le match crée les événements qui font évoluer l'humain.

Aucun concurrent direct n'offre cette combinaison :
- Pro Rugby Manager 2015 : Moteur A faible, B inexistant, C plat
- National Rugby Manager 2018 : Moteur A correct, B inexistant, C moyen
- Rugby Manager mobile : aucun des trois
- Football Manager : Moteur A excellent, B faible (système creux), C bon mais procédural

**Notre projet : Moteur A solide + Moteur B fort, qui se renforcent mutuellement.**

## La phrase à retenir

> On ne fait pas un jeu où le joueur revient pour les chiffres qui montent. On fait un jeu où il revient pour savoir *ce qui va arriver* — au match, à ses joueurs, à son club. Et on s'assure qu'il y a toujours quelque chose qui va arriver.

## Décisions stratégiques découlant de cette vision

- **Ne pas viser un PRM-like riche en fonctionnalités survolées** — viser un MVP plus étroit mais profond sur les piliers (match + vestiaire)
- **Ne pas se ruiner en licences en v1** — Top 14 / Pro D2 ont des marques protégées, mais des solutions communautaires (mods de noms réels) à la FM ont prouvé leur efficacité. Licence officielle à viser pour v2 si succès.
- **Investir lourd en UI / UX** — c'est un avantage compétitif évident, et c'est ce qui sépare un produit pro d'un produit indépendant
- **Communiquer fort sur le modèle premium** — argument vendeur direct face au mobile gacha et aux fans déçus
- **Étudier Motorsport Manager comme benchmark de feeling**, FM comme benchmark de profondeur, et NRM 2018 comme cartographie du sol qu'on prend
