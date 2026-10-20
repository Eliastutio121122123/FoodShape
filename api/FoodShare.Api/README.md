# API ASP.NET Core anterior

La aplicacion ya no levanta este servicio. El flujo activo de autenticacion, perfiles y administracion usa Supabase Auth y PostgreSQL desde Angular con RLS; `compose.yaml` solo inicia el contenedor web.

Este directorio y `database/sqlserver` se conservan como referencia del intento anterior con SQL Server. No configures ni expongas sus credenciales para ejecutar el entorno actual. La migracion activa y sus pasos estan en [`supabase/README.md`](../../supabase/README.md).
