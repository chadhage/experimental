using System.Collections.Concurrent;
using QueryDesigner.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin()));

// In-memory stores stand in for the tenant metadata store (Cosmos DB / SQL in real deployments).
builder.Services.AddSingleton<ConcurrentDictionary<string, DataConnection>>();
builder.Services.AddSingleton<ConcurrentDictionary<string, PublishedEndpoint>>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();

// Simple bearer-token gate. Replace with Entra ID / OAuth in production.
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/q") || ctx.Request.Path == "/health"
        || ctx.Request.Path.StartsWithSegments("/swagger"))
    {
        await next();
        return;
    }
    var expected = app.Configuration["Api:AccessToken"] ?? "dev-token";
    var auth = ctx.Request.Headers.Authorization.ToString();
    if (auth != $"Bearer {expected}")
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new { error = "missing or invalid bearer token" });
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Ok(new { status = "healthy", utc = DateTime.UtcNow }));

// --- Designer: manage data connections -------------------------------------------------
var connections = app.Services.GetRequiredService<ConcurrentDictionary<string, DataConnection>>();
var endpoints = app.Services.GetRequiredService<ConcurrentDictionary<string, PublishedEndpoint>>();

app.MapGet("/connections", () => Results.Ok(connections.Values))
    .WithSummary("List data source connections");

app.MapPost("/connections", (DataConnection conn) =>
{
    conn.Id = Guid.NewGuid().ToString("n");
    connections[conn.Id] = conn;
    return Results.Created($"/connections/{conn.Id}", conn);
}).WithSummary("Create a data source connection (SQL Server, Databricks, Snowflake, SharePoint, Excel Online)");

// --- Designer: design + publish a query ------------------------------------------------
app.MapPost("/publish", (PublishRequest req) =>
{
    if (!connections.ContainsKey(req.ConnectionId))
        return Results.BadRequest(new { error = "unknown connectionId" });

    var ep = new PublishedEndpoint
    {
        Id = Guid.NewGuid().ToString("n"),
        Name = req.Name,
        ConnectionId = req.ConnectionId,
        Sql = req.Sql,
        AccessToken = "tok_" + Guid.NewGuid().ToString("n"),
        Exposure = req.Exposure,
        PublishedUtc = DateTime.UtcNow
    };
    endpoints[ep.Id] = ep;
    return Results.Created($"/q/{ep.Id}", new
    {
        ep.Id, ep.Name, ep.Exposure,
        url = $"/q/{ep.Id}",
        accessToken = ep.AccessToken
    });
}).WithSummary("Publish a designed query as a consumable endpoint");

// --- Data-plane: consume a published endpoint ------------------------------------------
app.MapGet("/q/{id}", (string id, HttpRequest http) =>
{
    if (!endpoints.TryGetValue(id, out var ep))
        return Results.NotFound();

    var token = http.Headers.Authorization.ToString();
    if (token != $"Bearer {ep.AccessToken}")
        return Results.Unauthorized();

    // In production this executes ep.Sql against the resolved connection. Here we return a sample.
    return Results.Ok(new
    {
        endpoint = ep.Name,
        executedSql = ep.Sql,
        rows = new[]
        {
            new { id = 1, customer = "Contoso",  total = 1280.50 },
            new { id = 2, customer = "Fabrikam", total = 432.00 }
        }
    });
}).WithSummary("Execute a published query endpoint (consumer-facing)");

app.Run();

namespace QueryDesigner.Api
{
    public class DataConnection
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        /// <summary>sqlserver | databricks | snowflake | sharepoint | excelonline</summary>
        public string Type { get; set; } = "sqlserver";
        public string Host { get; set; } = "";
        /// <summary>internet | ipsec</summary>
        public string Connectivity { get; set; } = "internet";
        /// <summary>Reference to a secret (e.g. kv://...) — never store raw credentials.</summary>
        public string SecretRef { get; set; } = "";
    }

    public record PublishRequest(string Name, string ConnectionId, string Sql, string Exposure);

    public class PublishedEndpoint
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string ConnectionId { get; set; } = "";
        public string Sql { get; set; } = "";
        public string AccessToken { get; set; } = "";
        public string Exposure { get; set; } = "public";
        public DateTime PublishedUtc { get; set; }
    }
}
