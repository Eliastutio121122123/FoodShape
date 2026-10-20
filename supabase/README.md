# Supabase para FoodShare

La aplicación usa Supabase Auth para correo/contraseña y Google, y PostgreSQL para perfiles, organizaciones, donaciones, solicitudes, entregas, notificaciones e incidencias. La interfaz solo recibe el URL del proyecto y la llave `publishable`; Row Level Security (RLS) limita los registros visibles. No pongas una llave `secret`/`service_role` en Angular ni en el contenedor web.

## Conectar un proyecto alojado

1. Crea un proyecto en Supabase y copia el Project URL y la llave **Publishable** (`sb_publishable_...`).
2. En el Dashboard abre **SQL Editor**, pega y ejecuta el contenido de `migrations/20261020000000_foodshare_initial.sql`.
3. Copia `.env.example` a `.env` y sustituye `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` con esos valores.
4. Configura Authentication → URL Configuration: Site URL `http://localhost:8100` y Redirect URLs `http://localhost:8100/login` y `http://127.0.0.1:8100/login`.
5. Para Google, habilita el proveedor Google en Authentication → Sign In / Providers y sigue el callback URI que muestra Supabase en la consola OAuth de Google. No necesitas un endpoint Google propio en FoodShare.
6. Arranca la aplicación con `docker compose up --build`. Abre `http://localhost:8100`.

## Conectar este repositorio con la integración GitHub de Supabase

El repositorio Git ya tiene el remoto `Eliastutio121122123/FoodShare` y el directorio `supabase/` está en la raíz del repositorio, así que en la integración el **Working directory** es `.`. Primero confirma y sube a GitHub los archivos de esta migración. Luego, en el Dashboard del proyecto, abre **Project Settings → Integrations → GitHub**, autoriza la aplicación Supabase, elige `Eliastutio121122123/FoodShare` y activa la integración. Puedes habilitar despliegue a producción al hacer merge a la rama productiva.

Supabase observa commits y aplica migraciones nuevas que encuentre en `supabase/migrations`. Al conectarla, revisa cuidadosamente la primera ejecución para confirmar que la migración corresponde a una base nueva o que el historial remoto está alineado; no es una sincronización que copie datos de SQL Server. Las ramas de preview de Supabase son opcionales y requieren Branching habilitado en el plan del proyecto.

El registro de voluntarios queda activo al confirmar la cuenta. Los registros de organizaciones se crean pendientes y no pueden entrar al panel hasta su aprobación por un administrador.

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
