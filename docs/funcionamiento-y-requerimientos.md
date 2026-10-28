# FoodShare: funcionamiento, requerimientos y estado

**Estado revisado:** 27 de octubre de 2026.

Este documento conserva el alcance funcional acordado y describe quÃ© partes estÃ¡n implementadas en el cÃ³digo, cuÃ¡les existen solo en la base de datos y cuÃ¡les aÃºn estÃ¡n pendientes. Una tabla o una pantalla por sÃ­ sola no significa que una funcionalidad estÃ© completa: para considerarla conectada, el flujo debe guardar y leer datos persistentes y aplicar los permisos correspondientes.

## 1. Contexto general

FoodShare busca conectar organizaciones donantes que ofrecen alimentos, organizaciones beneficiarias que los solicitan, personas voluntarias que apoyan en la recogida y entrega, y administradores que revisan instituciones y supervisan la plataforma.

La aplicaciÃ³n estÃ¡ desarrollada con Ionic y Angular. La autenticaciÃ³n y los datos principales se estÃ¡n migrando de SQL Server a Supabase Auth y Supabase PostgreSQL. La migraciÃ³n inicial estÃ¡ en `supabase/migrations/20261020000000_foodshare_initial.sql` y define perfiles, organizaciones, voluntariado, categorÃ­as, donaciones, solicitudes, entregas, notificaciones, incidencias, reputaciÃ³n y configuraciÃ³n, ademÃ¡s de polÃ­ticas RLS y un trigger para crear perfiles al registrar usuarios.

`compose.yaml` levanta la aplicaciÃ³n web en el puerto `8100`. La API ASP.NET Core y SQL Server se conservan en el repositorio como legado; no son parte del flujo actual de Compose. El repositorio local trabaja en la rama `master`; la rama `main` que muestra Supabase corresponde a su base de producciÃ³n, no al nombre de la rama local de Git.

## 2. Estado operativo conocido

- **Compilacion web:** la configuracion de desarrollo compilo correctamente despues de los cambios recientes del panel, catalogos, reportes y autenticacion. La ultima compilacion de produccion documentada excedio los limites de estilos configurados en Angular; conviene volver a revisarla antes de publicar.
- **Esquema remoto:** se pudo consultar `public.profiles` desde SQL Editor; por tanto, esa tabla existe en el proyecto Supabase. El archivo de migraciÃ³n tambiÃ©n existe en el repositorio.
- **AutenticaciÃ³n remota:** se observÃ³ una cuenta creada en la secciÃ³n Auth de Supabase. Esto no confirma que tenga perfil administrativo ni que el registro desde la aplicaciÃ³n funcione.
- **Conectividad Supabase comprobada parcialmente:** el endpoint de Auth y el preflight CORS respondieron HTTP 200 desde el entorno local; la clave publishable configurada fue aceptada por Supabase. Sin embargo, el navegador sigue mostrando que no puede conectar con Auth. Falta identificar en DevTools la solicitud y causa exacta.
- **Administrador:** se pudo acceder al panel ` /app/admin ` en la sesion actual. Aun falta confirmar en Supabase que el perfil tenga `role = 'admin'` y `status = 'active'` para verificar que el acceso persiste correctamente.
- **ConfiguraciÃ³n:** la interfaz usa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` desde `.env`; la clave `secret`/`service_role` nunca debe incorporarse al frontend. DespuÃ©s de cambiar `.env`, hay que recrear el servicio web para que regenere la configuraciÃ³n de ejecuciÃ³n.

La respuesta HTTP 200 y el preflight CORS desde el entorno local no confirman que el navegador complete el inicio de sesion o el registro; ese flujo sigue pendiente de diagnostico.

## 3. Requerimientos funcionales y estado

Estados usados:

- **Implementado:** el flujo principal tiene conexiÃ³n persistente y permisos configurados.
- **Parcial:** existe una parte en la interfaz, servicios, esquema o polÃ­ticas, pero falta completar o verificar el flujo integral.
- **Pendiente:** funciona con datos demostrativos o no estÃ¡ desarrollado/conectado a Supabase.

### 3.1 Cuentas, perfiles y permisos

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 1 | Registro de usuarios | Parcial | Hay formularios por rol y una llamada a Supabase Auth. El trigger crea el perfil y los datos de organizacion o voluntariado. El endpoint Auth responde HTTP 200 desde el entorno local, pero en la interfaz se observo `Failed to fetch`; falta capturar y confirmar el registro completo en el navegador. |
| 2 | Inicio de sesion y autenticacion | Parcial | El servicio implementa acceso con correo y contrasena y restauracion de sesion. Tras iniciar sesion, la app abre primero la pantalla Mi perfil; desde alli se puede volver al panel del rol. La conexion fue exitosa en la captura reciente (HTTP 200). |
| 3 | Gestion de perfiles y roles | Parcial | Hay una pantalla comun de perfil para los cuatro roles. El usuario puede editar nombre y telefono; correo y rol son de solo lectura. Los datos institucionales y de voluntariado se muestran, pero aun no se editan desde esta pantalla. |
| 30 | Permisos segun el rol | Parcial | Hay guards de Angular y politicas RLS en la migracion. Falta integrar las operaciones de negocio restantes y validar los permisos en el proyecto remoto. |

### 3.2 Instituciones y voluntariado

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 4 | Registro y gestion de instituciones donantes | Parcial | El registro crea la organizacion en Supabase. El panel administrativo consulta estados pendiente, verificada y rechazada, permite buscar y aprobar o rechazar pendientes; falta completar la gestion de datos institucionales.
| 5 | Registro y gestion de instituciones beneficiarias | Parcial | El registro crea la organizacion en Supabase. El panel administrativo consulta estados pendiente, verificada y rechazada, permite buscar y aprobar o rechazar pendientes; falta completar la gestion de datos institucionales.
| 6 | Registro y gestiÃ³n de voluntarios | Parcial | El trigger crea `volunteer_profiles`. La ediciÃ³n persistente del perfil y de disponibilidad aÃºn no estÃ¡ conectada. |
| 24 | Gestion administrativa de usuarios e instituciones | Parcial | La lista de usuarios y las vistas por estado de las instituciones consultan Supabase. Se puede buscar, aprobar y rechazar instituciones pendientes. La gestion de estados de cuentas y otras areas del panel siguen pendientes.

### 3.3 Alimentos y donaciones

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 7 | PublicaciÃ³n de donaciones | Pendiente | La tabla `donations` existe en la migraciÃ³n, pero `DonationService` usa datos en memoria. |
| 8 | EdiciÃ³n y cancelaciÃ³n de donaciones | Pendiente | La cancelaciÃ³n y los cambios de estado actuales se realizan sobre datos en memoria; falta persistirlos. |
| 9 | Informacion y categorias de alimentos | Parcial | El panel permite consultar, agregar y activar/desactivar categorias en `food_categories`. Falta aplicar la migracion remota y conectar el selector del formulario de donaciones, que aun es demostrativo. |
| 10 | Consulta de donaciones disponibles | Pendiente | La pantalla consulta el servicio en memoria, no la tabla remota. |
| 11 | BÃºsqueda y filtrado de donaciones | Parcial | La interfaz permite buscar y filtrar por categorÃ­a sobre datos demostrativos. Faltan consulta persistente y filtros completos por ubicaciÃ³n y fecha. |
| 12 | GestiÃ³n de disponibilidad | Pendiente | Hay estados y polÃ­ticas en la base y cambios en el servicio en memoria; falta conectar las transiciones a PostgreSQL. |

### 3.4 Solicitudes y reservas

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 13 | Solicitud de donaciones | Pendiente | La pantalla crea solicitudes de ejemplo mediante `DonationRequestService`, que almacena datos en memoria. |
| 14 | AceptaciÃ³n, rechazo y cancelaciÃ³n de solicitudes | Pendiente | Los mÃ©todos actuales operan en memoria. La revisiÃ³n persistente implementada es la de solicitudes de instituciones, no la de solicitudes de donaciÃ³n. |
| 15 | Reserva de donaciones | Pendiente | La relaciÃ³n y los estados estÃ¡n definidos en el esquema, pero la reserva de la app no estÃ¡ conectada a Supabase. |
| 16 | GestiÃ³n de estados de donaciones y solicitudes | Pendiente | Hay modelos y transiciones de ejemplo; hace falta persistirlas y asegurar consistencia entre tablas. |

### 3.5 Recogida y entrega
    
| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 17 | AsignaciÃ³n de voluntarios | Pendiente | `DeliveryService` asigna sobre datos en memoria. La tabla remota estÃ¡ definida, pero la asignaciÃ³n no estÃ¡ conectada. |
| 18 | Fechas y horarios de recogida y entrega | Parcial | El esquema contempla vencimiento y horarios de recogida. Falta completar el flujo persistente y su interfaz de entregas. |
| 19 | GestiÃ³n de recogida y entrega | Pendiente | El servicio modela estados localmente; los cambios no quedan guardados en Supabase. |
| 22 | Registro y consulta de entregas realizadas | Pendiente | Existe la tabla `deliveries`, pero las pantallas/servicios aÃºn no la consultan ni actualizan. |

### 3.6 Notificaciones, historial e incidencias

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 20 | Notificaciones a usuarios | Pendiente | Hay tabla y un servicio en memoria; faltan persistencia y generaciÃ³n de notificaciones por eventos. |
| 21 | Historial de donaciones y solicitudes | Pendiente | Las vistas muestran informaciÃ³n de ejemplo; no hay historial persistente conectado. |
| 27 | GestiÃ³n de incidencias o reportes | Pendiente | La tabla `incidents` estÃ¡ definida; faltan formularios, consultas y gestiÃ³n desde la aplicaciÃ³n. |

### 3.7 AdministraciÃ³n, reportes y plataforma

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 25 | Generacion de reportes | Parcial | Consulta donaciones y entregas por periodo desde Supabase, muestra totales y desglose por categoria, y exporta el resumen y sus registros a CSV. No genera PDF y falta verificar el flujo con datos reales en el proyecto remoto. |
| 28 | GestiÃ³n de ubicaciones | Parcial | El esquema almacena direcciones y ciudades, ademÃ¡s de coordenadas opcionales para donaciones. Faltan geolocalizaciÃ³n y filtros remotos por ubicaciÃ³n. |
| 29 | Configuración de plataforma | Parcial | Apartado de Configuración administrativo implementado con cuatro módulos: Cuenta administrativa (consulta de perfil, edición de datos personales y cambio de contraseña seguro en Supabase Auth), Notificaciones (control maestro y alertas por evento y canal con persistencia local), Idioma y región (idioma, zona horaria, formatos de fecha y unidades de peso kg/lb con persistencia local) y Seguridad (supervisión de sesión activa, proveedor Supabase Auth y cierre de sesión seguro). |

### 3.8 EstadÃ­sticas e impacto

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 23 | Estadisticas e impacto | Parcial | El dashboard y reportes consultan donaciones y entregas desde Supabase. El peso se estima solo para kg, g y lb; faltan indicadores de impacto completos y confirmar datos historicos en el proyecto remoto. |
| 26 | PuntuaciÃ³n o reputaciÃ³n | Pendiente | La tabla `reputations` estÃ¡ definida; faltan flujos para evaluar y consultar reputaciones. |

## 4. Funciones conectadas actualmente

1. **Autenticacion y perfiles:** `AuthService` usa Supabase Auth para registro, inicio de sesion por contrasena y OAuth con Google. La creacion del perfil depende del trigger incluido en la migracion. El endpoint Auth y el preflight CORS responden desde el entorno local, pero el formulario mostro `Failed to fetch`; el flujo desde navegador sigue pendiente de diagnostico.
2. **Control de sesiÃ³n y rutas:** se restaura la sesiÃ³n y los guards protegen los paneles segÃºn el rol almacenado en `profiles`.
3. **Revision de organizaciones:** el panel administrativo consulta instituciones pendientes, verificadas y rechazadas, permite buscar por nombre, correo o representante y actualiza aprobacion/rechazo en Supabase con RLS.
4. **Perfil personal:** todos los paneles muestran una entrada de perfil con el correo de la sesion. La pagina comun obtiene nombre, correo, telefono y rol del perfil autenticado; permite cambiar nombre y telefono, muestra informacion asociada de organizaciones o voluntariado e incluye cierre de sesion local. Despues de iniciar sesion con correo o Google, se abre primero esta pantalla.
5. **Dashboard administrativo:** las tarjetas, la distribucion de donaciones activas, los ultimos seis meses de cantidades publicadas y las donaciones recientes se consultan desde Supabase. Las cantidades se convierten a kg solo para unidades kg, g y lb.
6. **Reportes administrativos:** consulta donaciones no canceladas creadas en el periodo y entregas completadas cuya fecha de entrega cae en ese periodo. Permite descargar un CSV con totales, desglose por categoria y donaciones. Los kg solo se estiman para unidades kg, g y lb.
7. **Esquema y permisos base:** la migracion inicial define tablas y politicas RLS. Que una tabla exista no significa que todos los servicios Angular esten conectados.
8. **Retorno al panel desde la pagina publica:** con una sesion activa, el boton superior de la landing lleva al panel del rol autenticado; para administracion muestra `Volver a administracion`. Sin sesion, mantiene el acceso a `Iniciar sesion`.
9. **Configuración administrativa:** el panel de administración dispone de un apartado completo de Configuración dividido en cuatro módulos operativos:
   - **Cuenta administrativa:** consulta de perfil, edición persistente de nombre y teléfono mediante `auth.updateAccountProfile`, actualización de contraseña con `supabase.auth.updateUser` y cierre de sesión.
   - **Notificaciones:** control global maestro, configuración de alertas operativas (instituciones pendientes, nuevos usuarios, donaciones y entregas) y canales (web, correo, resumen diario) con persistencia local en `localStorage`.
   - **Idioma y región:** ajustes regionales adaptados a República Dominicana (idioma, zona horaria, formatos de fecha y unidades métricas kg/lb) con persistencia local.
   - **Seguridad y sesiones:** monitoreo de sesión activa, identificación del proveedor Supabase Auth, estatus de políticas RLS y accesos directos de administración de credenciales.

## 5. Catalogos administrativos

El panel de administracion permite consultar, agregar y activar/desactivar categorias de alimentos y tipos de organizacion, separados entre donantes y beneficiarias. Las opciones de tipo de organizacion de los formularios de registro se cargan desde `organization_categories`; la opcion "Otro" para beneficiarios permanece disponible. Las categorias desactivadas se conservan para no perder referencias historicas.

La migracion `supabase/migrations/20261025000000_foodshare_admin_catalogs.sql` agrega la tabla de tipos de organizacion, opciones iniciales y politicas RLS de administracion. Debe aplicarse al proyecto remoto antes de usar la gestion. Si Supabase CLI esta instalada y el proyecto vinculado, ejecuta `supabase db push` desde `foodshape`; alternativamente, pega el contenido del archivo en Supabase Dashboard > SQL Editor y ejecutalo. No se confirmo su aplicacion remota en esta revision.

El formulario para publicar donaciones todavia es demostrativo y conserva opciones estaticas. Su selector se conectara al catalogo cuando se implemente la publicacion persistente.

## 6. Datos demostrativos

Los servicios siguientes heredan de `InMemoryCrudService` y no persisten datos en Supabase:

- Donaciones y disponibilidad.
- Solicitudes y reservas.
- Entregas y asignaciones de voluntarios.
- Organizaciones, usuarios, voluntariado y notificaciones a traves de los servicios CRUD genericos, que aun usan memoria. Las pantallas administrativas de usuarios e instituciones y los catalogos no usan esos servicios: consultan Supabase directamente.

Las pantallas de donantes, beneficiarios y voluntariado aun muestran ejemplos. Sus operaciones de negocio no quedan guardadas entre sesiones. El dashboard y los reportes administrativos consultan datos de Supabase, aunque sus resultados dependen de que existan registros reales y permisos adecuados.

## 7. Proximos pasos recomendados

1. **Resolver el error de Auth desde el navegador:** en DevTools > Network capturar la solicitud que falla al registrarse o iniciar sesion, revisar URL, estado y respuesta; no compartir tokens ni claves. El endpoint y CORS ya respondieron desde el entorno local, asi que se necesita identificar la llamada real.
2. **Confirmar las cuentas y aprobaciones:** comprobar en Supabase que la cuenta administradora tenga `role = 'admin'` y `status = 'active'`, y validar aprobacion de una institucion y acceso posterior.
3. **Completar el apartado de perfil:** permitir edicion persistente de los datos de organizacion y voluntariado, con validacion y permisos RLS.
4. **Conectar donaciones a Supabase:** implementar publicacion, consulta, filtros, edicion, cancelacion y transiciones de estado; retirar los datos en memoria de ese flujo.
5. **Conectar solicitudes y reservas:** implementar solicitud, aceptar, rechazar y cancelar, garantizando que una donacion no quede reservada por mas de una solicitud aceptada.
6. **Conectar entregas:** asignar voluntarios, guardar horarios y estados de recogida/entrega, y mostrar el historial persistente.
7. **Completar administracion y seguimiento:** habilitar acciones seguras sobre cuentas, confirmar la migracion de catalogos en el proyecto remoto y completar notificaciones, incidencias y reputacion.
8. **Revisar RLS y preparar despliegue:** comprobar cada operacion por rol y resolver los limites de estilos de la compilacion de produccion antes de publicar.

## 8. Reglas para futuros cambios

- Mantener Supabase como persistencia prevista para la aplicaciÃ³n; SQL Server y la API ASP.NET Core son legado mientras no se decida lo contrario.
- No exponer claves `secret` o `service_role` en Angular, `.env.example`, el bundle del navegador ni GitHub.
- Cualquier nuevo flujo persistente debe tener migraciÃ³n, polÃ­ticas RLS, integraciÃ³n Angular, estados de carga/error y actualizaciÃ³n de esta lista de estado.
- No marcar un requerimiento como implementado mientras use datos de `InMemoryCrudService` o no se haya comprobado el flujo completo contra Supabase.
