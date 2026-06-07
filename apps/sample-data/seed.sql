/* =============================================================================
   Sample data source for the Query Designer demo.
   Targets SQL Server 2019+ / Azure SQL. Run against the 'master' or a new DB.
   Used by docker-compose (mssql service) and by the API's sample queries.
   ============================================================================= */

IF DB_ID('QueryDesignerDemo') IS NULL
    CREATE DATABASE QueryDesignerDemo;
GO

USE QueryDesignerDemo;
GO

IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DROP TABLE dbo.Customers;
GO

CREATE TABLE dbo.Customers
(
    CustomerId   INT IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(200) NOT NULL,
    Region       NVARCHAR(100) NOT NULL,
    CreatedUtc   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.Orders
(
    OrderId      INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId   INT NOT NULL REFERENCES dbo.Customers(CustomerId),
    Total        DECIMAL(12,2) NOT NULL,
    Status       NVARCHAR(40)  NOT NULL DEFAULT 'open',
    OrderedUtc   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Orders_CustomerId ON dbo.Orders(CustomerId);
GO

INSERT INTO dbo.Customers (Name, Region) VALUES
    (N'Contoso',  N'eastus2'),
    (N'Fabrikam', N'westeurope'),
    (N'Tailspin', N'eastus2');
GO

INSERT INTO dbo.Orders (CustomerId, Total, Status) VALUES
    (1, 1280.50, 'paid'),
    (1,  240.00, 'open'),
    (2,  432.00, 'paid'),
    (3,   99.99, 'cancelled');
GO

/* Example query a designer might publish as an endpoint */
SELECT TOP 100
    o.OrderId,
    c.Name AS Customer,
    o.Total,
    o.Status,
    o.OrderedUtc
FROM dbo.Orders o
JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
ORDER BY o.OrderedUtc DESC;
GO
