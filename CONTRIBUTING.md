# Guide de Contribution — Lime

## Objectif du document

Ce document définit les règles de contribution au projet **Lime**.

L'objectif est de garantir un travail propre, traçable et maintenable, dans un contexte proche d'un projet professionnel : branches structurées, commits lisibles, pull requests vérifiables, tests automatisés et documentation minimale.

---

## Organisation des branches

Le projet utilise une stratégie inspirée de **Git Flow simplifié** :

- La branche `master` contient uniquement du code stable, testé et prêt à être déployé.
- Les développements se font dans des branches temporaires créées à partir de `master`.
- On ne développe **jamais** directement sur `master`.

### Convention de nommage des branches

```
feature/nom-de-la-fonctionnalite
fix/nom-du-correctif
docs/sujet-documentation
chore/tache-technique
ci/sujet-pipeline
```

**Exemples :**

```
feature/auth-docs-swagger
fix/logout-bearer-token
docs/reorganize-docs
chore/add-sonarqube-config
```

### Création d'une branche de travail

Depuis la branche `master` :

```bash
git checkout master
git pull origin master
git checkout -b feature/nom-de-la-fonctionnalite
```

---

## Convention des commits

Les messages de commit doivent être **courts, explicites et structurés**.

On utilise la convention **Conventional Commits** :

```
type: description courte
```

**Types utilisés :**

- `feat` : ajout d'une fonctionnalité
- `fix` : correction d'un bug
- `docs` : modification de documentation
- `style` : modification de présentation sans impact fonctionnel
- `refactor` : restructuration du code sans changement fonctionnel
- `test` : ajout ou modification de tests
- `chore` : tâche technique ou configuration
- `ci` : modification du pipeline CI/CD

**Exemples :**

```
feat: ajout du formulaire de connexion
fix: correction de la route health du back
docs: ajout du guide de contribution
ci: ajout de l'analyse SonarQube
chore: mise à jour de la configuration Docker
```

---

## Environnement de développement

Ce projet est organisé en monorepo : un client Next.js (`chat-client`) et un backend Express + PostgreSQL + Redis (`chat-backend`).

### Prérequis

- [Bun](https://bun.sh/) (version dans `package.json`)
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### Installation

1. **Cloner le projet** :

   ```bash
   git clone https://github.com/aydryun/lime
   cd lime
   ```

2. **Variables d'environnement** :

   ```bash
   cp .env.example .env
   ```

   Le fichier `.env.example` sert uniquement de modèle : il ne doit jamais contenir de valeurs sensibles.

3. **Lancer les services avec Docker Compose** (recommandé) :

   ```bash
   docker compose up -d
   ```

4. **Installation locale (sans Docker)** :

   ```bash
   bun install
   cd chat-backend && bun install
   cd ../chat-client && bun install
   ```

---

## Règles avant d'ouvrir une pull request

Avant d'ouvrir une pull request, on vérifie que le projet fonctionne localement.

### Pour le back

```bash
cd chat-backend
bun install
bun run lint
bun test
```

### Pour le front

```bash
cd chat-client
bun install
bun run lint
```

### Pour vérifier l'environnement Docker

```bash
docker compose up --build
```

L'application doit démarrer sans erreur bloquante.

---

## Règles de codage

- **TypeScript** : le projet est codé en TypeScript. Typer rigoureusement variables et fonctions. Ne pas utiliser `any` sans justification.
- **Linting & formatage** : le projet utilise [Biome](https://biomejs.dev/). Exécuter `bun run lint` et `bun run format` avant de commiter.
- **Tests** : toute nouvelle fonctionnalité ou correction de bug doit être accompagnée de tests correspondants quand c'est pertinent.

---

## Règles de pull request

Une pull request doit être ouverte depuis une branche de travail vers `master`.

La pull request doit contenir :

- Une description claire de la modification
- Le type de changement réalisé
- Les tests exécutés
- Les éventuelles limites connues
- Les fichiers ou composants impactés

### Modèle conseillé

```markdown
## Objet de la pull request

Décrire brièvement la modification.

## Type de changement

- [ ] Nouvelle fonctionnalité
- [ ] Correction
- [ ] Documentation
- [ ] Refactorisation
- [ ] CI/CD
- [ ] Configuration

## Tests réalisés

\`\`\`bash
bun test
bun run lint
docker compose up --build
\`\`\`

## Points de vigilance

Indiquer les limites connues ou les éléments à vérifier.
```

---

## Règles de revue de code

Une pull request doit rester **limitée à un sujet précis**. On évite les pull requests qui mélangent fonctionnalité, correction, documentation et refactorisation sans lien direct.

La revue doit vérifier :

- La lisibilité du code
- La cohérence avec l'architecture du projet
- La présence de tests si nécessaire
- L'absence de secrets dans le code
- La cohérence des variables d'environnement
- Le respect des conventions de nommage
- Le bon fonctionnement du pipeline CI/CD

---

## Gestion des secrets

- Aucun mot de passe, token, identifiant ou clé privée ne doit être versionné.
- Les fichiers `.env` ne doivent **pas** être commités.
- Le fichier `.env.example` sert uniquement de modèle de configuration (valeurs non sensibles).
- Les secrets utilisés par GitHub Actions doivent être stockés dans les **secrets du dépôt GitHub**.

---

## Documentation attendue

Toute modification importante doit être accompagnée d'une mise à jour de la documentation concernée :

- `README.md`
- `.env.example`
- `docs/` (architecture, API, quickstart…)
- Scripts de déploiement
- Documentation API si nécessaire

---

## Critère minimal d'acceptation

Une contribution est acceptable si :

- [ ] La branche respecte la convention de nommage
- [ ] Les commits sont lisibles et conformes à Conventional Commits
- [ ] La pull request est documentée
- [ ] Les tests passent
- [ ] Le lint ne signale pas d'erreur bloquante
- [ ] Le pipeline CI/CD passe
- [ ] Aucun secret n'est exposé

---

Lime 🍋
