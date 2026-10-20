# Servicios de datos

El servicio `AuthService` usa Supabase Auth y Supabase PostgreSQL. Las tablas activas y sus politicas RLS estan definidas en `supabase/migrations`. Los servicios de donaciones, solicitudes y entregas siguen usando datos temporales y deben migrarse antes de completar esos flujos.
