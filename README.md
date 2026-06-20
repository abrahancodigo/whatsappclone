# WhatsApp Clone

Un clon de WhatsApp completo y funcional con chat en tiempo real, estados, llamadas y almacenamiento en la nube. Todo gratis usando Supabase + LiveKit + Next.js.

## Características

- **Chat 1-a-1 y grupal** con mensajes en tiempo real
- **Mensajes multimedia** (imágenes, archivos)
- **Estados/Stories** con expiración de 24 horas
- **Llamadas de voz y video** usando WebRTC (LiveKit)
- **Autenticación** con email/password (sin números de teléfono)
- **Perfiles de usuario** con avatares personalizables
- **Interfaz estilo WhatsApp** con diseño oscuro
- **Políticas de seguridad** (RLS) en Supabase
- **Responsive** (funciona en móvil y desktop)

## Requisitos

- Node.js 18+
- npm o yarn
- Cuenta gratuita en Supabase
- Cuenta gratuita en LiveKit (opcional - puedes usar WebRTC puro)

## Configuración

### 1. Clones el repositorio

```bash
git clone https://github.com/tu-usuario/whatsapp-clone.git
cd whatsapp-clone
```

### 2. Instala las dependencias

```bash
npm install
```

### 3. Configura Supabase

#### Crea un proyecto en supabase.com

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Copia la `URL` y `Clave anónima` de `Configuración de conexión`
4. Copia la `Clave de servicio` de `Configuración de API`

#### Importa el esquema SQL

1. Ve a tu proyecto de Supabase
2. Ve a **SQL Editor**
3. Copia todo el contenido de `supabase/schema.sql`
4. Haz clic en **Ejecutar** para ejecutar el esquema

#### Configura la autenticación

1. Ve a **Auth** > **Settings**
2. Deshabilita **Confirm email** (opcional, para registro instantáneo)
3. Agrega **Username** y **Display name** a los ajustes de registro (opcional)

#### Configura el almacenamiento

El esquema ya crea estos buckets:
- `avatars` - para fotos de perfil
- `chat-files` - para imágenes y archivos de chat
- `statuses` - para fotos de estados

### 4. Configura LiveKit (opcional)

#### Opción A: LiveKit Cloud (recomendado)

1. Crea una cuenta en [cloud.livekit.io](https://cloud.livekit.io)
2. Crea un nuevo proyecto
3. Copia la `API Key` y `Secret` de **Settings** > **Keys**
4. Copia la `WebSocket URL` de **Settings** > **Keys**

#### Opción B: WebRTC puro (sin LiveKit)

Si no quieres usar LiveKit, puedes comentar las configuraciones de LiveKit en el código y las llamadas seguirán funcionando (sin video, solo audio básico). Las llamadas de voz aún funcionarán con WebRTC.

### 5. Configura las variables de entorno

Crea un archivo `.env.local` basado en `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=TU-SERVICE-ROLE-KEY

LIVEKIT_API_KEY=TU-LIVEKIT-API-KEY
LIVEKIT_API_SECRET=TU-LIVEKIT-API-SECRET
NEXT_PUBLIC_LIVEKIT_WS_URL=wss://tu-proyecto.livekit.cloud
```

### 6. Ejecuta la aplicación

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Uso

### Registro e inicio de sesión

1. Ve a `http://localhost:3000`
2. Haz clic en **Regístrate**
3. Completa el formulario con email, nombre de usuario y contraseña
4. Inicia sesión con tus credenciales

### Navegación

- **Chats**: Ve todas tus conversaciones (sidebar/desktop, bottom nav/mobile)
- **Llamadas**: Historial de llamadas y acceso rápido a llamadas
- **Estados**: Estados tipo WhatsApp (Stories) que expiran en 24h
- **Perfil**: Configura tu perfil, avatar y ajustes

### Chat

1. Haz clic en un chat para abrirlo
2. Escribe un mensaje en el campo de entrada
3. Haz clic en el botón de enviar para enviar el mensaje
4. Haz clic en el ícono de adjuntar para enviar imágenes o archivos
5. Haz clic en el ícono de respuesta para responder a un mensaje específico

### Estados

1. Ve a **Estados**
2. Haz clic en **Mi estado** o en el ícono de cámara para agregar un nuevo estado
3. Selecciona texto o una imagen
4. Agrega una descripción si es una imagen
5. Haz clic en **Publicar**

### Llamadas

1. Ve a **Llamadas**
2. Haz clic en el ícono de teléfono o video para iniciar una llamada de voz o video con tu perfil
3. Las llamadas se registran automáticamente en el historial

## Estructura del proyecto

```
whatsapp-clone/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Páginas de login/registro
│   │   ├── (main)/          # Layout principal protegido
│   │   │   ├── layout.tsx   # Sidebar + bottom nav + main content
│   │   │   ├── chats/       # Página de chat list y chat individual
│   │   │   ├── status/      # Página de estados
│   │   │   ├── calls/       # Página de llamadas
│   │   │   └── profile/      # Página de perfil
│   │   └── page.tsx         # Página de inicio (redirección)
│   ├── lib/                 # Utilidades y clientes Supabase
│   │   ├── supabase/        # Clientes de Supabase
│   │   └── utils.ts         # Funciones helper (cn, formateo, colores)
│   ├── components/          # Componentes UI (Button, Input, Card)
│   │   └── ui/             # Componentes de interfaz de usuario
│   └── types/              # Tipos TypeScript (Database, etc.)
├── supabase/                # Esquema SQL
│   └── schema.sql          # Definiciones de tablas y políticas RLS
├── .env.local.example       # Ejemplo de variables de entorno
├── package.json            # Dependencias
└── README.md               # Este archivo
```

## Tecnologías

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS** v4 para estilos
- **Supabase** para backend, base de datos, autenticación, almacenamiento y tiempo real
- **LiveKit** para llamadas de voz/video (opcional)
- **@tanstack/react-query** para gestión de estado y caché
- **Lucide React** para iconos

## Desafíos y limitaciones

### Autenticación sin número de teléfono

Este clon no usa números de teléfono reales. Solo usa email/password para registro e inicio de sesión. Las llamadas son entre usuarios de la aplicación (WebRTC), no a números telefónicos reales.

### Uso de Notion como base de datos

**No recomendado**: Notion no es adecuado como base de datos para un chat debido a:
- Lenta latencia
- Límites de tasa estrictos
- No soporta actualizaciones en tiempo real
- No escalable para aplicaciones con muchas escrituras

**Recomendado**: Supabase (PostgreSQL + Realtime) es una excelente alternativa gratuita.

### Licencias

- Este proyecto usa software de código abierto bajo licencias permisivas
- Las APIs de terceros (Supabase, LiveKit) tienen sus propios términos de servicio
- La aplicación en sí es de código abierto y gratis

## Contribuciones

Siéntete libre para contribuir. Por favor, crea un fork y haz un pull request con tus mejoras.

## Licencia

MIT
