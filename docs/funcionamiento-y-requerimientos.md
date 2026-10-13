# FoodShare: funcionamiento y requerimientos

## Objetivo

FoodShare conecta organizaciones donantes que ofrecen alimentos, organizaciones beneficiarias que solicitan esos alimentos, personas voluntarias que apoyan con las entregas y administradores que verifican las organizaciones y supervisan la plataforma.

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

## Funcionamiento actual de la demostración

- `AuthService` mantiene la sesión y las solicitudes de verificación en `localStorage`.
- `roleGuard` protege los paneles de administración, donante, beneficiaria y voluntariado.
- El panel de beneficiarias consulta donaciones y solicitudes de los Angular Services con datos temporales en memoria.
- El panel admin aprueba o rechaza las organizaciones registradas en ese mismo navegador.
- Los demás paneles conservan partes de su contenido con datos de diseño de ejemplo.

Por usar almacenamiento del navegador, el registro y la aprobación se comparten solo dentro del mismo perfil de navegador. No equivalen a autenticación segura: durante la demostración se puede elegir un rol y la contraseña no se valida contra un servidor. En producción, la API debe verificar credenciales, estado de aprobación y permisos, y emitir la sesión únicamente después de autenticar al usuario. No se deben confiar roles almacenados por el cliente.

## API y SQL Server

La API ASP.NET Core está en `api/FoodShare.Api` y se conecta a SQL Server mediante `FOODSHARE_SQLSERVER_CONNECTION`. El servicio de Angular nunca debe conectarse directamente a SQL Server.

Endpoints disponibles en esta etapa:

- `GET /health`: estado del proceso API.
- `GET /health/database`: comprueba conexión y devuelve el nombre de la base de datos, sin revelar la cadena de conexión.
- `GET /api/donations/available`: lista pública y de solo lectura con campos limitados de donaciones disponibles de organizaciones verificadas.

El script `database/sqlserver/002_api_read_access.sql` crea la vista pública y un login SQL restringido a esa vista. El endpoint todavía no está conectado a todos los Angular Services. Aún faltan los endpoints autenticados para registro, inicio de sesión, solicitudes de donación, gestión por roles y revisión persistente de organizaciones.

Para ejecución local, sigue `api/FoodShare.Api/README.md`. Copia `.env.example` a `.env`, configura el secreto del usuario SQL restringido y ejecuta `docker compose up --build`. No guardes contraseñas en el código, en archivos Angular ni en Git. La contraseña de `sa` que se compartió durante la configuración debe cambiarse y no debe usarse como cuenta de la API.

## Requerimientos trabajados y estado

1. **Formularios reactivos:** login y registro están implementados con Angular Reactive Forms.
2. **Validación por perfil:** están implementadas las validaciones del donante, beneficiaria y voluntariado descritas arriba.
3. **Sesión temporal y rol:** implementados en `AuthService`; la sesión demostrativa queda en el navegador.
4. **Protección de rutas:** guards implementados para los paneles y sus roles.
5. **Redirección tras login:** implementada según el rol, respetando la ruta solicitada cuando corresponde.
6. **Panel de beneficiarias:** existe una vista propia por rol con búsqueda, filtros, detalle, solicitudes e historial de ejemplo.
7. **Servicios y API:** existen servicios temporales; donaciones y solicitudes alimentan algunas vistas de beneficiarias. La base de la API y una consulta pública de lectura están creadas. La conexión de todos los paneles, la autenticación real y la autorización de operaciones privadas siguen pendientes.

## Próximos pasos

1. Conectar el formulario de registro con la API y persistir organizaciones como pendientes.
2. Implementar autenticación real y validar el estado de verificación en el servidor antes de emitir una sesión.
3. Crear endpoints con autorización por rol para aprobar/rechazar organizaciones y gestionar donaciones, solicitudes y entregas.
4. Reemplazar los datos en memoria de Angular por llamadas HTTP a la API y manejar estados de carga y error.
5. Configurar HTTPS y secretos de producción; usar un usuario SQL de privilegios mínimos y un certificado de SQL Server confiable.
