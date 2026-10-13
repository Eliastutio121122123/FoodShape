# FoodShare API

ASP.NET Core API for the SQL Server database. The API runs in Docker on port `8080`; Angular must call this API and must never connect directly to SQL Server.

## Local setup

1. Run `database/sqlserver/001_initial_schema.sql` in SQL Server Management Studio.
2. In `database/sqlserver/002_api_read_access.sql`, replace the sample password with a unique secret, then run it as a database administrator. This creates the restricted login and a view containing only public fields for verified, available donations.
3. Copy `.env.example` to `.env` and replace `CHANGE_ME` with the restricted API login password. Keep `.env` local; it is ignored by Git.
4. Start the app with `docker compose up --build`.
5. Check `http://localhost:8080/health/database` and `http://localhost:8080/api/donations/available`.

From the API container, SQL Server is reached at `host.docker.internal,1433`. The connection string is supplied through `FOODSHARE_SQLSERVER_CONNECTION`, not stored in `appsettings.json` or Angular.

The donation listing is intentionally public and read-only. Request creation, account registration/login, and role-protected endpoints still need to be implemented before wiring private screens to this API. For production, use HTTPS, a managed secret store, a dedicated least-privilege SQL identity, and `TrustServerCertificate=False` with a trusted SQL Server certificate. Do not use `sa` as the API login.
