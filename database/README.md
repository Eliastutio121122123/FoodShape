# Base de datos

La base activa para FoodShare es Supabase PostgreSQL. El esquema actual y las políticas de acceso están en [`supabase/migrations`](../supabase/migrations), y los pasos para configurar proyecto, Auth, Google y administrador están en [`supabase/README.md`](../supabase/README.md).

Los scripts de `database/sqlserver` se conservan como referencia del esquema anterior; Docker Compose ya no inicia la API SQL Server.
