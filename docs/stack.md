# TypeScript

TypeScript a été choisi comme langage principal pour l'ensemble du projet. Contrairement à JavaScript, son typage statique permet de détecter un grand nombre d'erreurs dès la phase de développement, ce qui réduit considérablement les bugs en production. Le système de types avancé (generics, unions discriminées, types conditionnels) facilite également la maintenance et la refactorisation du code à mesure que le projet évolue.

## Frontend

### Next React + Tailwind CSS

React a été retenu pour sa maturité, son écosystème riche et sa communauté active. Le modèle de composants réutilisables et le Virtual DOM offrent à la fois une expérience utilisateur fluide et une base de code maintenable. Tailwind CSS accompagne React en fournissant un système de design cohérent via des classes utilitaires, évitant la maintenance de fichiers CSS fragmentés et permettant un prototypage rapide.

Bibliothèques supplémentaires :

- **React Icons** — Icônes légères et cohérentes, évite d'importer des assets images lourds.
- **shadcn/ui** — Composants accessibles et personnalisables, copiés directement dans le projet plutôt qu'ajoutés comme dépendance, ce qui évite le bloat et permet de modifier le code source si nécessaire.
- **next-themes** — Gestion fluide des thèmes clair/sombre avec persistence et transition sans flash au chargement.

## Backend

### Bun + Express

Express a été choisi pour sa stabilité, sa documentation exhaustive et sa vaste communauté. Il s'agit d'un framework minimaliste mais extensible, ce qui nous permet de n'ajouter que les fonctionnalités nécessaires sans surcharge inutile. L'exécution via Bun — déjà adopté comme environnement principal — offre des performances significativement supérieures à Node.js (démarrage plus rapide, meilleure gestion de la mémoire, compatibilité directe avec l'écosystème npm).

Bibliothèques supplémentaires :

- **bcryptjs** — Hachage des mots de passe côté serveur avec sel automatique ; implémentation JS pure, sans dépendances natives problématiques en CI.
- **jsonwebtoken** — Gestion des tokens JWT pour l'authentification sans état (stateless), évitant de maintenir des sessions en base.
- **redis** — Client officiel Redis ; utilisé pour la mise en cache, les sessions temporaires et la gestion des files d'attente.
- **pg** — Client PostgreSQL natif, performant et bien intégré à l'écosystème Node.js/Bun.

### SGDB

Lors de nos premères reflexions nous comptions partir sur une architecture de base de donnée normal avec des lives queries pour les données dynamiques tel que le chat.

> [!WARNING]
> Les lives queries ne supportent pas les relations entre les tables

```sql
let $user = user:kylian;
let $group = group:developpers;

let $message = CREATE ONLY message CONTENT {
    attachment: "image.png",
    content: "Bonjour à tous"
};
relate $user->user_sent_message->$message.id;

relate $group<-message_in_group<-$message.id;
```

Pour le creation d'un message tout ce passe comme il faut,
Lors de la phase de test nous avons donc voulue faire une requete pour récuperer les messages d'un groupe, et la nous avons recontrer un probleme, les lives queries ne supportent pas les relations entre les tables, nous avons donc du revoir notre architecture pour pouvoir faire du live query sur les messages d'un groupe.

```sql
let $user = user:kylian;
let $group = group:developpers;

#Ne fonctionne pas 
LIVE SELECT in FROM message_in_group where out == $group FETCH in;

#Ne Fanctionne pas non plus
LIVE SELECT in as message FROM $group<-message_in_group FETCH message;
```

#### Solution 2

Ce manque de fonctionnalité nous a donc obligé à revoir notre architecture, nous avons
donc décidé de partir sur une base de données differente, spacetimedb

#### spacetimedb

Lors de notre deuxieme phase de recherche nous avons donc essayé de repartir sur un prototype avec spacetime db

Spacetimedb est un framework de base de données très performmant favorisant les applications en temps réels,
Le probleme que nous avons recontrer lors de l'utilisation est le fait que la base de donnée par son coté très accès
query en temps réel, la base de données travail principalement avec des reducers, et malheusement rend la syntax des queries sql habituels plus verbeuse

```ts
import { schema, table, t } from 'spacetimedb/server';

// Definit le schema de la table person
const spacetimedb = schema({
  person: table(
    { public: true },
    {
      name: t.string(),
    }
  ),
});
export default spacetimedb;

//créer le reducer permettant de creer des person
export const add = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    ctx.db.person.insert({ name });
  }
);

//fonction qui permet d'appeler le reducer qui fait Hello {person}
export const sayHello = spacetimedb.reducer(ctx => {
  for (const person of ctx.db.person.iter()) {
    console.info(`Hello, ${person.name}!`);
  }
  console.info('Hello, World!');
});
```

Par rapport au commandes sql basiques c'est la ou la syntax devient moins pratique,
notament empeches les outils de gestion de base de données de se connecter

```bash
# Call the add reducer to insert a person
spacetime call add Alice

# Query the person table
spacetime sql "SELECT * FROM person"
 name
---------
 "Alice"
```

De plus après le succès de nos test avec cette outils nous avons eu des problème d'authorisation en environement local.
Tout ces problèmes n'étaient malheusement pas documenté en ligne ce qui nous a confortrer a choisir une solution bien plus classique et stable, Redis et Postgres

### Tests

Bun intègre nativement un moteur de test compatible avec Jest, ce qui nous permet d'écrire et d'exécuter les tests sans dépendance externe. Cette approche offre plusieurs avantages : pas de configuration supplémentaire (pas de `jest.config.js` à maintenir), exécution significativement plus rapide que Jest sous Node.js, et compatibilité avec la syntaxe et les assertions Jest (describe, it, expect, mocks, etc.).

### Lint

Biome a été retenu pour le linting et le formatage du code. Contrairement à la pile classique ESLint + Prettier, Biome regroupe les deux fonctionnalités en un seul outil, ce qui simplifie la configuration et supprime les conflits de règles entre les deux. Ses principaux atouts :

### Docker

Docker est utilisé pour standardiser l'environnement d'exécution à travers toutes les phases du projet (développement, tests, production). Chaque service de l'application est conteneurisé indépendamment :

- **Conteneur API** — l'application Bun/Express exposée sur son port.
- **Conteneur PostgreSQL** — base de données relationnelle.
- **Conteneur Redis** — cache et file d'attente.

L'ensemble est orchestré via Docker Compose, permettant de lancer l'intégralité de la stack locale avec une seule commande. Cette approche garantit une parfaite reproductibilité des environnements et élimine les problèmes de « ça marche en local ».

### Render

Render a été sélectionné comme plateforme de déploiement pour sa simplicité de configuration et son modèle de tarification prévisible. Il offre :

- **Déploiements automatiques** — déclenchés à chaque push sur la branche principale, via l'intégration GitHub.
- **Support Docker natif** — les conteneurs définis dans le Dockerfile sont déployés directement, sans configuration supplémentaire.
- **SSL/TLS automatique** — certificats HTTPS renouvelés automatiquement.
- **Base de données managée** — PostgreSQL et Redis sont disponibles en tant que services managés, ce qui évite d'avoir à les administrer nous-mêmes.
