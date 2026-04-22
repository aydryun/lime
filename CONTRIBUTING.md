# Guide de Contribution (Contributing)

### 3. Soumettre une Pull Request (PR)

1. cloner le dépôt et créez votre branche à partir de `main` (`git checkout -b feature/ma-nouvelle-fonctionnalite` ou `fix/mon-correctif`).
2. Assurez-vous que votre code respecte nos standards (voir la section "Règles de codage").
3. Commitez vos changements en respectant nos conventions de commit.
4. Poussez votre branche sur le depot (`git push origin feature/ma-nouvelle-fonctionnalite`).
5. Ouvrez une Pull Request vers la branche `main` du dépôt principal. Décrivez précisément vos modifications.

---

## Environnement de Développement

Ce projet utilise une architecture divisée entre un client (`chat-client`) et un backend (`chat-backend`), pouvant être lancés via Docker.

### Prérequis

- [Bun](https://bun.sh/) (vérifiez la version requise dans le `package.json`)
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

### Installation et Démarrage

1. **Cloner le projet** :

   ```bash
   git clone https://github.com/aydryun/lime
   cd lime
   ```

2. **Variables d'environnement** :
   Copiez le fichier `.env.example` en `.env` et ajustez les variables si nécessaire.

   ```bash
   cp .env.example .env
   ```

3. **Lancer les services avec Docker Compose** (recommandé) :

   ```bash
   docker compose up -d
   ```

4. **Installation locale (sans Docker)** :
   Installez les dépendances à la racine, dans le client et dans le backend :

   ```bash
   bun install
   cd chat-backend && bun install
   cd ../chat-client && bun install
   ```

---

## Règles de Codage

- **TypeScript** : Le projet est codé en TypeScript. Merci de typer rigoureusement vos variables et fonctions. Ne pas utiliser `any` sans justification.
- **Linting & Formatage** : Assurez-vous d'exécuter les scripts de linting et de formatage avant de commiter (`bun run lint` si disponible).
- **Tests** : Si vous ajoutez une fonctionnalité ou corrigez un bug, essayez d'ajouter ou de mettre à jour les tests correspondants.

## Conventions de Commit

Nous utilisons des messages de commit sémantiques. Le format recommandé est :

```
<type>: <description courte>
```

**Types courants :**

- `feat` : Ajout d'une nouvelle fonctionnalité
- `fix` : Correction d'un bug
- `docs` : Modification de la documentation
- `style` : Formatage, point-virgules manquants, etc. (sans impact sur la logique)
- `refactor` : Refactorisation du code de production
- `test` : Ajout ou modification de tests
- `chore` : Mise à jour des tâches de build, configuration, etc.
- `ci` : modification du pipeline CI/CD


*Exemple : `feat: ajout du support pour les emojis`*

---

Lime 🍋
