# Servicios Angular

Estos servicios son la capa de acceso de las pantallas de FoodShare. En esta etapa usan almacenamiento temporal en memoria. `DonationService` y `DonationRequestService` incluyen registros de demostración usados por el panel de beneficiarias.

Cuando se cree la API, se conservarán los métodos públicos de cada servicio y se reemplazará la implementación temporal por solicitudes HTTP a esa API. La aplicación Ionic/Angular nunca debe conectarse directamente a SQL Server.

Los servicios de donaciones, solicitudes y entregas ya incluyen las transiciones básicas de estado para evitar operaciones inválidas.
