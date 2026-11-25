# FoodShare: funcionamiento, requerimientos y estado

**Estado revisado:** 25 de noviembre de 2026.

## Actualización: ofertas ya solicitadas

- El mercado de organizaciones beneficiarias excluye las publicaciones para las que la organización autenticada ya tiene una solicitud, cualquiera que sea su estado. Así no se vuelve a abrir una acción que la restricción única `donation_requests(donation_id, beneficiary_organization_id)` no permitiría repetir. La oferta puede seguir apareciendo a otras organizaciones mientras conserve stock visible.
- El mercado de personas necesitadas excluye las ofertas para las que esa persona tiene una solicitud de ración pendiente o aprobada. Si la organización rechaza la solicitud, la oferta puede volver a aparecer si todavía está visible, vigente y tiene stock. La selección se filtra por `person_id` de la sesión actual.
- La exclusión es por cuenta y publicación; no oculta la donación a otros beneficiarios/personas ni cambia las cantidades del inventario. La solicitud personal de ración aún no reserva cantidades ni crea una entrega de inventario.
- No se agregaron tablas, rutas ni migraciones; se reutilizan `donation_requests`, `individual_aid_requests`, `loadBeneficiaryDashboard()` y `loadPersonalFoodOffers()`.

## Actualización: inventario y reposición de donaciones

- El inventario de cada publicación se divide en `available_quantity` (disponible), `reserved_quantity` (aceptado y pendiente de entrega) y `delivered_quantity` (recepción confirmada). `quantity` conserva la cantidad total publicada para esa tanda.
- El donante acepta solicitudes de forma atómica: se valida el stock vigente, se reserva únicamente la cantidad solicitada y se conserva el resto para nuevas solicitudes. Al agotarse el stock, las solicitudes pendientes restantes se rechazan para evitar aceptar más de lo disponible.
- La confirmación de recepción por la organización beneficiaria traslada la cantidad desde reservada a entregada. La publicación solo pasa a «Entregada» cuando ya no quedan cantidades disponibles ni reservadas; por tanto, una entrega parcial no cierra el resto del producto.
- Si se cancela una entrega antes de que comience la recogida, su cantidad reservada vuelve al inventario. La reserva también se libera cuando la oferta venció, pero su estado vencido evita que vuelva a aparecer en las búsquedas públicas. No se permite cancelar desde este flujo una entrega ya iniciada ni una recepción confirmada.
- «Mis donaciones» muestra las tandas con stock o entregas pendientes en **Activas**; separa **Disponibles**, **Ocultas**, **Con reservas** y **Agotadas y archivo**. La ficha distingue cantidades disponibles, reservadas y entregadas.
- Cuando una tanda ya no tiene stock disponible ni reservas pendientes, **Reponer stock** crea una publicación nueva con la misma descripción, categoría e imagen, cantidad y horario nuevos. La tanda anterior permanece en archivo con sus entregas y solicitudes, sin reactivarse ni sobrescribir su historial.
- Las vistas del mercado personal y beneficiario consultan únicamente ofertas visibles, vigentes y con stock disponible. La solicitud valida la cantidad contra existencias y la aceptación vuelve a comprobarla bajo bloqueo en la base de datos.
- Se agregó la migración nueva `20261125131500_donor_donation_stock_lifecycle.sql`: columnas y restricciones de inventario, relleno del stock para datos anteriores, funciones seguras para aceptar/confirmar/cancelar, liberación de reservas en cancelaciones seguras y RPC de reposición.
- **Requisito de despliegue:** aplicar esta migración al proyecto Supabase usado por la aplicación antes de desplegar/usar la versión de código que consulta las nuevas columnas. La migración está añadida al repositorio, pero no se ejecutó en la base remota desde esta sesión.
- No hay seguimiento GPS en vivo. El mapa continúa representando una ruta estimada a partir de las ubicaciones disponibles.
- La aprobación de solicitudes personales de raciones (`individual_aid_requests`) sigue siendo un flujo aparte y no reserva stock de publicaciones: esa tabla no registra cantidad solicitada ni está vinculada a las entregas del flujo de organizaciones.

## Cambio reciente: solicitudes personales aprobadas

- La bandeja `/app/aid-requests` ahora permite separar **Todas**, **Pendientes**, **Aprobadas** y **No aprobadas**, con el conteo actualizado desde las solicitudes que carga Supabase.
- Al terminar una aprobación se conserva la confirmación y aparece el acceso **Ver aprobadas** para abrir de inmediato la sección correspondiente, sin impedir que se continúen revisando otras solicitudes pendientes.
- En las solicitudes aprobadas se muestra el alimento y la cantidad cuando la solicitud corresponde a una ración, además de la fecha coordinada cuando existe; para membresías se indica el siguiente paso de contacto.
- No se añadieron rutas, tablas ni migraciones: se reutilizan `individual_aid_requests`, `loadOrganizationAidRequests()` y el estado existente `approved`.
- El acceso a la bandeja sigue limitado a donantes y organizaciones beneficiarias; los datos permanecen sujetos a las consultas y políticas RLS existentes.
- Se corrigió el acceso desde el menú lateral del donante para navegar explícitamente a `/app/aid-requests` y cerrar el menú móvil al abrir la bandeja.
- La bandeja ahora usa el contenedor de desplazamiento de Ionic (`ion-content`), para que las solicitudes y sus detalles inferiores puedan recorrerse verticalmente en escritorio y móvil.

> **Para qué sirve este documento:** es el inventario funcional y la guía de seguimiento de FoodShare. Reúne las 30 funcionalidades acordadas, explica qué está implementado y qué falta, y registra las validaciones pendientes en Supabase. Actualízalo cuando cambie el sistema para que el equipo tenga una referencia compartida y no confunda pantallas, maquetas o tablas con funciones terminadas.

## Resumen de cambios recientes: donantes y beneficiarias

Esta sección reúne las funciones incorporadas recientemente y reemplaza las descripciones anteriores que indicaban que todo el flujo de donaciones era de demostración.

- **Publicación y gestión del donante:** el panel consulta y publica donaciones persistentes, carga imágenes en `foodshare-donations`, ofrece detalle y acciones para editar, ocultar/mostrar y eliminar cuando las relaciones lo permiten. Las consultas respetan `donations.is_visible`.
- **Mercado beneficiario conectado:** Inicio y Buscar donaciones usan la sesión de Supabase para identificar la organización beneficiaria, consultan publicaciones disponibles y visibles, muestran nombre, categoría, cantidad, unidad, vencimiento, ubicación disponible y foto, y permiten enviar solicitudes persistentes con cantidad y mensaje. No se inventan donaciones ni distancias.
- **Seguimiento de solicitudes:** el beneficiario puede consultar sus solicitudes y el donante las solicitudes recibidas; la aceptación queda asociada a una entrega y permanece visible en ambas vistas. El perfil de la organización solicitante puede consultarse desde la solicitud, con información de contacto limitada según el estado.
- **Coordinación y recepción:** las vistas muestran estado y pasos siguientes, dirección/ruta solo cuando los datos y permisos lo permiten, y el beneficiario puede confirmar la recepción. La confirmación se registra una sola vez y se refleja en el historial y en el panel del donante.
- **Identidad entre cuentas:** la carga de perfiles filtra por usuario autenticado y rol, limpia datos anteriores y descarta respuestas tardías; así evita mostrar información de otra cuenta al cambiar de sesión.
- **Interfaz:** el Inicio beneficiario y la búsqueda tienen estados de carga, error/reintento y listas vacías; navegación adaptable, tarjetas con imágenes, filtros acomodables y desplazamiento vertical en pantallas pequeñas.
- **Mensajería interna:** se sustituyeron las acciones de correo externo por conversaciones dentro de FoodShare entre personas y organizaciones. La bandeja, las respuestas a mensajes y la eliminación de mensajes propios usan Supabase y aplican RLS para que solo las partes de la conversación puedan acceder.
- **Rutas actuales:** el panel beneficiario vive en `/app/beneficiary`; Buscar donaciones, Mis solicitudes e Historial son secciones locales del panel. El perfil personal usa `/app/profile`.
- **Migraciones de donaciones beneficiarias:** `20261115170000_beneficiary_requested_donation_read.sql`, `20261115200000_beneficiary_delivery_confirmation.sql`, `20261115230000_donor_beneficiary_profile_access.sql` y `20261115233000_renew_expired_donor_donation.sql`. Su historial remoto debe verificarse por separado; el estado confirmado de las migraciones del chat se documenta en la sección correspondiente.

### Límites que siguen vigentes

- No hay GPS ni seguimiento de ubicación en vivo. Un enlace de mapas, cuando puede construirse, muestra una ruta estimada.
- No hay coordenadas registradas para todas las organizaciones; sin ellas se usan direcciones disponibles y no se calculan distancias ficticias.
- La asignación y el seguimiento operativo de voluntarios todavía no están integrados de extremo a extremo con este flujo.
- La cancelación de solicitudes por parte del beneficiario no está implementada en el mercado conectado.
- Las migraciones nuevas requieren aplicación y validación en Supabase remoto antes de dar por comprobados los permisos y transiciones allí.

## Portal de apoyo alimentario para personas

- Se incorporó el rol `person`, con registro personal, perfil activo y panel protegido en `/app/person`. El panel permite consultar organizaciones aprobadas por ciudad, revisar alimentos disponibles, contactar a las organizaciones, enviar solicitudes para unirse o pedir una ración y consultar el estado de esas solicitudes.
- Donantes y organizaciones beneficiarias pueden abrir `/app/aid-requests` para revisar solicitudes personales pendientes, aprobadas y no aprobadas, aprobarlas o rechazarlas; al aprobar una solicitud de ración, pueden coordinar fecha y hora. Los filtros muestran conteos, la confirmación ofrece un acceso directo a las aprobadas y las tarjetas aprobadas explican el estado y próximo paso. El perfil administrativo permite filtrar el rol de persona.
- La migración `20261117090000_individual_beneficiaries.sql` define el rol, `individual_aid_requests`, sus políticas RLS y la notificación a la organización; `20261117100000_fix_individual_aid_rls.sql` contiene correcciones iniciales. El historial remoto consultado registra las migraciones correctivas `20261117220833_fix_individual_aid_profile_rls_recursion` y `20261117221216_break_aid_donation_rls_cycle`. La tabla y el flujo de solicitudes están presentes en el proyecto; al sincronizar otro entorno, aplicar las migraciones locales en orden.
- **Límite funcional:** aprobar una solicitud individual asociada a una donación no descuenta ni reserva automáticamente la cantidad de esa publicación. La coordinación de existencias para solicitudes personales debe validarse antes de usarla para comprometer inventario.

## Mensajes dentro de FoodShare

- Las personas pueden iniciar o retomar una conversación desde el directorio, una donación o sus solicitudes. Las organizaciones donantes y beneficiarias pueden abrir el chat desde las solicitudes recibidas cuando la persona ya tiene una solicitud vinculada.
- La bandeja y el detalle están disponibles en `/app/chat` y `/app/chat/:conversationId`. Las pantallas de personas y de solicitudes incluyen accesos a esa ruta. No se abre Gmail ni se crea un enlace `mailto:`.
- `AuthService` crea o reutiliza una conversación por pareja persona-organización, carga los mensajes autorizados, permite enviar texto y escucha nuevos mensajes mediante Supabase Realtime. Los mensajes se limitan a 2,000 caracteres.
- Cada mensaje puede responder a otro mensaje de la misma conversación; la interfaz muestra la referencia y quién lo escribió. La base de datos impide responder a mensajes eliminados o pertenecientes a otro chat.
- Cada participante puede eliminar sus propios mensajes. La eliminación es lógica: el texto se reemplaza por «Este mensaje fue eliminado», no se puede deshacer y se sincroniza en tiempo real. No se permite borrar ni modificar el mensaje de la otra parte.
- Las tablas `public.chat_conversations` y `public.chat_messages` tienen RLS. La persona participante y el propietario de la organización asociada pueden leer y escribir; una cuenta ajena no puede consultar la conversación. La creación por una organización requiere una solicitud previa de esa persona. El sistema no guarda ubicación ni comparte datos privados fuera de esos participantes.
- Migraciones aplicadas y registradas en el proyecto Supabase remoto: `20261118010256_foodshare_internal_chat.sql`, `20261118011648_foodshare_chat_foreign_key_indexes.sql` y `20261125124700_chat_replies_and_soft_delete.sql` (respuestas, eliminación lógica y sus permisos).
- **Límites actuales:** el chat admite texto; no incluye adjuntos, llamadas, indicador de escritura, confirmaciones de lectura ni contador de mensajes no leídos. La actualización en vivo depende de la conexión a Supabase Realtime.

## Perfil beneficiario visible desde solicitudes del donante

- La expansión «Ver perfil» ahora presenta nombre institucional, estado de verificación, tipo de institución, representante, ciudad y teléfono. La dirección se muestra solo después de aceptar la solicitud.
- El servicio identifica explícitamente si Supabase devolvió el perfil; si no, la interfaz explica que falta acceso en vez de mostrar un panel vacío.
- La nueva migración `supabase/migrations/20261115230000_donor_beneficiary_profile_access.sql` asegura que una organización donante pueda leer la organización beneficiaria vinculada a solicitudes de sus propias donaciones. No amplía el acceso a instituciones sin relación con sus donaciones. Debe aplicarse al Supabase remoto.

## Renovación de una oferta vencida con solicitudes pendientes

- La aceptación permanece bloqueada cuando la donación está vencida o ya no está disponible. La vista ahora indica el motivo concreto y la fecha límite.
- Para una oferta vencida que aún está `available` y tiene solicitudes pendientes sin ninguna aceptada, el donante puede cambiar solamente el horario/fecha límite. La acción exige confirmar que el alimento sigue apto para consumo.
- La migración `supabase/migrations/20261115233000_renew_expired_donor_donation.sql` limita la renovación al donante propietario, organización activa y aprobada, horario futuro y solicitudes pendientes; luego actualiza `pickup_starts_at`, `pickup_ends_at` y `expires_at` atómicamente. Debe aplicarse a Supabase remoto.
- Una vez renovada la vigencia, se actualizan las solicitudes y el donante puede aceptar normalmente. La RPC de aceptación sigue rechazando donaciones vencidas.

## Imágenes de donaciones en el panel beneficiario

- La consulta de publicaciones vigentes del panel beneficiario ahora incluye `donations.image_path` y genera la URL pública desde el bucket `foodshare-donations`, igual que el panel donante.
- Las tarjetas de Inicio y Buscar donaciones, así como el detalle, renderizan la foto; si no existe o falla la carga, conservan el marcador de categoría como alternativa.
- Se reutiliza la política de lectura pública existente del bucket. No se añadió migración; la columna `image_path`, el bucket y sus permisos ya pertenecen a la migración de imágenes de donaciones.

## Corrección de carga de identidad del perfil

- `loadAccountProfile()` limita la consulta institucional al propietario autenticado y al tipo de organización que corresponde al rol del perfil; los datos de voluntariado se consultan por el UID autenticado.
- Antes de retornar o actualizar la foto global, vuelve a comprobar que la sesión siga siendo del mismo usuario que inició la carga. Esto evita que respuestas lentas tras cambiar de cuenta muestren el perfil anterior.
- `loadSession()` valida el usuario de la sesión vigente antes de aplicar el rol o avatar de una consulta previa, evitando que una respuesta tardía sobrescriba el estado de otra cuenta abierta en otra pestaña.
- La pantalla de perfil borra los datos anteriores al recargar y descarta respuestas obsoletas. Los campos institucionales solo se muestran para donantes/beneficiarios; voluntariado conserva su bloque propio.

## Actualización del 15 de noviembre de 2026: organización donante

Esta actualización describe las funciones del panel donante; el mercado y el envío de solicitudes beneficiarias también se conectaron posteriormente y se resumen arriba y en las secciones de beneficiaria y coordinación.

### Funciones del donante conectadas

- **Inicio:** el dashboard consulta en Supabase las donaciones de la organización, solicitudes pendientes, entregas confirmadas, actividad reciente y métricas. Las donaciones ocultas no cuentan como disponibles para otras organizaciones.
- **Publicar donaciones:** el formulario carga categorías activas y la dirección registrada de la organización, valida nombre, cantidad, unidad y fechas, guarda los datos en `public.donations` y permite cargar fotos al bucket `foodshare-donations`.
- **Mis donaciones:** consulta publicaciones persistentes; incluye búsqueda, filtros por estado y ocultas, cantidades, vencimientos, foto y estado de solicitudes. Las unidades técnicas se presentan en español.
- **Detalle y mantenimiento:** cada publicación abre una ficha con imagen, descripción, categoría, cantidad, horarios, vencimiento, dirección y solicitudes. El menú de tres puntos permite editar publicaciones disponibles sin solicitudes, ocultar o volver a mostrar una publicación y eliminarla cuando no tiene solicitudes relacionadas. El borrado conserva las restricciones de integridad; cuando hay solicitudes, se debe ocultar y conservar el registro.
- **Solicitudes recibidas:** el panel consulta solicitudes persistentes, muestra la organización solicitante y los datos autorizados de recogida, filtra pendientes/aceptadas/finalizadas y procesa aceptar o rechazar mediante `review_donation_request`. Con la migración de inventario aplicada, aceptar reserva solo la cantidad pedida y rechaza solicitudes restantes únicamente cuando ya no queda stock; la entrega queda asociada a la solicitud.
- **Historial:** consulta entregas completadas y calcula alimentos entregados, entregas confirmadas y organizaciones apoyadas.
- **Foto de perfil:** la barra lateral del panel donante muestra la foto guardada en el perfil; usa las iniciales como alternativa si no hay foto.
- **Correcciones visuales:** las tarjetas mantienen visibles los datos aunque haya foto; el botón «Ver detalle» abre la ficha; el menú de tres puntos usa opciones legibles y no hereda la forma circular del botón.
- **Registro de organizaciones:** se corrigió el solapamiento del botón «Enviar registro» con los campos del formulario, que podía interceptar clics al desplazarse. RNC se declara como texto numérico con autocompletado desactivado y longitud limitada; teléfono usa el tipo telefónico. El ajuste aplica a los formularios de donantes y beneficiarias.

### Migraciones y permisos requeridos

- `20261109180000_donor_request_inbox.sql`: añade cantidad y mensaje a solicitudes y la función segura para revisarlas.
- `20261115100000_foodshare_donation_images.sql`: agrega `image_path`, bucket y políticas de imágenes.
- `20261115120000_foodshare_donation_storage_rls_fix.sql`: corrige la comprobación de permisos para subir imágenes.
- `20261115150000_foodshare_donor_donation_management.sql`: agrega `donations.is_visible`, limita lecturas/solicitudes de publicaciones ocultas y restringe el borrado a publicaciones sin solicitudes.
- `20261115170000_beneficiary_requested_donation_read.sql`: permite que la beneficiaria consulte la publicación asociada a sus solicitudes aceptadas para coordinar la recogida.
- `20261115200000_beneficiary_delivery_confirmation.sql`: crea/actualiza el flujo seguro de entregas y la confirmación de recepción por la organización beneficiaria.
- `20261115230000_donor_beneficiary_profile_access.sql`: permite consultar al donante el perfil de la beneficiaria vinculada a solicitudes de sus propias donaciones.
- `20261115233000_renew_expired_donor_donation.sql`: RPC para renovar de forma limitada una oferta vencida con solicitudes pendientes.
- `20261125131500_donor_donation_stock_lifecycle.sql`: inventario por tandas, reserva y confirmación parcial, cancelación segura, liberación del stock y reposición mediante una nueva publicación. **Pendiente de aplicar en el proyecto Supabase remoto.**

Las migraciones y el código están versionados en GitHub. La ejecución remota de SQL se hizo manualmente desde Supabase; no se confirma desde este repositorio el estado actual de cada migración. El 15 de noviembre se detectaron errores por las columnas `quantity_requested` e `is_visible` ausentes; después se vio el dashboard con publicaciones y una de ellas marcada como «Oculta», lo que confirma que la columna de visibilidad estaba disponible en esa captura. Si vuelven a aparecer errores de columna, revisar que se ejecutó el archivo correspondiente en el mismo proyecto Supabase configurado para la web.

### Estado pendiente relacionado

- Las pantallas genéricas basadas en `InMemoryCrudService` y las operaciones de voluntariado siguen usando datos locales; no confundirlas con el flujo dedicado de donaciones y solicitudes ya conectado.
- La creación, aceptación/rechazo, cancelación de solicitudes de donación por la beneficiaria, confirmación de recepción y reposición por tandas están implementadas en el código. Las funciones nuevas de inventario requieren aplicar la migración `20261125131500_donor_donation_stock_lifecycle.sql`. La asignación/seguimiento de voluntarios sigue pendiente.
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
- **Conectividad Supabase comprobada parcialmente:** el endpoint de Auth y el preflight CORS respondieron HTTP 200 desde el entorno local; la clave publishable configurada fue aceptada. Las dos migraciones del chat sí aparecen aplicadas en el historial remoto; el estado de las demás migraciones debe revisarse por separado.
- **Administrador:** se pudo acceder al panel ` /app/admin ` en la sesion actual y la captura muestra la institucion en la pestaña Verificadas. Aun falta comprobar que la migracion de sincronizacion de aprobacion y acceso se haya ejecutado en Supabase y que la fila correspondiente tenga estados consistentes.
- **ConfiguraciÃ³n:** la interfaz usa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` desde `.env`; la clave `secret`/`service_role` nunca debe incorporarse al frontend. DespuÃ©s de cambiar `.env`, hay que recrear el servicio web para que regenere la configuraciÃ³n de ejecuciÃ³n.

La conectividad HTTP y CORS se comprobo parcialmente desde el entorno local. El flujo de inicio de sesion sigue pendiente de validacion integral contra el proyecto Supabase remoto, en particular la ejecucion de las migraciones recientes y los estados de la cuenta institucional aprobada.

## 3. Requerimientos funcionales y estado

> **Inventario funcional:** la siguiente lista es la referencia oficial de alcance y avance de las 30 funcionalidades de FoodShare.

### Resumen de las 30 funcionalidades

- **Completadas y verificadas de extremo a extremo:** 0 de 30. Ninguna se marca como completa hasta comprobar también permisos, persistencia y comportamiento en el proyecto Supabase remoto.
- **Parciales:** 1–16, 18–19, 21–25 y 28–30. Varias ya funcionan en el código —por ejemplo, publicar y buscar donaciones, enviar/revisar solicitudes y confirmar recepción—, pero aún tienen tareas o validaciones remotas descritas en las filas.
- **Pendientes:** 17 (asignación de voluntarios), 20 (notificaciones persistentes por eventos), 26 (puntuación/reputación) y 27 (incidencias/reportes).

“Parcial” no significa que no se haya trabajado: la columna de situación detalla lo implementado y lo que falta. La falta de validación de una migración remota se señala expresamente, sin asumir que la base desplegada tenga el mismo estado que el código.

Estados usados:

- **Implementado:** flujo completo conectado, con permisos configurados y comportamiento comprobado de extremo a extremo en el entorno correspondiente.
- **Parcial:** existe funcionalidad real en código, pero falta completar alguna acción, rol, persistencia, permiso o validación del entorno remoto.
- **Pendiente:** la función principal aún no está disponible de extremo a extremo; puede existir una tabla, maqueta o servicio local, pero eso no cuenta como función terminada.

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
| 7 | PublicaciÃ³n de donaciones | Parcial | El formulario del donante guarda en `donations` y Storage con datos de la organizaciÃ³n autenticada. La disponibilidad y permisos dependen de las migraciones RLS aplicadas en el proyecto remoto. |
| 8 | EdiciÃ³n y cancelaciÃ³n de donaciones | Parcial | Se pueden editar ofertas elegibles, ocultar/mostrar y eliminar si no tienen solicitudes relacionadas. La cancelaciÃ³n con relaciones se gestiona conservando/ocultando el registro; no hay borrado en cascada. |
| 9 | Informacion y categorias de alimentos | Parcial | CategorÃ­as administrativas consultan `food_categories` y el formulario conectado carga las activas. Confirmar que el catÃ¡logo y sus polÃ­ticas estÃ©n aplicados en remoto. |
| 10 | Consulta de donaciones disponibles | Parcial | El mercado beneficiario y el panel donante leen publicaciones persistentes; se filtran las ocultas y las que no estÃ¡n disponibles. |
| 11 | BÃºsqueda y filtrado de donaciones | Parcial | La bÃºsqueda y categorÃ­as operan sobre publicaciones reales; el mercado admite ordenamiento por fecha, vencimiento y cantidad. No hay cÃ¡lculo de distancia ni filtrado geogrÃ¡fico completo. |
| 12 | GestiÃ³n de disponibilidad | Parcial | La disponibilidad y visibilidad se guardan en Supabase y se coordinan con solicitudes aceptadas. Revisar las polÃ­ticas y migraciones remotas para validar el entorno desplegado. |

### 3.4 Solicitudes y reservas

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 13 | Solicitud de donaciones | Parcial | La beneficiaria autenticada crea solicitudes persistentes con cantidad y mensaje; la cancelaciÃ³n por la beneficiaria sigue pendiente. |
| 14 | AceptaciÃ³n, rechazo y cancelaciÃ³n de solicitudes | Parcial | El donante acepta o rechaza mediante RPC segura. La cancelaciÃ³n por la beneficiaria aÃºn no estÃ¡ integrada. |
| 15 | Reserva de donaciones | Parcial | La aceptaciÃ³n reserva la donaciÃ³n transaccionalmente, rechaza otras solicitudes pendientes y crea la entrega correspondiente. |
| 16 | GestiÃ³n de estados de donaciones y solicitudes | Parcial | Solicitudes y entregas persistentes reflejan aceptaciÃ³n y recepciÃ³n; validar migraciones RLS/RPC remotas y mantener los estados consistentes. |

### 3.5 Recogida y entrega
    
| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 17 | AsignaciÃ³n de voluntarios | Pendiente | `DeliveryService` asigna sobre datos en memoria. La tabla remota estÃ¡ definida, pero la asignaciÃ³n no estÃ¡ conectada. |
| 18 | Fechas y horarios de recogida y entrega | Parcial | Se muestran los horarios persistidos de recogida y se ofrece una ruta estimada cuando hay direcciones; faltan asignaciÃ³n y operaciones del voluntario. |
| 19 | GestiÃ³n de recogida y entrega | Parcial | La aceptaciÃ³n crea la entrega y la beneficiaria confirma la recepciÃ³n mediante RPC segura. AsignaciÃ³n y cambios de estado por voluntarios no estÃ¡n conectados de extremo a extremo. |
| 22 | Registro y consulta de entregas realizadas | Parcial | Donante y beneficiaria consultan entregas y confirmaciones en sus paneles/historial. El mÃ³dulo genÃ©rico de entregas/asignaciones de voluntarios sigue siendo local. |

### 3.6 Notificaciones, historial e incidencias

| # | Requerimiento | Estado | SituaciÃ³n actual |
|---|---|---|---|
| 20 | Notificaciones a usuarios | Pendiente | Hay tabla y un servicio en memoria; faltan persistencia y generaciÃ³n de notificaciones por eventos. |
| 21 | Historial de donaciones y solicitudes | Parcial | El historial del donante y las entregas recibidas de la beneficiaria consultan los registros persistentes disponibles; otras vistas genÃ©ricas pueden seguir usando memoria. |
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

El formulario del donante carga las categorÃ­as activas y guarda las publicaciones en Supabase. Si el catÃ¡logo no estÃ¡ disponible o falta su migraciÃ³n remota, se debe corregir el esquema/permisos en lugar de asumir opciones de ejemplo como datos reales.

## 6. Datos demostrativos

Los servicios siguientes heredan de `InMemoryCrudService` y no persisten datos en Supabase:

- Donaciones y disponibilidad.
- Solicitudes y reservas.
- Entregas y asignaciones de voluntarios.
- Organizaciones, usuarios, voluntariado y notificaciones a traves de los servicios CRUD genericos, que aun usan memoria. Las pantallas administrativas de usuarios e instituciones y los catalogos no usan esos servicios: consultan Supabase directamente.

El flujo dedicado de donaciones del donante y de bÃºsqueda/solicitudes/recepciÃ³n de la beneficiaria consulta y actualiza Supabase. Las operaciones genÃ©ricas que heredan de `InMemoryCrudService`, incluidas asignaciones y seguimiento de voluntarios, siguen siendo locales. El contenido de los paneles conectados depende de datos reales y de que las polÃ­ticas y migraciones requeridas estÃ©n aplicadas en el proyecto Supabase correcto.

## 7. Proximos pasos recomendados

1. **Verificar el acceso de organizaciones aprobadas:** aplicar `supabase/migrations/20261104120000_confirm_organization_email_on_approval.sql` al proyecto remoto. Luego consultar `profiles.status`, `organizations.verification_status`, `organizations.status` y `auth.users.email_confirmed_at` para la cuenta afectada. Se espera `active`, `approved`, `active` y una fecha de confirmacion. La ultima captura todavia muestra el aviso de organizacion pendiente, por lo que no se debe considerar validado el login hasta comprobar esos valores y completar una entrada real.
2. **Confirmar las cuentas y aprobaciones:** comprobar que la cuenta administradora tenga `role = 'admin'` y `status = 'active'`, y que una institucion aprobada pueda iniciar sesion despues de aplicar la migracion.
3. **Completar el apartado de perfil:** permitir edicion persistente de los datos de organizacion y voluntariado, con validacion y permisos RLS.
4. **Verificar el flujo donante-beneficiaria en Supabase remoto:** aplicar/verificar las migraciones de imÃ¡genes, gestiÃ³n, lectura de solicitudes aceptadas, confirmaciÃ³n de entrega, acceso al perfil y renovaciÃ³n de ofertas; validar las polÃ­ticas con cuentas de cada rol.
5. **Completar operaciones pendientes:** implementar cancelaciÃ³n de solicitudes por beneficiarias y asignaciÃ³n/seguimiento de voluntarios con permisos RLS y estados persistentes.
6. **Completar el módulo de voluntariado:** conectar asignaciones y estados operativos de recogida/entrega a Supabase; la confirmación de recepción por la beneficiaria y el historial básico ya están conectados.
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
