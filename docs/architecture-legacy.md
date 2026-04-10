# Architecture

Lors de nos premères reflexions nous comptions partir sur une architecture de base de donnée normal
avec des lives queries pour les données dynamiques tel que le chat.

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

## Solution 2

Ce manque de fonctionnalité nous a donc obligé à revoir notre architecture, nous avons
donc décidé de partir sur une base de données differente, spacetimedb

## spacetimedb

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
