# FoodShare: funcionamiento, requerimientos y estado

**Estado revisado:** 15 de noviembre de 2026.

## Actualización del 15 de noviembre de 2026: organización donante

Esta actualización reemplaza las descripciones anteriores de los requerimientos 7–16 y 21–22 **para el panel de la organización donante**. El flujo del mercado y la creación de solicitudes desde el panel beneficiario siguen siendo demostrativos y se detallan en la sección 6.

### Funciones del donante conectadas

- **Inicio:** el dashboard consulta en Supabase las donaciones de la organización, solicitudes pendientes, entregas confirmadas, actividad reciente y métricas. Las donaciones ocultas no cuentan como disponibles para otras organizaciones.
- **Publicar donaciones:** el formulario carga categorías activas y la dirección registrada de la organización, valida nombre, cantidad, unidad y fechas, guarda los datos en `public.donations` y permite cargar fotos al bucket `foodshare-donations`.
- **Mis donaciones:** consulta publicaciones persistentes; incluye búsqueda, filtros por estado y ocultas, cantidades, vencimientos, foto y estado de solicitudes. Las unidades técnicas se presentan en español.
- **Detalle y mantenimiento:** cada publicación abre una ficha con imagen, descripción, categoría, cantidad, horarios, vencimiento, dirección y solicitudes. El menú de tres puntos permite editar publicaciones disponibles sin solicitudes, ocultar o volver a mostrar una publicación y eliminarla cuando no tiene solicitudes relacionadas. El borrado conserva las restricciones de integridad; cuando hay solicitudes, se debe ocultar y conservar el registro.
- **Solicitudes recibidas:** el panel consulta solicitudes persistentes, muestra la organización solicitante y los datos de recogida, filtra pendientes/aceptadas/finalizadas y procesa aceptar o rechazar mediante `review_donation_request`. La aceptación reserva la donación y las solicitudes pendientes restantes se rechazan de forma transaccional.
- **Historial:** consulta entregas completadas y calcula alimentos entregados, entregas confirmadas y organizaciones apoyadas.
- **Foto de perfil:** la barra lateral del panel donante muestra la foto guardada en el perfil; usa las iniciales como alternativa si no hay foto.
- **Correcciones visuales:** las tarjetas mantienen visibles los datos aunque haya foto; el botón «Ver detalle» abre la ficha; el menú de tres puntos usa opciones legibles y no hereda la forma circular del botón.
- **Registro de organizaciones:** se corrigió el solapamiento del botón «Enviar registro» con los campos del formulario, que podía interceptar clics al desplazarse. RNC se declara como texto numérico con autocompletado desactivado y longitud limitada; teléfono usa el tipo telefónico. El ajuste aplica a los formularios de donantes y beneficiarias.

### Migraciones y permisos requeridos

- `20261109180000_donor_request_inbox.sql`: añade cantidad y mensaje a solicitudes y la función segura para revisarlas.
- `20261115100000_foodshare_donation_images.sql`: agrega `image_path`, bucket y políticas de imágenes.
- `20261115120000_foodshare_donation_storage_rls_fix.sql`: corrige la comprobación de permisos para subir imágenes.
- `20261115150000_foodshare_donor_donation_management.sql`: agrega `donations.is_visible`, limita lecturas/solicitudes de publicaciones ocultas y restringe el borrado a publicaciones sin solicitudes.

Las migraciones y el código están versionados en GitHub. La ejecución remota de SQL se hizo manualmente desde Supabase; no se confirma desde este repositorio el estado actual de cada migración. El 15 de noviembre se detectaron errores por las columnas `quantity_requested` e `is_visible` ausentes; después se vio el dashboard con publicaciones y una de ellas marcada como «Oculta», lo que confirma que la columna de visibilidad estaba disponible en esa captura. Si vuelven a aparecer errores de columna, revisar que se ejecutó el archivo correspondiente en el mismo proyecto Supabase configurado para la web.

### Estado pendiente relacionado

- El panel de beneficiarios todavía usa `DonationService` y `DonationRequestService` con datos en memoria. Por eso, la búsqueda y creación de solicitudes desde el mercado beneficiario aún no consumen estas donaciones persistentes. La política RLS ya impide consultar publicaciones ocultas mediante Supabase; falta conectar el mercado y su flujo de solicitud a esas consultas.
- La aceptación/rechazo del lado donante y la confirmación final por la beneficiaria están conectadas; la creación/cancelación de solicitudes desde el mercado beneficiario todavía requiere integración adicional.
- `npx tsc -p tsconfig.app.json --noEmit` pasó. `npx ng build --configuration development --output-path .angular/codex-avatar-check` completó correctamente el 15 de noviembre. No se ejecutaron pruebas automatizadas.

### Cambios publicados

- `fe44e2c`: menú para editar, ocultar/mostrar y eliminar donaciones, con migración y políticas RLS.
- `b98ee9e`: corrección visual del menú de acciones.
- `c0fd494`: foto de perfil en la barra lateral del donante.
- También quedaron publicados los detalles de donación (`fbdf868`) y las correcciones de tarjeta con imagen (`0af5841`). El repositorio principal actualiza el puntero del subrepositorio en cada cambio.

Este documento conserva el alcance funcional acordado y describe quÃ© partes estÃ¡n implementadas en el cÃ³digo, cuÃ¡les existen solo en la base de datos y cuÃ¡les aÃºn estÃ¡n pendientes. Una tabla o una pantalla por sÃ­ sola no significa que una funcionalidad estÃ© completa: para considerarla conectada, el flujo debe guardar y leer datos persistentes y aplicar los permisos correspondientes.

## Actualización del 15 de noviembre de 2026: inicio de organización beneficiaria

- La ruta existente `/app/beneficiary` ahora carga un panel propio protegido por el rol `beneficiary`; el acceso al perfil conserva la ruta existente `/app/profile`. El menú de navegación de secciones se mantiene dentro de la ruta del panel porque el proyecto no define rutas independientes para buscar, solicitudes o historial.
- Se retiraron los accesos a los paneles de otros roles y los datos de demostración del inicio beneficiario. La pantalla consulta la organización y el perfil vinculados al usuario de Supabase autenticado, las donaciones públicas vigentes, sus solicitudes propias y notificaciones propias, respetando RLS.
- Las tarjetas de actividad muestran publicaciones disponibles, solicitudes pendientes, solicitudes aceptadas/en proceso y cantidades entregadas este mes, agrupadas por unidad. No hay coordenadas registradas para organizaciones beneficiarias, por lo que el panel no calcula ni afirma distancias o radio de cercanía. Se muestra la ciudad de la donación cuando existe.
- Desde las tarjetas se abre el detalle y se puede crear una solicitud real en `donation_requests` con cantidad y mensaje. La dirección de recogida solo se consulta y presenta para solicitudes aceptadas; el nombre y contacto del donante no se publican en el mercado.
- El panel presenta estados de carga, error/reintento, listas vacías y verificación pendiente. En móvil usa una navegación inferior compacta.
- Ajuste visual posterior: el Inicio y el panel tienen desplazamiento vertical propio con encabezado fijo y menú lateral persistente; en móvil se mantienen en una columna sin desbordamiento horizontal. La búsqueda alinea icono y texto, destaca foco/contraste, adapta los filtros a varias líneas y permite filtrar por categorías reales y ordenar por recientes, vencimiento o cantidad.
- La migración `20261115170000_beneficiary_requested_donation_read.sql` permite a una organización beneficiaria consultar publicaciones vinculadas a sus solicitudes aceptadas, para coordinar la recogida sin ampliar la lectura a solicitudes de otras organizaciones. Debe aplicarse al proyecto Supabase remoto antes de esperar la dirección después de una aceptación; este repositorio no confirma que ya se haya aplicado.

### Límites conocidos

- No existen rutas separadas para «Buscar donaciones», «Mis solicitudes» o «Historial»; son secciones locales del panel bajo `/app/beneficiary`. No existe ubicación de la beneficiaria para un cálculo de distancia ni seguimiento GPS.
- La búsqueda puede mostrar dirección de recogida y enlace a ruta estimada una vez aceptada la solicitud. No se afirma que el mapa se actualice en vivo; el destino utiliza la dirección de la organización beneficiaria y las coordenadas solo se usan cuando están disponibles y son válidas.
- El historial incluye entregas con estado `delivered` y confirmación de recepción por beneficiaria; las cantidades usan la solicitada (o la publicada cuando no se informó) y su unidad.

## Actualización del 15 de noviembre de 2026: coordinación y confirmación de entregas

- La aceptación del donante sigue usando `review_donation_request`. En una sola transacción reserva la donación, marca la solicitud como `accepted`, rechaza otras solicitudes pendientes del mismo alimento y crea el registro de `deliveries` en estado `pending`. Así la solicitud aceptada permanece visible en ambas organizaciones.
- «Solicitudes» del donante ahora muestra el alimento y cantidad, el estado del seguimiento, direcciones autorizadas de recogida y destino y un enlace a Google Maps cuando ambas ubicaciones tienen coordenadas válidas o direcciones utilizables. El enlace representa una ruta estimada, no seguimiento GPS en tiempo real. El donante puede ver cuándo la beneficiaria confirmó; no puede confirmar por ella.
- «Mis solicitudes» de la beneficiaria muestra el estado de coordinación y los próximos pasos. En solicitudes aceptadas puede abrir seguimiento y, cuando corresponde, confirmar la recepción. La acción llama a `confirm_beneficiary_delivery`; un envío repetido se rechaza en la base de datos y la interfaz refresca solicitudes e historial.
- `deliveries.status` reutiliza `pending`, `assigned`, `pickup_in_progress`, `picked_up`, `delivered` y `cancelled`; `donation_requests.status` conserva `accepted` y solo pasa a `delivered` el registro de entrega. `donations.status` termina en `delivered` después de la confirmación. Los campos `received_confirmed_at` y `received_confirmed_by` registran la confirmación verificable de la beneficiaria.
- Nueva migración `supabase/migrations/20261115200000_beneficiary_delivery_confirmation.sql`: añade los campos de confirmación, crea entregas faltantes para solicitudes aceptadas, actualiza la RPC de aceptación, impide cambios directos a estados de solicitud/confirmación y añade la RPC segura de confirmación. La confirmación exige que la sesión sea propietaria de la organización beneficiaria asociada. RLS mantiene lectura limitada a las partes autorizadas y al voluntario asignado.
- Inicio del donante, métricas recibidas de la beneficiaria e historial filtran por confirmación registrada para que un estado `delivered` no se interprete como recepción confirmada sin el actor beneficiario. Una entrega marcada `delivered` por datos anteriores sin campos de confirmación se presenta como pendiente de confirmación y no ingresa al historial confirmado.
- La migración debe aplicarse al proyecto Supabase remoto antes de usar el flujo; no se ejecutó SQL remoto en esta tarea. No hay ubicación GPS de destino ni servicio de seguimiento en vivo en el proyecto. Cuando falten direcciones o coordenadas, se muestra lo disponible y se omite el enlace de ruta que no se pueda construir.

## 1. Contexto general

FoodShare busca conectar organizaciones donantes que ofrecen alimentos, organizaciones beneficiarias que los solicitan, personas voluntarias que apoyan en la recogida y entrega, y administradores que revisan instituciones y supervisan la plataforma.

La aplicaciÃ³n estÃ¡ desarrollada con Ionic y Angular. La autenticaciÃ³n y los datos principales se estÃ¡n migrando de SQL Server a Supabase Auth y Supabase PostgreSQL. La migraciÃ³n inicial estÃ¡ en `supabase/migrations/20261020000000_foodshare_initial.sql` y define perfiles, organizaciones, voluntariado, categorÃ­as, donaciones, solicitudes, entregas, notificaciones, incidencias, reputaciÃ³n y configuraciÃ³n, ademÃ¡s de polÃ­ticas RLS y un trigger para crear perfiles al registrar usuarios.

`compose.yaml` levanta la aplicaciÃ³n web en el puerto `8100`. La API ASP.NET Core y SQL Server se conservan en el repositorio como legado; no son parte del flujo actual de Compose. El repositorio local trabaja en la rama `master`; la rama `main` que muestra Supabase corresponde a su base de producciÃ³n, no al nombre de la rama local de Git.

## 2. Estado operativo conocido

- **Compilacion web:** la configuracion de desarrollo compilo correctamente despues de cambios recientes del panel, catalogos, reportes y autenticacion. La ultima compilacion de produccion documentada excedio los limites de estilos configurados en Angular; conviene volver a revisarla antes de publicar.
- **Esquema remoto:** se pudo consultar `public.profiles` desde SQL Editor; por tanto, esa tabla existe en el proyecto Supabase. El archivo de migraciÃ³n tambiÃ©n existe en el repositorio.
- **AutenticaciÃ³n remota:** se observaron errores distintos en momentos diferentes: una respuesta HTTP 400 de Auth por correo sin confirmar y, posteriormente, el mensaje de FoodShare que indica que la organizacion sigue pendiente. El segundo mensaje significa que Auth acepto las credenciales, pero el perfil o la organizacion no cumplio la validacion de acceso.
- **Conectividad Supabase comprobada parcialmente:** el endpoint de Auth y el preflight CORS respondieron HTTP 200 desde el entorno local; la clave publishable configurada fue aceptada por Supabase. Esto no verifica que las migraciones nuevas se hayan aplicado en el proyecto remoto.
- **Administrador:** se pudo acceder al panel ` /app/admin ` en la sesion actual y la captura muestra la institucion en la pestaña Verificadas. Aun falta comprobar que la migracion de sincronizacion de aprobacion y acceso se haya ejecutado en Supabase y que la fila correspondiente tenga estados consistentes.
- **ConfiguraciÃ³n:** la interfaz usa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` desde `.env`; la clave `secret`/`service_role` nunca debe incorporarse al frontend. DespuÃ©s de cambiar `.env`, hay que recrear el servicio web para que regenere la configuraciÃ³n de ejecuciÃ³n.

La conectividad HTTP y CORS se comprobo parcialmente desde el entorno local. El flujo de inicio de sesion sigue pendiente de validacion integral contra el proyecto Supabase remoto, en particular la ejecucion de las migraciones recientes y los estados de la cuenta institucional aprobada.

## 3. Requerimientos funcionales y estado

Estados usados:

- **Implementado:** el flujo principal tiene conexiÃ³n persistente y permisos configurados.
- **Parcial:** existe una parte en la interfaz, servicios, esquema o polÃ­ticas, pero falta completar o verificar el flujo integral.
- **Pendiente:** funciona con datos demostrativos o no estÃ¡ desarrollado/conectado a Supabase.

### 3.1 Cuentas, perfiles y permisos

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 1 | Registro de usuarios | Parcial | Hay formularios por rol y una llamada a Supabase Auth. El trigger crea el perfil y los datos de organizacion o voluntariado. La conectividad del endpoint se comprobo desde el entorno local, pero falta validar el registro completo con el proyecto remoto y sus migraciones actualizadas. |
| 2 | Inicio de sesion y autenticacion | Parcial | El servicio implementa acceso con correo y contrasena, OAuth con Google y restauracion de sesion. Para organizaciones se requiere `profiles.status = 'active'`, `organizations.verification_status = 'approved'` y `organizations.status = 'active'`. El codigo y la migracion sincronizan estos estados al aprobar; la ejecucion remota de la migracion aun debe confirmarse. Tras el acceso, la app abre Mi perfil y permite volver al panel del rol. |
| 3 | Gestion de perfiles y roles | Parcial | Hay una pantalla comun de perfil para los cuatro roles. El usuario puede editar nombre y telefono; correo y rol son de solo lectura. El editor de foto usa Supabase Storage y `profiles.avatar_path`; falta aplicar la migracion `20261104000000_foodshare_profile_avatars_storage.sql` en el proyecto remoto. Los datos institucionales y de voluntariado se muestran, pero aun no se editan desde esta pantalla. |
| 30 | Permisos segun el rol | Parcial | Hay guards de Angular y politicas RLS en la migracion. Falta integrar las operaciones de negocio restantes y validar los permisos en el proyecto remoto. |

### 3.2 Instituciones y voluntariado

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 4 | Registro y gestion de instituciones donantes | Parcial | El registro crea la organizacion en Supabase. El panel permite consultar y revisar solicitudes. La migracion `20261104120000_confirm_organization_email_on_approval.sql` confirma el correo Auth y activa el perfil de organizaciones aprobadas; su aplicacion remota no esta confirmada. Falta completar la gestion de datos institucionales.
| 5 | Registro y gestion de instituciones beneficiarias | Parcial | El registro crea la organizacion en Supabase. El panel permite consultar y revisar solicitudes. La migracion `20261104120000_confirm_organization_email_on_approval.sql` confirma el correo Auth y activa el perfil de organizaciones aprobadas; su aplicacion remota no esta confirmada. Falta completar la gestion de datos institucionales.
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

1. **Autenticacion y perfiles:** `AuthService` usa Supabase Auth para registro, inicio de sesion por contrasena y OAuth con Google. La creacion del perfil depende del trigger incluido en la migracion. Se identificaron causas distintas: metadata `avatar_url` excesiva que generaba HTTP 520 en la API REST, correos sin confirmar que reciben HTTP 400, y perfiles/organizaciones con estados pendientes que son rechazados despues de autenticar. Para organizaciones, la migracion `20261104120000_confirm_organization_email_on_approval.sql` sincroniza confirmacion de correo y activacion del perfil con la aprobacion administrativa.
2. **Control de sesiÃ³n y rutas:** se restaura la sesiÃ³n y los guards protegen los paneles segÃºn el rol almacenado en `profiles`.
3. **Revision de organizaciones:** el panel administrativo consulta instituciones pendientes, verificadas y rechazadas, permite buscar por nombre, correo o representante y actualiza aprobacion/rechazo en Supabase con RLS.
4. **Perfil personal:** todos los paneles muestran una entrada de perfil con el correo de la sesion. La pagina comun obtiene nombre, correo, telefono, rol y ruta de foto del perfil autenticado; permite cambiar nombre y telefono, subir/cambiar foto en Storage, muestra informacion asociada de organizaciones o voluntariado e incluye cierre de sesion local. Despues de iniciar sesion con correo o Google, se abre primero esta pantalla.
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

1. **Verificar el acceso de organizaciones aprobadas:** aplicar `supabase/migrations/20261104120000_confirm_organization_email_on_approval.sql` al proyecto remoto. Luego consultar `profiles.status`, `organizations.verification_status`, `organizations.status` y `auth.users.email_confirmed_at` para la cuenta afectada. Se espera `active`, `approved`, `active` y una fecha de confirmacion. La ultima captura todavia muestra el aviso de organizacion pendiente, por lo que no se debe considerar validado el login hasta comprobar esos valores y completar una entrada real.
2. **Confirmar las cuentas y aprobaciones:** comprobar que la cuenta administradora tenga `role = 'admin'` y `status = 'active'`, y que una institucion aprobada pueda iniciar sesion despues de aplicar la migracion.
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

## 9. Diagnóstico reciente de autenticación y fotos de perfil

- **Voluntariado:** una cuenta revisada en Supabase tenía `profiles.role = 'volunteer'`, `profiles.status = 'active'` y `volunteer_profiles.status = 'available'`. La política `profiles_select` estaba habilitada y permitía leer el perfil propio. En el navegador, Auth respondía HTTP 200, pero la consulta REST de `profiles` respondía HTTP 520.
- **Metadatos Auth demasiado grandes:** la misma cuenta tenía `raw_user_meta_data` de 50,056 bytes; `avatar_url` ocupaba 49,717 bytes. Después de retirar ese campo, una consulta de auditoría encontró cero cuentas con `avatar_url` mayor de 4 KB. No guardar imágenes codificadas en base64 dentro de `auth.users.raw_user_meta_data`: esos metadatos se incluyen en respuestas y tokens de Auth y pueden causar solicitudes demasiado grandes.
- **Institución donante:** la cuenta aprobada podia conservar `email_confirmed_at = NULL` y/o `profiles.status = 'pending'`, dos condiciones que bloquean el acceso en etapas distintas. La migracion `20261104120000_confirm_organization_email_on_approval.sql` confirma el correo Auth y activa el perfil al aprobar organizaciones; tambien repara ambos estados en las que ya estaban aprobadas. El codigo se subio a GitHub, pero no se verifico la ejecucion de SQL en el proyecto Supabase. La ultima captura todavia muestra el mensaje de organizacion pendiente; comprobar los cuatro estados con una consulta SQL antes de dar el acceso por resuelto.
- **Mensajes de autenticación:** la pantalla distingue `email_not_confirmed`, `invalid_credentials` y perfiles pendientes. El registro institucional informa que podrá iniciar sesión cuando administración verifique la institución; los voluntarios mantienen la confirmación habitual por correo.
- **Persistencia de sesión:** los guards restauran la sesión persistida antes de decidir una redirección. El evento inicial de Supabase Auth no debe borrar el estado restaurado. La sesión se elimina al cerrar sesión; usar otro navegador o borrar el almacenamiento local equivale a una sesión nueva.
- **Configuración en rutas internas:** `runtime-config.js` debe cargarse desde `/assets/runtime-config.js`. Una ruta relativa podía buscar el archivo bajo `/app/assets/` al recargar una URL profunda como `/app/profile`, dejar activo el valor de reserva `your_project_ref` y hacer que el guard confundiera una falla de configuración con una sesión cerrada.
- **Fotos de perfil:** la foto se sube al bucket público `foodshare-avatars`, con límite de 2 MB y políticas que restringen la escritura a la carpeta del UID autenticado. `profiles.avatar_path` conserva solo la ruta corta; la URL pública se genera desde Storage. Aplicar `supabase/migrations/20261104000000_foodshare_profile_avatars_storage.sql` al proyecto Supabase antes de desplegar esta versión. Nunca guardar el Data URL de la imagen en Auth metadata ni en una columna de perfil.
- **Migración de voluntarios:** `supabase/migrations/20261103000000_activate_existing_volunteers.sql` repara perfiles de voluntarios pendientes y crea perfiles faltantes. No se confirmó su aplicación al proyecto remoto durante esta revisión.
