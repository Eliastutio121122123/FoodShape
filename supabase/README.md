# Supabase para FoodShare

La aplicación usa Supabase Auth para correo/contraseña y Google, y PostgreSQL para perfiles, organizaciones, donaciones, solicitudes, entregas, notificaciones e incidencias. La interfaz solo recibe el URL del proyecto y la llave `publishable`; Row Level Security (RLS) limita los registros visibles. No pongas una llave `secret`/`service_role` en Angular ni en el contenedor web.

## Conectar un proyecto alojado

1. Crea un proyecto en Supabase y copia el Project URL y la llave **Publishable** (`sb_publishable_...`).
2. En el Dashboard abre **SQL Editor**, pega y ejecuta el contenido de `migrations/20261020000000_foodshare_initial.sql`.
3. Aplica también las migraciones posteriores de `migrations/` en orden para habilitar los cambios recientes, incluida `20261117090000_individual_beneficiaries.sql` para cuentas personales que solicitan alimentos. Si el proyecto ya está vinculado con Supabase CLI, desde la raíz del repositorio ejecuta `npx supabase db push`.
4. Copia `.env.example` a `.env` y sustituye `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` con esos valores.
5. Configura Authentication → URL Configuration: Site URL `http://localhost:8100` y Redirect URLs `http://localhost:8100/login` y `http://127.0.0.1:8100/login`.
6. Para habilitar “Continuar con Google”, crea un cliente OAuth de tipo aplicación web en Google Cloud. En Google, agrega como URI de redirección autorizada el callback que muestra Supabase (normalmente `https://<project-ref>.supabase.co/auth/v1/callback`). Copia el Client ID y Client Secret en Supabase → Authentication → Sign In / Providers → Google y activa el proveedor. En Supabase → Authentication → URL Configuration, agrega también la dirección `/login` de cada entorno que uses (local y producción) a Redirect URLs. No guardes el Client Secret en FoodShare ni en GitHub; el flujo usa Supabase Auth y vuelve a `/login`, donde se consulta el perfil activo para abrir el panel con su rol.
7. Arranca la aplicación con `docker compose up --build`. Abre `http://localhost:8100`.

## Conectar este repositorio con la integración GitHub de Supabase

El repositorio Git ya tiene el remoto `Eliastutio121122123/FoodShare` y el directorio `supabase/` está en la raíz del repositorio, así que en la integración el **Working directory** es `.`. Primero confirma y sube a GitHub los archivos de esta migración. Luego, en el Dashboard del proyecto, abre **Project Settings → Integrations → GitHub**, autoriza la aplicación Supabase, elige `Eliastutio121122123/FoodShare` y activa la integración. Puedes habilitar despliegue a producción al hacer merge a la rama productiva.

Supabase observa commits y aplica migraciones nuevas que encuentre en `supabase/migrations`. Al conectarla, revisa cuidadosamente la primera ejecución para confirmar que la migración corresponde a una base nueva o que el historial remoto está alineado; no es una sincronización que copie datos de SQL Server. Las ramas de preview de Supabase son opcionales y requieren Branching habilitado en el plan del proyecto.

El registro de voluntarios queda activo al confirmar la cuenta. Los registros de organizaciones se crean pendientes y no pueden entrar al panel hasta su aprobación por un administrador. Al aprobar una organización, la base confirma también el correo de Auth de su propietario, de modo que pueda iniciar sesión sin esperar el enlace de confirmación.

Las personas que solicitan alimentos se registran con el perfil personal `person`. Pueden consultar organizaciones aprobadas, contactarlas, solicitar unirse o pedir una ración. Las organizaciones gestionan estas solicitudes en **Solicitudes de apoyo personal** y pueden fijar fecha y hora para una ración.

## Crear el primer administrador

Registra primero la cuenta deseada desde FoodShare y confirma el correo si Supabase lo solicita. En SQL Editor asigna el rol administrativo al perfil existente (cambia el correo):

```sql
update public.profiles
set role = 'admin', status = 'active'
where email = lower('admin@foodshare.local');
```

El rol `admin` no se puede elegir desde el formulario público. Cierra y vuelve a iniciar sesión después de promover la cuenta.

## Desarrollo local con Supabase CLI

Con Docker y Supabase CLI instalados, ejecuta `npx supabase start` desde esta carpeta para levantar Auth, PostgreSQL y Studio. La migración de `supabase/migrations` se aplica con `npx supabase db reset`. Studio queda en `http://localhost:54323`; las credenciales y llaves locales se imprimen en la salida del comando. Para el contenedor web usa en `.env` el URL local accesible desde el navegador (normalmente `http://localhost:54321`) y la llave publishable local.

## Alcance de esta migración

La migración crea las entidades centrales del dominio y las reglas RLS. El panel admin ya puede listar y aprobar/rechazar organizaciones. Las pantallas de donaciones, solicitudes, entregas y reportes aún tienen áreas con datos de demostración; sus servicios se conectarán a estas tablas en los siguientes pasos. La API ASP.NET Core y los scripts `database/sqlserver` quedan como legado y ya no se levantan desde `compose.yaml`.

## Fotos de perfil y diagnóstico de acceso

Las fotos de perfil se guardan en Storage, en el bucket público `foodshare-avatars`, con objetos dentro de la carpeta del UID de cada usuario. La tabla `public.profiles` conserva solo `avatar_path`; no guardes Data URLs ni imágenes base64 en `auth.users.raw_user_meta_data`, porque esos metadatos se incluyen en solicitudes de Auth y pueden causar respuestas HTTP 520 por el tamaño de los encabezados.

Antes de desplegar la función de fotos, aplica `migrations/20261104000000_foodshare_profile_avatars_storage.sql`. Desde la raíz del repositorio vinculado se puede usar `supabase db push`; alternativamente, ejecuta el SQL de la migración en Dashboard > SQL Editor. El bucket limita las imágenes a 2 MB y las políticas restringen la escritura a la carpeta del usuario autenticado.

La migración `migrations/20261104120000_confirm_organization_email_on_approval.sql` vincula aprobación y acceso: al pasar una organización a `approved`, un trigger activa el perfil de su propietario y confirma su correo Auth. También repara ambas condiciones en las cuentas de organizaciones ya aprobadas cuando se ejecuta la migración. Aplica esta migración al proyecto remoto para habilitar a las instituciones ya aprobadas; no requiere una llave `service_role` en el cliente. Los voluntarios siguen teniendo que confirmar su correo. Un HTTP 200 de Auth seguido por un fallo HTTP 520 en `/rest/v1/profiles` indica un problema posterior, en la API de datos.
