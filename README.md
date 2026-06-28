# Mensajeria

App de mensajeria web en tiempo real con autenticacion por usuario y contrasena, salas de chat por codigo/enlace.

## Stack

- **Backend:** Node.js, Express, Socket.IO
- **Base de datos:** SQLite (better-sqlite3)
- **Auth:** bcrypt + express-session
- **Seguridad:** Helmet, express-rate-limit, CSRF tokens, sanitizacion HTML

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
| DELETE | `/api/me` | Si | Eliminar cuenta |
| POST | `/api/chats` | Si | Crear chat |
| POST | `/api/chats/join` | Si | Unirse por codigo |
| GET | `/api/chats` | Si | Listar mis chats |
| GET | `/api/chats/by-code/:code` | No | Buscar chat por codigo |
| GET | `/api/chats/:id/messages` | Si | Mensajes (con paginacion) |
| POST | `/api/chats/:id/leave` | Si | Salir de un chat |
| DELETE | `/api/chats/:id` | Si | Eliminar chat (solo creador) |
| GET | `/api/chats/:id/participants` | Si | Ver participantes |
| GET | `/health` | No | Health check |

### Paginacion de mensajes

```
GET /api/chats/:id/messages?limit=30&before=<message_id>
```

- `limit`: cantidad de mensajes (max 100, default 30)
- `before`: ID del mensaje mas antiguo visible para cargar mensajes anteriores

## Eventos Socket.IO

| Evento | Direccion | Descripcion |
|---|---|---|
| `join_chat` | Cliente -> Servidor | Unirse a una sala de chat |
| `leave_chat` | Cliente -> Servidor | Salir de una sala de chat |
| `send_message` | Cliente -> Servidor | Enviar mensaje |
| `typing` | Cliente -> Servidor | Indicar que esta escribiendo |
| `stop_typing` | Cliente -> Servidor | Dejo de escribir |
| `message` | Servidor -> Cliente | Mensaje nuevo recibido |
| `user_joined` | Servidor -> Cliente | Usuario se unio |
| `user_left` | Servidor -> Cliente | Usuario se fue |
| `user_typing` | Servidor -> Cliente | Alguien esta escribiendo |
| `user_stop_typing` | Servidor -> Cliente | Dejo de escribir |
| `presence` | Servidor -> Cliente | Lista de usuarios en linea |
| `chat_deleted` | Servidor -> Cliente | Chat fue eliminado |

## Funcionalidades

- Autenticacion por usuario/contrasena (bcrypt, sesiones)
- Crear y unirse a chats por codigo unico
- Mensajeria en tiempo real (Socket.IO)
- Indicador de "escribiendo..."
- Presencia en linea
- Paginacion de historial de mensajes
- Notificacion sonora al recibir mensajes
- Roles: admin (creador) y miembro
- Salir de chats / Eliminar chats
- Eliminar cuenta propia
- Proteccion CSRF
- Sanitizacion de contenido contra XSS
- Rate limiting en autenticacion y API
- Indices en base de datos para rendimiento
- Docker con healthcheck y volumen persistente
- Responsive (movil y desktop)

## Estructura

```
mensajeria/
  server.js          # Backend (Express + Socket.IO)
  db.js              # SQLite schema, indices e init
  package.json
  Dockerfile
  docker-compose.yml
  .env.example
  public/
    index.html       # Login/registro
    dashboard.html   # Lobby de chats + zona de peligro
    chat.html        # Sala de chat
    js/
      auth.js        # Logica de autenticacion + CSRF
      dashboard.js   # Logica del panel de chats
      chat.js        # Logica de chat (Socket.IO, typing, presence)
    css/
      style.css      # Estilos (dark theme, responsive)
```
