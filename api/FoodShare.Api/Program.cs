using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Google.Apis.Auth;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0) policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();
if (app.Environment.IsDevelopment()) app.MapOpenApi();

var sqlConnectionString = app.Configuration.GetConnectionString("FoodShare");
var adminEmail = app.Configuration["FOODSHARE_ADMIN_EMAIL"];
var adminPassword = app.Configuration["FOODSHARE_ADMIN_PASSWORD"];
if (!string.IsNullOrWhiteSpace(sqlConnectionString)
    && !string.IsNullOrWhiteSpace(adminEmail)
    && !string.IsNullOrWhiteSpace(adminPassword))
{
    try
    {
        await EnsureAdminAccountAsync(sqlConnectionString, adminEmail, adminPassword, app.Lifetime.ApplicationStopping);
    }
    catch (SqlException exception)
    {
        app.Logger.LogError(exception, "Could not provision the admin account because SQL Server is unavailable or not ready. The API will start, but database operations will fail until the connection is fixed.");
    }
}

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    await next();
});
app.UseCors();

const string accountLookupSql = """
    SELECT TOP (1) u.Id, u.Email, u.PasswordHash,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM foodshare.UserRoles ur
          INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId
          WHERE ur.UserId = u.Id AND r.Code = N'foodshare_admin') THEN N'admin'
        WHEN EXISTS (
          SELECT 1 FROM foodshare.UserRoles ur
          INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId
          WHERE ur.UserId = u.Id AND r.Code = N'logistics_volunteer')
          OR EXISTS (SELECT 1 FROM foodshare.VolunteerProfiles vp WHERE vp.UserId = u.Id AND vp.Status <> N'inactive') THEN N'volunteer'
        WHEN EXISTS (
          SELECT 1 FROM foodshare.OrganizationMembers om
          INNER JOIN foodshare.Organizations o ON o.Id = om.OrganizationId
          INNER JOIN foodshare.OrganizationOrganizationTypes oot ON oot.OrganizationId = o.Id
          INNER JOIN foodshare.OrganizationTypes ot ON ot.Id = oot.OrganizationTypeId
          WHERE om.UserId = u.Id AND om.IsActive = 1 AND o.Status = N'active' AND o.VerificationStatus = N'verified' AND ot.Name = N'Donante') THEN N'donor'
        WHEN EXISTS (
          SELECT 1 FROM foodshare.OrganizationMembers om
          INNER JOIN foodshare.Organizations o ON o.Id = om.OrganizationId
          INNER JOIN foodshare.OrganizationOrganizationTypes oot ON oot.OrganizationId = o.Id
          INNER JOIN foodshare.OrganizationTypes ot ON ot.Id = oot.OrganizationTypeId
          WHERE om.UserId = u.Id AND om.IsActive = 1 AND o.Status = N'active' AND o.VerificationStatus = N'verified' AND ot.Name = N'Beneficiaria') THEN N'beneficiary'
      END AS AppRole
    FROM foodshare.Users AS u
    WHERE u.Email = @Email AND u.Status = N'active'
      AND (EXISTS (SELECT 1 FROM foodshare.UserRoles ur INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId WHERE ur.UserId = u.Id AND r.Code = N'foodshare_admin')
        OR EXISTS (SELECT 1 FROM foodshare.UserRoles ur INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId WHERE ur.UserId = u.Id AND r.Code = N'logistics_volunteer')
        OR EXISTS (SELECT 1 FROM foodshare.VolunteerProfiles vp WHERE vp.UserId = u.Id AND vp.Status <> N'inactive')
        OR EXISTS (SELECT 1 FROM foodshare.OrganizationMembers om INNER JOIN foodshare.Organizations o ON o.Id = om.OrganizationId INNER JOIN foodshare.OrganizationOrganizationTypes oot ON oot.OrganizationId = o.Id INNER JOIN foodshare.OrganizationTypes ot ON ot.Id = oot.OrganizationTypeId WHERE om.UserId = u.Id AND om.IsActive = 1 AND o.Status = N'active' AND o.VerificationStatus = N'verified' AND ot.Name IN (N'Donante', N'Beneficiaria')))
    ORDER BY CASE
      WHEN EXISTS (SELECT 1 FROM foodshare.UserRoles ur INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId WHERE ur.UserId = u.Id AND r.Code = N'foodshare_admin') THEN 0
      WHEN EXISTS (SELECT 1 FROM foodshare.UserRoles ur INNER JOIN foodshare.Roles r ON r.Id = ur.RoleId WHERE ur.UserId = u.Id AND r.Code = N'logistics_volunteer') OR EXISTS (SELECT 1 FROM foodshare.VolunteerProfiles vp WHERE vp.UserId = u.Id AND vp.Status <> N'inactive') THEN 1
      ELSE 2 END;
    """;

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.MapGet("/api/auth/google/config", (IConfiguration configuration) =>
{
    var clientId = configuration["FOODSHARE_GOOGLE_CLIENT_ID"];
    return string.IsNullOrWhiteSpace(clientId) ? Results.NotFound() : Results.Ok(new { clientId });
}).AllowAnonymous();

app.MapPost("/api/auth/login", async (LoginRequest request, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration.GetConnectionString("FoodShare");
    var tokenSecret = configuration["FOODSHARE_AUTH_TOKEN_SECRET"];
    if (string.IsNullOrWhiteSpace(connectionString) || string.IsNullOrWhiteSpace(tokenSecret) || Encoding.UTF8.GetByteCount(tokenSecret) < 32)
        return Results.Problem("FoodShare authentication is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password))
        return Results.Unauthorized();

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(accountLookupSql, connection);
        command.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = request.Email.Trim().ToLowerInvariant();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken) || reader.IsDBNull(2) || reader.IsDBNull(3)
            || !VerifyPassword(request.Password, reader.GetString(2)))
            return Results.Unauthorized();

        var email = reader.GetString(1);
        var role = reader.GetString(3);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1);
        var token = CreateAccessToken(email, role, tokenSecret, expiresAt);
        return Results.Ok(new LoginResponse(email, role, token, expiresAt));
    }
    catch (SqlException)
    {
        return Results.Problem("Could not authenticate with the FoodShare database.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapPost("/api/auth/google", async (GoogleLoginRequest request, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var clientId = configuration["FOODSHARE_GOOGLE_CLIENT_ID"];
    var tokenSecret = configuration["FOODSHARE_AUTH_TOKEN_SECRET"];
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(connectionString)
        || string.IsNullOrWhiteSpace(tokenSecret) || Encoding.UTF8.GetByteCount(tokenSecret) < 32)
        return Results.Problem("Google sign-in is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
    if (string.IsNullOrWhiteSpace(request.Credential)) return Results.Unauthorized();

    GoogleJsonWebSignature.Payload googleAccount;
    try
    {
        googleAccount = await GoogleJsonWebSignature.ValidateAsync(request.Credential,
            new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
    }
    catch (InvalidJwtException)
    {
        return Results.Unauthorized();
    }
    catch (HttpRequestException)
    {
        return Results.Problem("Google sign-in could not verify the account right now.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    if (!googleAccount.EmailVerified || string.IsNullOrWhiteSpace(googleAccount.Email) || string.IsNullOrWhiteSpace(googleAccount.Subject))
        return Results.Unauthorized();

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        await using var identityCommand = new SqlCommand("SELECT UserId FROM foodshare.ExternalIdentities WHERE Provider = N'google' AND ProviderUserId = @Subject;", connection, transaction);
        identityCommand.Parameters.Add("@Subject", SqlDbType.NVarChar, 255).Value = googleAccount.Subject;
        var linkedUserId = await identityCommand.ExecuteScalarAsync(cancellationToken);
        var isLinked = linkedUserId is Guid;

        var lookupSql = isLinked
            ? accountLookupSql.Replace("u.Email = @Email", "u.Id = @UserId", StringComparison.Ordinal)
            : accountLookupSql;
        await using var accountCommand = new SqlCommand(lookupSql, connection, transaction);
        if (isLinked)
            accountCommand.Parameters.Add("@UserId", SqlDbType.UniqueIdentifier).Value = (Guid)linkedUserId!;
        else
            accountCommand.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = googleAccount.Email.Trim().ToLowerInvariant();
        Guid userId;
        string email;
        string role;
        await using (var reader = await accountCommand.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken) || reader.IsDBNull(3)) return Results.Unauthorized();
            userId = reader.GetGuid(0);
            email = reader.GetString(1);
            role = reader.GetString(3);
        }

        if (!isLinked)
        {
            await using var linkCommand = new SqlCommand("INSERT INTO foodshare.ExternalIdentities (Provider, ProviderUserId, UserId) VALUES (N'google', @Subject, @UserId);", connection, transaction);
            linkCommand.Parameters.Add("@Subject", SqlDbType.NVarChar, 255).Value = googleAccount.Subject;
            linkCommand.Parameters.Add("@UserId", SqlDbType.UniqueIdentifier).Value = userId;
            await linkCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1);
        var accessToken = CreateAccessToken(email, role, tokenSecret, expiresAt);
        return Results.Ok(new LoginResponse(email, role, accessToken, expiresAt));
    }
    catch (SqlException)
    {
        return Results.Problem("Could not authenticate with the FoodShare database.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapPost("/api/auth/register", async (RegistrationRequest request, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(connectionString))
        return Results.Problem("SQL Server is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

    var email = request.Email?.Trim().ToLowerInvariant();
    var role = request.Role?.Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(email) || email.Length > 254 || !email.Contains('@')
        || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length is < 8 or > 128
        || role is not ("donor" or "beneficiary" or "volunteer"))
        return Results.BadRequest(new { message = "Revisa el correo, la contraseña y el perfil seleccionado." });

    if (role == "volunteer")
    {
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Phone)
            || string.IsNullOrWhiteSpace(request.TransportType) || string.IsNullOrWhiteSpace(request.AvailabilityZone)
            || request.AgreementAccepted != true)
            return Results.BadRequest(new { message = "Completa los datos del voluntario y acepta el acuerdo." });
    }
    else if (string.IsNullOrWhiteSpace(request.OrganizationName) || string.IsNullOrWhiteSpace(request.FullName)
        || string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Address)
        || string.IsNullOrWhiteSpace(request.City)
        || request.OrganizationName.Length > 150 || request.FullName.Length > 150 || request.Phone.Length > 30
        || request.Address.Length > 250 || request.City.Length > 100
        || (role == "donor" && string.IsNullOrWhiteSpace(request.Rnc))
        || (!string.IsNullOrWhiteSpace(request.Rnc) && !Regex.IsMatch(request.Rnc, @"^\d{3}-?\d{5}-?\d$")))
        return Results.BadRequest(new { message = "Completa los datos de la institución y de la persona responsable." });

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        await using (var duplicate = new SqlCommand("SELECT COUNT(1) FROM foodshare.Users WHERE Email = @Email;", connection, transaction))
        {
            duplicate.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = email;
            var existingUsers = await duplicate.ExecuteScalarAsync(cancellationToken);
            if (Convert.ToInt32(existingUsers) > 0)
                return Results.Conflict(new { message = "Ya existe una cuenta con ese correo." });
        }

        Guid userId;
        await using (var user = new SqlCommand("INSERT INTO foodshare.Users (FullName, Email, Phone, AuthProvider, Status, PasswordHash) OUTPUT INSERTED.Id VALUES (@FullName, @Email, @Phone, N'local', N'active', @PasswordHash);", connection, transaction))
        {
            user.Parameters.Add("@FullName", SqlDbType.NVarChar, 150).Value = request.FullName!.Trim();
            user.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = email;
            object phoneValue = string.IsNullOrWhiteSpace(request.Phone) ? DBNull.Value : request.Phone.Trim();
            user.Parameters.Add("@Phone", SqlDbType.NVarChar, 30).Value = phoneValue;
            user.Parameters.Add("@PasswordHash", SqlDbType.NVarChar, 512).Value = HashPassword(request.Password!);
            userId = (Guid)(await user.ExecuteScalarAsync(cancellationToken))!;
        }

        if (role == "volunteer")
        {
            var transport = request.TransportType == "other" ? null : request.TransportType;
            await using var volunteer = new SqlCommand("INSERT INTO foodshare.VolunteerProfiles (UserId, Status, TransportType, OtherTransportType, AvailabilityZone, AgreementAcceptedAt) VALUES (@UserId, N'available', @TransportType, @OtherTransportType, @AvailabilityZone, SYSUTCDATETIME());", connection, transaction);
            volunteer.Parameters.Add("@UserId", SqlDbType.UniqueIdentifier).Value = userId;
            object transportValue = transport is null ? DBNull.Value : transport;
            volunteer.Parameters.Add("@TransportType", SqlDbType.NVarChar, 20).Value = transportValue;
            object otherTransport = request.TransportType == "other" && !string.IsNullOrWhiteSpace(request.OtherTransportType) ? request.OtherTransportType.Trim() : DBNull.Value;
            volunteer.Parameters.Add("@OtherTransportType", SqlDbType.NVarChar, 100).Value = otherTransport;
            volunteer.Parameters.Add("@AvailabilityZone", SqlDbType.NVarChar, 100).Value = request.AvailabilityZone!.Trim();
            await volunteer.ExecuteNonQueryAsync(cancellationToken);
        }
        else
        {
            var typeName = role == "donor" ? "Donante" : "Beneficiaria";
            object rnc = string.IsNullOrWhiteSpace(request.Rnc) ? DBNull.Value : request.Rnc.Trim();
            Guid organizationId;
            await using (var organization = new SqlCommand("INSERT INTO foodshare.Organizations (Name, Rnc, Email, Phone, AddressLine, City, VerificationStatus, Status, OrganizationSubtype) OUTPUT INSERTED.Id VALUES (@Name, @Rnc, @Email, @Phone, @Address, @City, N'pending', N'active', @Subtype);", connection, transaction))
            {
                organization.Parameters.Add("@Name", SqlDbType.NVarChar, 150).Value = request.OrganizationName!.Trim();
                organization.Parameters.Add("@Rnc", SqlDbType.NVarChar, 20).Value = rnc;
                organization.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = email;
                organization.Parameters.Add("@Phone", SqlDbType.NVarChar, 30).Value = request.Phone!.Trim();
                organization.Parameters.Add("@Address", SqlDbType.NVarChar, 250).Value = request.Address!.Trim();
                organization.Parameters.Add("@City", SqlDbType.NVarChar, 100).Value = request.City!.Trim();
                object subtype = string.IsNullOrWhiteSpace(request.ProfileType) ? DBNull.Value : request.ProfileType.Trim();
                organization.Parameters.Add("@Subtype", SqlDbType.NVarChar, 100).Value = subtype;
                organizationId = (Guid)(await organization.ExecuteScalarAsync(cancellationToken))!;
            }
            await using (var linkType = new SqlCommand("INSERT INTO foodshare.OrganizationOrganizationTypes (OrganizationId, OrganizationTypeId) SELECT @OrganizationId, Id FROM foodshare.OrganizationTypes WHERE Name = @TypeName; IF @@ROWCOUNT = 0 THROW 50002, 'Organization type is missing.', 1;", connection, transaction))
            {
                linkType.Parameters.Add("@OrganizationId", SqlDbType.UniqueIdentifier).Value = organizationId;
                linkType.Parameters.Add("@TypeName", SqlDbType.NVarChar, 100).Value = typeName;
                await linkType.ExecuteNonQueryAsync(cancellationToken);
            }
            await using var member = new SqlCommand("INSERT INTO foodshare.OrganizationMembers (OrganizationId, UserId, RoleId, IsActive) SELECT @OrganizationId, @UserId, Id, 1 FROM foodshare.Roles WHERE Code = N'organization_admin'; IF @@ROWCOUNT = 0 THROW 50003, 'Organization role is missing.', 1;", connection, transaction);
            member.Parameters.Add("@OrganizationId", SqlDbType.UniqueIdentifier).Value = organizationId;
            member.Parameters.Add("@UserId", SqlDbType.UniqueIdentifier).Value = userId;
            await member.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Created("/api/auth/register", new { email, role, status = role == "volunteer" ? "active" : "pending" });
    }
    catch (SqlException exception) when (exception.Number is 2601 or 2627)
    {
        return Results.Conflict(new { message = "El correo o el RNC ya están registrados." });
    }
    catch (SqlException)
    {
        return Results.Problem("No se pudieron guardar los datos en SQL Server. Comprueba que ejecutaste las migraciones.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapGet("/api/admin/organizations/pending", async (HttpContext context, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var tokenSecret = configuration["FOODSHARE_AUTH_TOKEN_SECRET"];
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(tokenSecret) || !IsAdminAccess(context, tokenSecret)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(connectionString)) return Results.Problem("SQL Server is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT o.Id, u.Email, CASE ot.Name WHEN N'Donante' THEN N'donor' ELSE N'beneficiary' END, o.Name, COALESCE(o.Rnc, N''), o.Phone, o.AddressLine, u.FullName, o.OrganizationSubtype, o.CreatedAt FROM foodshare.Organizations o INNER JOIN foodshare.OrganizationOrganizationTypes oot ON oot.OrganizationId = o.Id INNER JOIN foodshare.OrganizationTypes ot ON ot.Id = oot.OrganizationTypeId INNER JOIN foodshare.OrganizationMembers om ON om.OrganizationId = o.Id INNER JOIN foodshare.Users u ON u.Id = om.UserId WHERE o.VerificationStatus = N'pending' ORDER BY o.CreatedAt;";
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var applications = new List<OrganizationApplicationDto>();
        while (await reader.ReadAsync(cancellationToken))
            applications.Add(new OrganizationApplicationDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetString(8), "pending", reader.GetDateTime(9)));
        return Results.Ok(applications);
    }
    catch (SqlException)
    {
        return Results.Problem("Could not load institution applications.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapPut("/api/admin/organizations/{id:guid}/review", async (Guid id, OrganizationReviewRequest request, HttpContext context, IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var tokenSecret = configuration["FOODSHARE_AUTH_TOKEN_SECRET"];
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(tokenSecret) || !IsAdminAccess(context, tokenSecret)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(connectionString)) return Results.Problem("SQL Server is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("UPDATE foodshare.Organizations SET VerificationStatus = @VerificationStatus, Status = @Status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id AND VerificationStatus = N'pending'; IF @@ROWCOUNT = 0 SELECT 0 ELSE BEGIN UPDATE foodshare.OrganizationMembers SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME() WHERE OrganizationId = @Id; SELECT 1; END;", connection);
        command.Parameters.Add("@VerificationStatus", SqlDbType.NVarChar, 20).Value = request.Approved ? "verified" : "rejected";
        command.Parameters.Add("@Status", SqlDbType.NVarChar, 20).Value = request.Approved ? "active" : "inactive";
        command.Parameters.Add("@IsActive", SqlDbType.Bit).Value = request.Approved;
        command.Parameters.Add("@Id", SqlDbType.UniqueIdentifier).Value = id;
        return (int)(await command.ExecuteScalarAsync(cancellationToken))! == 1 ? Results.NoContent() : Results.NotFound();
    }
    catch (SqlException)
    {
        return Results.Problem("Could not update institution review.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapGet("/health/database", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(connectionString))
        return Results.Problem("SQL Server is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT DB_NAME()", connection);
        var database = (string?)await command.ExecuteScalarAsync(cancellationToken);
        return Results.Ok(new { status = "ok", database });
    }
    catch (SqlException)
    {
        return Results.Problem("SQL Server is unavailable or rejected the connection.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapGet("/api/donations/available", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration.GetConnectionString("FoodShare");
    if (string.IsNullOrWhiteSpace(connectionString))
        return Results.Problem("SQL Server is not configured.", statusCode: StatusCodes.Status503ServiceUnavailable);

    const string sql = "SELECT Id, FoodName, Category, Quantity, Unit, AvailableUntil, PickupStartsAt, PickupEndsAt, DonorOrganizationName FROM foodshare.vw_AvailableDonations ORDER BY AvailableUntil ASC;";

    try
    {
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection) { CommandType = CommandType.Text };
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var donations = new List<AvailableDonationDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            donations.Add(new AvailableDonationDto(
                reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetDecimal(3),
                reader.GetString(4), reader.GetDateTime(5), reader.GetDateTime(6), reader.GetDateTime(7), reader.GetString(8)));
        }
        return Results.Ok(donations);
    }
    catch (SqlException)
    {
        return Results.Problem("Could not load available donations.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.Run();

static async Task EnsureAdminAccountAsync(string connectionString, string email, string password, CancellationToken cancellationToken)
{
    await using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync(cancellationToken);
    await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

    const string sql = """
        DECLARE @RoleId UNIQUEIDENTIFIER = (SELECT Id FROM foodshare.Roles WHERE Code = N'foodshare_admin');
        IF @RoleId IS NULL THROW 50001, 'The foodshare_admin role is missing. Run the initial database schema first.', 1;

        DECLARE @UserId UNIQUEIDENTIFIER = (SELECT Id FROM foodshare.Users WHERE Email = @Email);
        IF @UserId IS NULL
        BEGIN
          INSERT INTO foodshare.Users (FullName, Email, AuthProvider, PasswordHash, Status)
          VALUES (N'FoodShare Admin', @Email, N'local', @PasswordHash, N'active');
          SET @UserId = (SELECT Id FROM foodshare.Users WHERE Email = @Email);
        END
        ELSE
        BEGIN
          UPDATE foodshare.Users
          SET FullName = N'FoodShare Admin', AuthProvider = N'local', PasswordHash = @PasswordHash,
              Status = N'active', UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @UserId;
        END;

        IF NOT EXISTS (SELECT 1 FROM foodshare.UserRoles WHERE UserId = @UserId AND RoleId = @RoleId)
          INSERT INTO foodshare.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
        """;
    await using var command = new SqlCommand(sql, connection, transaction);
    command.Parameters.Add("@Email", SqlDbType.NVarChar, 254).Value = email.Trim().ToLowerInvariant();
    command.Parameters.Add("@PasswordHash", SqlDbType.NVarChar, 512).Value = HashPassword(password);
    await command.ExecuteNonQueryAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
}

static bool IsAdminAccess(HttpContext context, string secret)
{
    var authorization = context.Request.Headers["Authorization"].ToString();
    if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return false;
    var parts = authorization[7..].Split('.');
    if (parts.Length != 3) return false;
    try
    {
        var content = $"{parts[0]}.{parts[1]}";
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes(content));
        var actual = DecodeBase64Url(parts[2]);
        if (!CryptographicOperations.FixedTimeEquals(expected, actual)) return false;
        using var payload = JsonDocument.Parse(DecodeBase64Url(parts[1]));
        var root = payload.RootElement;
        return root.TryGetProperty("role", out var role) && role.GetString() == "admin"
            && root.TryGetProperty("exp", out var expiration) && expiration.TryGetInt64(out var exp)
            && exp > DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    }
    catch (Exception exception) when (exception is FormatException or JsonException)
    {
        return false;
    }
}

static byte[] DecodeBase64Url(string value)
{
    var base64 = value.Replace('-', '+').Replace('_', '/');
    base64 = base64.PadRight(base64.Length + ((4 - base64.Length % 4) % 4), '=');
    return Convert.FromBase64String(base64);
}

static string HashPassword(string password)
{
    const int iterations = 600_000;
    var salt = RandomNumberGenerator.GetBytes(16);
    var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32);
    return $"pbkdf2-sha256:{iterations}:{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
}

static bool VerifyPassword(string password, string storedHash)
{
    var parts = storedHash.Split(':');
    if (parts.Length != 4 || parts[0] != "pbkdf2-sha256"
        || !int.TryParse(parts[1], out var iterations) || iterations < 100_000
        || iterations > 2_000_000)
        return false;
    try
    {
        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
    catch (FormatException)
    {
        return false;
    }
}

static string CreateAccessToken(string email, string role, string secret, DateTimeOffset expiresAt)
{
    static string Encode(object value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    var header = Encode(new { alg = "HS256", typ = "JWT" });
    var payload = Encode(new { sub = email, email, role, exp = expiresAt.ToUnixTimeSeconds() });
    var content = $"{header}.{payload}";
    var signature = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes(content));
    return $"{content}.{Convert.ToBase64String(signature).TrimEnd('=').Replace('+', '-').Replace('/', '_')}";
}

internal sealed record AvailableDonationDto(
    Guid Id,
    string FoodName,
    string Category,
    decimal Quantity,
    string Unit,
    DateTime AvailableUntil,
    DateTime PickupStartsAt,
    DateTime PickupEndsAt,
    string DonorOrganizationName);

internal sealed record LoginRequest(string Email, string Password);
internal sealed record GoogleLoginRequest(string Credential);
internal sealed record RegistrationRequest(string? Role, string? Email, string? Password, string? FullName, string? OrganizationName, string? Rnc, string? Phone, string? Address, string? City, string? ProfileType, string? TransportType, string? OtherTransportType, string? AvailabilityZone, bool? AgreementAccepted);
internal sealed record OrganizationReviewRequest(bool Approved);
internal sealed record OrganizationApplicationDto(Guid Id, string Email, string Role, string OrganizationName, string Rnc, string Phone, string Address, string RepresentativeName, string? ProfileType, string Status, DateTime SubmittedAt);
internal sealed record LoginResponse(string Email, string Role, string AccessToken, DateTimeOffset ExpiresAt);
