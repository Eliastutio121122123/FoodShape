# Base de datos FoodShare

`sqlserver/001_initial_schema.sql` crea `FoodShareDb`, el esquema `foodshare`, sus tablas, restricciones, índices y catálogos iniciales.

## Ejecución

1. Conéctate a SQL Server Management Studio con una cuenta administradora.
2. Ejecuta `sqlserver/001_initial_schema.sql`.
3. Sigue las instrucciones de `../api/FoodShare.Api/README.md` para crear un login SQL restringido y configurar la API.

El script inicial no contiene organizaciones, personas ni donaciones reales; solo crea roles y catálogos.

## Seguridad

Angular nunca se conecta directamente a SQL Server ni contiene credenciales de base de datos. La API ASP.NET Core es la intermediaria. No uses `sa` como login de la API. La contraseña `sa` fue compartida en el chat y debe rotarse antes de continuar; no la agregues al repositorio ni la compartas de nuevo.