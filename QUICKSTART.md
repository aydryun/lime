# Guide de Démarrage Rapide

## Prérequis

- Bun 1.0+ (environnement d'exécution JavaScript - installez depuis <https://bun.sh>)
- PostgreSQL 12+
- Redis 6+

## Configuration en 5 Minutes

### 1. Démarrer PostgreSQL et Redis (via Docker via Docker compose)

```bash
# Lancer 
docker compose up
```

### 2. Installer les Dépendances du Backend

```bash
cd chat-backend
bun install
```

### 3. Configurer l'Environnement (Optionnel)

Les valeurs par défaut devraient fonctionner si PostgreSQL et Redis sont exécutés localement :

```bash
# Vérifiez les valeurs par défaut de chat-backend/.env - elles sont déjà configurées
cat chat-backend/.env.example
```

### 4. Démarrer le Serveur Backend

```bash
# Depuis chat-backend/
bun run dev
```

Sortie attendue :

```
✓ Schéma de la base de données initialisé
✓ Connecté à Redis
🚀 Serveur en cours d'exécution sur http://localhost:3000
📡 WebSocket disponible sur ws://localhost:3000/ws
```

### 5. Démarrer le Frontend (dans un nouveau terminal)

```bash
cd chat-client
bun install
bun run index.ts
```

Sortie attendue :

```
🌐 Ouvre ton navigateur sur http://localhost:8080
```

### 6. Ouvrir le Navigateur

Visitez `http://localhost:8080` dans votre navigateur

## Architecture en un Coup d'Œil

```
┌─────────────────────────────────────────────────┐
│           Client Navigateur                     │
│  (JavaScript, WebSocket)                        │
└──────────────────┬──────────────────────────────┘
                   │
                   │ WebSocket
                   ↓
┌──────────────────────────────────────┐
│   Serveur Express (Port 3000)        │
│  - API HTTP (/api/messages)          │
│  - Gestionnaire WebSocket (/ws)      │
└───┬──────────────────────────┬───────┘
    │                          │
    │                          │
    ↓                          ↓
┌────────────────┐      ┌─────────────┐
│  PostgreSQL    │      │   Redis     │
│  (Persistant)  │      │ (Temps réel)│
└────────────────┘      └─────────────┘
```

## Tests

### Test 1 : Clients Multiples

1. Ouvrez `http://localhost:8080` dans deux fenêtres de navigateur
2. Entrez des noms différents (par exemple, "Alice", "Bob")
3. Envoyez des messages depuis chaque fenêtre
4. Vérifiez que les messages apparaissent en temps réel sur les deux

### Test 2 : Persistance des Messages

1. Envoyez plusieurs messages
2. Rafraîchissez votre navigateur
3. Tous les messages devraient réapparaître (ils sont dans PostgreSQL)

### Test 3 : API REST

```bash
# Obtenir tous les messages
curl http://localhost:3000/api/messages

# Envoyer un message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"sender": "UtilisateurTest", "text": "Bonjour depuis curl !"}'
```

## Problèmes Courants

| Problème | Solution |
|----------|----------|
| "Impossible de se connecter à PostgreSQL" | Exécutez le conteneur PostgreSQL ou démarrez PostgreSQL système |
| "Impossible de se connecter à Redis" | Exécutez le conteneur Redis ou démarrez Redis système |
| "Port 3000 déjà utilisé" | Changez `PORT=3001` dans `.env` et reconnectez le client à `ws://localhost:3001/ws` |
| "Port 8080 déjà utilisé" | Changez le port `serve()` dans `chat-client/index.ts` |
| Les messages ne s'enregistrent pas | Vérifiez que PostgreSQL est en cours d'exécution : `docker ps` |
| Les messages ne sont pas en temps réel | Vérifiez que Redis est en cours d'exécution : `redis-cli ping` |

## Prochaines Étapes

- Lisez `MIGRATION.md` pour la documentation détaillée de l'architecture
- Consultez `chat-backend/src/` pour l'implémentation du serveur
- Modifiez `chat-client/src/client.ts` pour personnaliser le client
- Ajoutez l'authentification, les salons, ou d'autres fonctionnalités dans `src/database.ts`

## Nettoyage

Pour arrêter tous les services :

```bash
# Arrêter les serveurs Bun
Ctrl+C (dans les deux terminaux)

# Arrêter les conteneurs Docker
docker stop postgres-chat redis-chat
docker rm postgres-chat redis-chat
```

## Structure des Fichiers

```
.
├── chat-backend/
│   ├── src/
│   │   ├── index.ts       # Serveur principal
│   │   ├── database.ts    # PostgreSQL
│   │   └── redis.ts       # Pub/sub Redis
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example       # Modèle d'environnement
├── chat-client/
│   ├── index.ts           # Serveur Bun
│   ├── src/
│   │   └── client.ts      # Client WebSocket
│   ├── package.json
│   └── tsconfig.json
├── MIGRATION.md           # Guide de migration détaillé
└── QUICKSTART.md          # Ce fichier
```

Bonne discussion ! 🎉
