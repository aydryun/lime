# Parcours utilisateur

> Rejoindre et utiliser Lime

```mermaid
flowchart TD

A[Invitation à rejoindre Lime] --> B[Connexion ou création du compte]
B --> C[Arrivée sur l'interface d'accueil]
C --> D[Visualiser les canaux disponibles]

D --> E[Rejoindre un canal<br>équipe / projet / sujet]

E --> F[Lire l'historique des conversations]

F --> G[Envoyer un message]
G --> H[Ajouter un fichier ou un lien]

H --> I[Recevoir des réponses de l'équipe]

I --> J[Notification reçue]

J --> K[Ouvrir la conversation]

K --> L[Réagir ou répondre au message]

L --> M{Besoin de retrouver une information ?}

M -->|Non| N[Continuer la discussion]

M -->|Oui| O[Utiliser la barre de recherche]

O --> P[Filtrer les résultats<br>messages / fichiers / liens]

P --> Q[Retrouver l'information]

Q --> N

N --> R[Fin du parcours]
