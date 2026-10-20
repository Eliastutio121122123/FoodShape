# FoodShare: funcionamiento y requerimientos

## Objetivo

FoodShare conecta organizaciones donantes que ofrecen alimentos, organizaciones beneficiarias que solicitan esos alimentos, personas voluntarias que apoyan con las entregas y administradores que verifican las organizaciones y supervisan la plataforma.

## Alcance funcional del sistema

Esta sección es la lista de referencia de las funcionalidades que debe cubrir FoodShare. Debe consultarse al planificar o implementar cambios. La lista describe el alcance deseado; el estado implementado se documenta más abajo.

### 1. Cuentas, autenticación y permisos

- Registro de usuarios por rol e inicio de sesión con autenticación.
- Gestión de perfiles y roles, con control de permisos y acceso según el rol.
- Edición del perfil de usuario o institución.

### 2. Instituciones y voluntariado

- Registro y gestión de instituciones donantes.
- Registro y gestión de instituciones beneficiarias.
- Registro y gestión de voluntarios.
- Gestión administrativa de usuarios e instituciones, incluida la verificación de instituciones.

### 3. Alimentos y donaciones

- Registro de información de alimentos y sus categorías.
- Publicación, edición y cancelación de donaciones.
- Cada publicación incluye alimento, cantidad, fecha de vencimiento, ubicación y horario de recogida.
- Gestión de la disponibilidad de las donaciones.
- Consulta de donaciones disponibles y búsqueda con filtros por tipo de alimento, ubicación y fecha.

### 4. Solicitudes y reservas

- Solicitud de donaciones por parte de instituciones beneficiarias.
- Aceptación o rechazo de solicitudes por parte de la institución donante.
- Cancelación de solicitudes y reserva de donaciones.
- Gestión de los estados de solicitudes y donaciones, manteniendo su relación coherente.

### 5. Recogida, entrega y estados

- Asignación de voluntarios para recogida y entrega.
- Gestión de fechas y horarios de recogida y entrega.
- Registro y seguimiento de la recogida y entrega de alimentos.
- Actualización del estado de la donación: disponible, reservada, en proceso de recogida, recogida, entregada, expirada o cancelada.
- Registro y consulta de entregas realizadas.

### 6. Comunicación e historial

- Notificaciones sobre nuevas donaciones disponibles, solicitudes aceptadas, entregas asignadas y otros eventos relevantes.
- Historial de donaciones, solicitudes y entregas por usuario.

### 7. Administración y operación de la plataforma

- Panel administrativo para la gestión general de usuarios, instituciones y donaciones.
- Gestión de ubicaciones de usuarios, instituciones y donaciones.
- Gestión de la configuración de la plataforma.
- Gestión de incidencias o reportes.
- Generación de reportes.

### 8. Estadísticas, impacto y reputación

- Estadísticas e indicadores de impacto de las donaciones y entregas.
- Sistema de puntuación o reputación para los participantes.

## Perfiles y acceso

- **Administración:** gestiona la plataforma y revisa las solicitudes de organizaciones.
- **Organización donante:** publica excedentes y coordina la entrega de donaciones.
- **Organización beneficiaria:** consulta donaciones disponibles y envía solicitudes.
- **Voluntariado:** consulta y gestiona entregas asignadas.

Las rutas de los paneles usan guards de Angular para exigir una sesión y el rol que corresponde a cada panel. Después del inicio de sesión, la aplicación envía al usuario a su panel. Los guards del cliente ayudan a controlar la navegación, pero la API también debe autorizar cada operación antes de usarse en producción.

## Registro y verificación de organizaciones

El registro permite elegir entre organización donante, organización beneficiaria y voluntariado.

Los formularios aplican estas validaciones:

- **Donante:** nombre de organización, RNC, correo, teléfono, dirección y persona responsable.
- **Beneficiaria:** nombre de institución, tipo de institución, RNC opcional, correo, teléfono, dirección y persona responsable. Si se elige “Otro”, se debe especificar el tipo.
- **Voluntariado:** nombre, correo, teléfono, medio de transporte, zona de disponibilidad y aceptación del acuerdo. Si se elige “Otro” como transporte, se debe especificar.
- **Inicio de sesión:** correo válido y contraseña de al menos ocho caracteres.

Después de enviar el registro, las organizaciones donantes y beneficiarias quedan **pendientes**. No pueden iniciar sesión con ese perfil hasta que administración revise la información y apruebe la solicitud. Si se rechaza, el acceso sigue bloqueado. Las solicitudes aparecen en **Admin → Instituciones** con el correo, RNC, teléfono, dirección y persona responsable para facilitar la revisión.

El voluntariado conserva el registro demostrativo con acceso inmediato. Una vez aprobada una organización, se inicia sesión usando el correo asociado y se elige el perfil correspondiente.

## Funcionamiento conectado a Supabase

- `AuthService` usa Supabase Auth y consulta perfiles y solicitudes de verificacion en PostgreSQL.
- `roleGuard` protege los paneles por rol despues de restaurar la sesion.
- El panel admin lista y aprueba o rechaza organizaciones pendientes mediante RLS.
- Los paneles de donaciones, solicitudes, entregas e informes todavia contienen datos de demostracion.

La autenticacion y los perfiles se guardan en Supabase. Los guards del navegador solo protegen la navegacion; RLS en PostgreSQL protege los datos. El rol admin se asigna desde SQL Editor y no se puede elegir en el registro publico.

## Supabase y persistencia actual

La aplicacion usa Supabase Auth para correo/contrasena y Google, y Supabase PostgreSQL para perfiles, organizaciones, voluntariado, alimentos, donaciones, solicitudes, entregas, notificaciones, incidencias y reputacion. El esquema inicial con RLS esta en `supabase/migrations/20261020000000_foodshare_initial.sql`. Las instrucciones para crear el proyecto y configurar el primer administrador estan en `supabase/README.md`.

La interfaz solo recibe `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. RLS controla los accesos; nunca pongas una llave `secret`/`service_role` en el navegador. Un trigger de Auth crea los perfiles. Las organizaciones quedan pendientes hasta que administracion las apruebe.

`compose.yaml` levanta solo la interfaz Ionic y lee la configuracion Supabase de `.env`. Los scripts `database/sqlserver` y la API ASP.NET Core se conservan como legado y ya no forman parte del arranque.

## Requerimientos trabajados y estado

1. **Formularios reactivos:** login y registro usan Angular Reactive Forms y Supabase Auth; PostgreSQL crea el perfil mediante un trigger.
2. **Validación por perfil:** están implementadas las validaciones del donante, beneficiaria y voluntariado descritas arriba.
3. **Sesion y rol:** la sesion activa se valida mediante Supabase Auth y el rol persistente de `profiles`.
4. **Protección de rutas:** guards implementados para los paneles y sus roles.
5. **Redirección tras login:** implementada según el rol, respetando la ruta solicitada cuando corresponde.
6. **Panel de beneficiarias:** existe una vista propia por rol con búsqueda, filtros, detalle, solicitudes e historial de ejemplo.
7. **Supabase:** registro, login, Google y revision administrativa de instituciones estan conectados. Donaciones, solicitudes, entregas e informes conservan partes de demostracion pendientes de conexion.

## Proximos pasos

1. Conectar los servicios Angular de donaciones, solicitudes y entregas a Supabase con politicas RLS especificas.
2. Reemplazar datos demostrativos por consultas persistentes y agregar estados de carga y error.
3. Configurar URLs de Auth, proveedor Google y secretos de entorno para produccion.
