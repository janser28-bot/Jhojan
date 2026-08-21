# Agenda Serrano

App de tareas compartida en tiempo real (Firebase Firestore + Authentication),
lista para publicar gratis en GitHub Pages, con reporte diario por correo a las 6:00 a.m.

## 1. Crear el proyecto de Firebase (gratis, plan Spark)

1. Entra a https://console.firebase.google.com y crea un proyecto nuevo.
2. **Firestore Database** → Crear base de datos → modo producción → región cercana (ej. `us-east1`).
3. **Authentication** → Comenzar → habilita el proveedor **Correo electrónico/contraseña**.
4. **Authentication → Users** → agrega manualmente una cuenta (correo + contraseña) por
   cada una de las 2-5 personas que van a usar la app. Tú decides esas contraseñas y
   se las compartes por un medio seguro (no van en el código).
5. **Reglas de Firestore**: pega el contenido de `firestore.rules` en
   Firestore Database → pestaña "Reglas" → Publicar.
6. **⚙️ Configuración del proyecto → General → Tus apps** → agrega una app web (ícono `</>`).
   Copia el objeto `firebaseConfig` que te muestra y pégalo en `js/firebase-config.js`
   (reemplaza el objeto de ejemplo completo).

> Estas claves de `firebaseConfig` **no son secretas** — están pensadas para vivir en el
> navegador. Lo que de verdad protege tus datos son las reglas de Firestore del paso 5.

## 1.5 Activar Firebase Storage (fotos de avatar y archivos adjuntos)

1. Firebase Console → **Compilación → Storage** → "Comenzar". Te pedirá pasar al
   plan **Blaze** (pago por uso) — es normal, Google lo exige para Storage, pero
   tiene una franja gratuita mensual amplia (5 GB de almacenamiento, 1 GB/día de
   descarga) más que suficiente para 2-5 personas subiendo fotos y documentos.
2. Pega el contenido de `storage.rules` en la pestaña **Rules** de Storage → Publicar.

## 2. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube todo el contenido de esta carpeta.
2. Repositorio → **Settings → Pages** → Source: rama `main`, carpeta `/ (root)`.
3. En un par de minutos tu app queda en `https://tu-usuario.github.io/tu-repo/`.

## 3. Reporte diario por correo (6:00 a.m., a janser28@gmail.com)

Se envía con un workflow de **GitHub Actions** (gratis, incluido en tu cuenta) que corre
todos los días y usa tu propia cuenta de Gmail para mandar el correo — no necesitas
crear cuenta en ningún servicio externo.

1. **Crea una "contraseña de aplicación" de Gmail** (no tu contraseña normal):
   - Activa la verificación en dos pasos en tu cuenta de Google, si no la tienes:
     https://myaccount.google.com/security
   - Luego ve a https://myaccount.google.com/apppasswords y genera una contraseña
     de aplicación (elige "Otra" y ponle de nombre "Agenda Serrano"). Google te da
     un código de 16 letras — guárdalo, es el único momento en que se muestra.

2. **Genera una clave de servicio de Firebase** (para que el script pueda leer Firestore):
   - Firebase Console → ⚙️ Configuración del proyecto → **Cuentas de servicio**
   - Botón "Generar nueva clave privada" → descarga el archivo `.json`.

3. **Guarda 3 secretos en tu repositorio de GitHub**:
   Repositorio → **Settings → Secrets and variables → Actions → New repository secret**
   - `FIREBASE_SERVICE_ACCOUNT` → pega **todo el contenido** del archivo `.json` del paso 2
   - `GMAIL_USER` → tu correo de Gmail (el que envía el reporte)
   - `GMAIL_APP_PASSWORD` → el código de 16 letras del paso 1

4. Listo. El workflow `.github/workflows/daily-report.yml` corre automáticamente
   todos los días a las 6:00 a.m. hora de Colombia. También puedes probarlo ya mismo
   sin esperar: pestaña **Actions** → "Reporte diario Agenda Serrano" → **Run workflow**.

## Estructura del proyecto

```
index.html                        → app (login + tareas)
css/styles.css                    → estilos
js/firebase-config.js             → tus claves de Firebase (paso 1.6)
js/app.js                         → lógica: auth, Firestore en tiempo real, CRUD
firestore.rules                   → reglas de seguridad (pégalas en Firebase)
scripts/send-daily-report.js      → arma y envía el correo diario
.github/workflows/daily-report.yml → cron diario de GitHub Actions
```

## Modelo de datos en Firestore

- `tasks/{id}` — `title`, `description`, `completed`, `createdAt`, `completedAt`, `createdBy` (uid),
  `dueDate` (YYYY-MM-DD o null), `priority` (alta/media/baja), `tags` (array de texto),
  `assignedTo` (uid o null), `attachmentUrl`, `attachmentName`, `subtasks` (array de
  `{title, completed}`). Compartida: todos los usuarios autenticados la ven y la editan.
- `users/{uid}` — `nombre`, `apellidos`, `avatarUrl` (ahora se sube como archivo a Storage,
  ya no se pega una URL a mano), `email`. Cada quien edita solo el suyo, pero todos pueden
  leer los demás (para mostrar nombre y avatar en las tareas).
- **Storage**: `avatars/{uid}/...` (fotos de perfil) y `tasks/{uid}/...` (adjuntos de tareas).
