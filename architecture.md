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

## Solution

Ce manque de fonctionnalité nous a donc obligé à revoir notre architecture, nous avons
donc décidé de partir sur une base de données differente, spacetimedb
