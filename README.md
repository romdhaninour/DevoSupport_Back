# DevoSupport — Backend

API REST de gestion de parc informatique et support IT.

**Stack :** NestJS 11 + Mongoose 9 + Socket.IO + Passport (Google OAuth / JWT)

---

## Sommaire

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Connexion à la Base de Données](#connexion-à-la-base-de-données)
5. [Commandes](#commandes)
6. [Authentification & Rôles](#authentification--rôles)
7. [Pages & Routes Frontend](#pages--routes-frontend)
8. [API Reference](#api-reference)
9. [Technologies Utilisées](#technologies-utilisées)

---

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌──────────────┐
│   Angular Frontend  │ ───▶ │   NestJS Backend     │ ───▶ │   MongoDB    │
│   localhost:4200    │      │   localhost:3000      │      │  Atlas/Local │
│                     │      │                      │      └──────────────┘
│  - Tailwind CSS v4  │      │  - JWT Auth           │
│  - Signals          │      │  - Google OAuth 2.0   │
│  - Socket.IO client │      │  - Socket.IO server   │
│  - Standalone comps │      │  - Mongoose ODM       │
└─────────────────────┘      └──────────────────────┘
```

### Modules Backend

| Module | Description |
|--------|-------------|
| `auth` | Google OAuth + JWT login |
| `users` | CRUD utilisateurs, rôles, archivage |
| `devices` | Inventaire des appareils, allocation, maintenance |
| `device-types` | Gestion des types d'appareils |
| `devices-maintenance` | Suivi de maintenance séparé |
| `tickets` | Tickets de support |
| `chats` | Messagerie temps réel (Socket.IO) |
| `notifications` | Notifications utilisateurs |
| `dashboard` | Statistiques du tableau de bord |

## Prérequis

- **Node.js** ≥ 18 (testé avec 22.x)
- **npm** ≥ 9
- **MongoDB** — cloud (Atlas) ou instance locale

## Installation

```bash
cd devo-support-backend
npm install
```

### Configuration

Copiez le fichier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Variables d'environnement :

| Variable | Requise | Défaut | Description |
|----------|---------|--------|-------------|
| `MONGODB_URI` | Oui | — | Chaîne de connexion MongoDB |
| `PORT` | Non | `3000` | Port du serveur |
| `GOOGLE_CLIENT_ID` | Oui | — | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Oui | — | Google OAuth Client Secret |
| `JWT_SECRET` | Oui | `your-jwt-secret-key` | Secret pour signer les JWT |

## Connexion à la Base de Données

### Option A : MongoDB Atlas (configuration actuelle)

1. Créez un compte sur [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Créez un cluster (gratuit M0)
3. Créez un utilisateur de base de données
4. Autorisez votre IP dans **Network Access**
5. Récupérez la chaîne de connexion dans **Database → Connect → Drivers**

### Option B : MongoDB Local

```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

Chaîne de connexion locale : `mongodb://localhost:27017/devosupport`

### Configuration dans .env

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/devosupport
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run start:dev` | Mode développement (hot-reload) |
| `npm run build` | Build production |
| `npm run start:prod` | Lancer la version buildée |
| `npm run lint` | ESLint + auto-fix |
| `npm test` | Tests unitaires (Jest) |
| `npm run test:e2e` | Tests end-to-end |

## Authentification & Rôles

### Flow OAuth

```
1. Utilisateur clique "Sign in with Google" sur /signin
         │
         ▼
2. Redirection vers Google OAuth consent screen
         │
         ▼
3. Google redirige vers http://localhost:3000/auth/google/callback
         │
         ▼
4. Backend valide le profil Google :
   ├── Utilisateur existe en DB ? ──Non──▶ Redirection /signin?message=account_not_registered
   ├── Utilisateur actif ? ────────Non──▶ Redirection /signin?message=account_inactive
   └── Utilisateur actif ? ────────Oui──▶ Génération du JWT
         │
         ▼
5. Backend redirige vers :
   http://localhost:4200/auth/callback?token=xxx&role=xxx&...
```

**Important :** Les utilisateurs doivent être pré-créés en base par un ADMIN via l'API ou MongoDB shell. Pas d'auto-inscription.

### Créer un Utilisateur (API)

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@company.com",
    "role": "IT"
  }'
```

L'email doit correspondre au compte Google pour que l'OAuth fonctionne.

### Rôles

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | Accès total | Gestion utilisateurs, appareils, tickets, chat, dashboard |
| `IT` | Personnel IT | Gestion appareils, allocation, maintenance, tickets, chat |
| `CONSULTANT` | Utilisateur final | Voir appareils assignés, créer tickets, chat |

### Vérification Backend

Les contrôleurs vérifient les rôles côté serveur via `req.user.role` :
- Device CRUD, allocation, maintenance → `IT` ou `ADMIN`
- User management → `ADMIN`
- Voir ses propres appareils → tout utilisateur authentifié

## Pages & Routes Frontend

| Route | Guard | Description |
|-------|-------|-------------|
| `/` | auth | Tableau de bord |
| `/signin` | — | Connexion Google |
| `/auth/callback` | — | Callback OAuth |
| `/profile` | auth | Profil utilisateur |
| `/user-management` | Admin | Gestion des utilisateurs |
| `/user-management/:id` | Admin | Détail utilisateur |
| `/archived-users` | Admin | Utilisateurs archivés |
| `/device-management` | IT | Inventaire des appareils |
| `/device-management/:id` | IT | Détail appareil |
| `/device-types` | IT | Types d'appareils |
| `/device-maintenance` | IT | Planning maintenance |
| `/device-maintenance/:id` | IT | Détail maintenance |
| `/device-allocation` | IT | Allocation d'appareils |
| `/tickets` | IT | Tous les tickets |
| `/my-tickets` | auth | Mes tickets |
| `/tickets/:id` | auth | Détail ticket |
| `/chat` | auth | Messagerie temps réel |
| `/consultant-devices` | auth | Mes appareils assignés |
| `/calendar` | auth | Calendrier |

## API Reference

Tous les endpoints protégés nécessitent l'en-tête : `Authorization: Bearer <JWT_TOKEN>`

### Auth

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/auth/google` | Initier la connexion Google OAuth |
| GET | `/auth/google/callback` | Callback Google OAuth |

### Users

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/users` | ADMIN | Liste tous les utilisateurs |
| GET | `/users/archived` | ADMIN | Liste des utilisateurs archivés |
| GET | `/users/me/profile` | Any | Profil de l'utilisateur courant |
| GET | `/users/:id` | Any | Utilisateur par ID |
| POST | `/users` | ADMIN | Créer un utilisateur |
| PATCH | `/users/:id` | ADMIN | Mettre à jour un utilisateur |
| PATCH | `/users/:id/activate` | ADMIN | Activer un utilisateur |
| PATCH | `/users/:id/deactivate` | ADMIN | Désactiver un utilisateur |
| PATCH | `/users/:id/archive` | ADMIN | Archiver un utilisateur |
| PATCH | `/users/:id/restore` | ADMIN | Restaurer un utilisateur archivé |
| DELETE | `/users/:id` | ADMIN | Supprimer un utilisateur |
| POST | `/users/import` | ADMIN | Importer des utilisateurs (Excel) |
| POST | `/users/export` | ADMIN | Exporter des utilisateurs (Excel) |
| GET | `/users/consultants` | IT/ADMIN | Liste des consultants |

### Devices

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/devices` | IT/ADMIN | Liste des appareils (paginated, filtré) |
| GET | `/devices/:id` | Any | Appareil par ID |
| POST | `/devices` | IT/ADMIN | Créer un appareil |
| PATCH | `/devices/:id` | IT/ADMIN | Mettre à jour un appareil |
| PATCH | `/devices/:id/status` | IT/ADMIN | Mettre à jour le statut |
| PATCH | `/devices/:id/allocate` | IT/ADMIN | Allouer à un consultant |
| PATCH | `/devices/:id/return` | IT/ADMIN | Retour d'appareil |
| DELETE | `/devices/:id` | IT/ADMIN | Supprimer un appareil |
| GET | `/devices/assigned` | Any | Appareils assignés à l'utilisateur |
| GET | `/devices/with-maintenance` | Any | Appareils avec infos maintenance |
| GET | `/devices/without-maintenance` | Any | Appareils sans maintenance |
| PATCH | `/devices/:id/maintenance` | IT/ADMIN | Mettre à jour la maintenance |
| PATCH | `/devices/:id/mark-maintained` | IT/ADMIN | Marquer maintenance effectuée |
| POST | `/devices/:id/photo` | IT/ADMIN | Upload photo |
| POST | `/devices/import` | IT/ADMIN | Import Excel |
| POST | `/devices/export` | IT/ADMIN | Export Excel |

### Device Types

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/device-types` | Any | Liste des types |
| POST | `/device-types` | IT/ADMIN | Créer un type |
| PATCH | `/device-types/:id` | IT/ADMIN | Mettre à jour un type |
| DELETE | `/device-types/:id` | IT/ADMIN | Supprimer un type |

### Tickets

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/tickets` | Any | Liste des tickets |
| GET | `/tickets/:id` | Any | Ticket par ID |
| POST | `/tickets` | Any | Créer un ticket |
| PATCH | `/tickets/:id/status` | IT/ADMIN | Mettre à jour le statut |
| PATCH | `/tickets/:id/assign` | IT/ADMIN | Assigner un ticket |
| POST | `/tickets/:id/comments` | Any | Ajouter un commentaire |
| DELETE | `/tickets/:id` | IT/ADMIN | Supprimer un ticket |
| GET | `/tickets/user/:userId` | Any | Tickets par utilisateur |

### Chats

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/chats/conversations` | Any | Liste des conversations |
| GET | `/chats/messages/:userId` | Any | Messages avec un utilisateur |
| GET | `/chats/unread` | Any | Nombre de messages non lus |

### Dashboard

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/dashboard/stats` | Any | Statistiques du tableau de bord |

### WebSocket (Socket.IO)

Namespace : `/chat`

| Événement | Direction | Payload |
|-----------|-----------|---------|
| `send_message` | Client → Serveur | `{ receiverId, message, imageUrl? }` |
| `new_message` | Serveur → Client | Objet message |
| `message_sent` | Serveur → Client | Confirmation |
| `mark_as_read` | Client → Serveur | `{ messageId }` |
| `message_read` | Serveur → Client | `{ messageId }` |
| `join_conversation` | Client → Serveur | `{ userId }` |
| `conversation_read` | Serveur → Client | `{ by }` |
| `typing` | Client → Serveur | `{ receiverId, isTyping }` |
| `user_typing` | Serveur → Client | `{ userId, isTyping }` |
| `toggle_reaction` | Client → Serveur | `{ messageId, emoji }` |
| `message_reaction` | Serveur → Client | `{ messageId, reactions }` |
| `unread_count` | Serveur → Client | Number |

## Technologies Utilisées

- **NestJS 11** — Framework Node.js côté serveur
- **Mongoose 9** — ODM MongoDB
- **Socket.IO 4** — Communication temps réel (chat)
- **Passport** — Authentification (Google OAuth 2.0 + JWT)
- **class-validator / class-transformer** — Validation des DTOs
- **sharp** — Compression d'images
- **exceljs** — Import/Export Excel
- **uuid** — Génération d'identifiants uniques
- **Jest** — Tests unitaires
- **TypeScript 5** — Langage
