# Mensajeria

App de mensajeria web en tiempo real con autenticacion por usuario y contraseña, salas de chat por codigo/enlace.

## Stack

- **Backend:** Node.js, Express, Socket.IO
- **Base de datos:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session
- **Seguridad:** Helmet, express-rate-limit

## Requisitos

- Node.js 18+

## Instalacion

```bash
cd mensajeria
cp .env.example .env
# Edita .env con tu SESSION_SECRET

npm install
npm start
```

El servidor arranca en `http://localhost:3000`.

## Desarrollo

```bash
npm run dev
```

Usa `--watch` de Node para reinicio automatico.

## Produccion con Docker

```bash
cp .env.example .env
# Edita .env

docker compose up -d
```

## Variables de entorno

| Variable | Default | Descripcion |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `SESSION_SECRET` | (ninguno) | Secreto para firmar sesiones |
| `NODE_ENV` | `development` | `production` para cookies seguras |

## API

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/register` | No | Crear cuenta |
| POST | `/api/login` | No | Iniciar sesion |
| POST | `/api/logout` | No | Cerrar sesion |
| GET | `/api/me` | No | Usuario actual |
| POST | `/api/chats` | Si | Crear chat |
| POST | `/api/chats/join` | Si | Unirse por codigo |
| GET | `/api/chats` | Si | Listar mis chats |
| GET | `/api/chats/by-code/:code` | No | Buscar chat por codigo |
| GET | `/api/chats/:id/messages` | Si | Mensajes del chat |
| GET | `/health` | No | Health check |

## Estructura

```
mensajeria/
  server.js          # Backend (Express + Socket.IO)
  db.js              # SQLite schema e init
  package.json
  Dockerfile
  docker-compose.yml
  .env.example
  public/
    index.html       # Login/registro
    dashboard.html   # Lobby de chats
    chat.html        # Sala de chat
    js/
      auth.js        # Logica de autenticacion
      chat.js        # Logica de chat (Socket.IO)
    css/
      style.css      # Estilos
```
