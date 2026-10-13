using System.Data;
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

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    await next();
});
app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

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
