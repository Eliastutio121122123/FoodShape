/*
  Optional least-privilege SQL login for the API's public donation listing.
  Replace the placeholder with a unique strong secret before running this file.
  Never reuse the SQL Server administrator password here.
*/
USE master;
GO

IF SUSER_ID(N'foodshare_api') IS NULL
  CREATE LOGIN [foodshare_api]
    WITH PASSWORD = N'REPLACE_WITH_A_UNIQUE_STRONG_SECRET',
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
GO

USE FoodShareDb;
GO

CREATE OR ALTER VIEW foodshare.vw_AvailableDonations
AS
  SELECT d.Id, d.FoodName, fc.Name AS Category, d.Quantity, d.Unit,
         d.AvailableUntil, d.PickupStartsAt, d.PickupEndsAt,
         o.Name AS DonorOrganizationName
  FROM foodshare.Donations AS d
  INNER JOIN foodshare.Organizations AS o ON o.Id = d.DonorOrganizationId
  INNER JOIN foodshare.OrganizationOrganizationTypes AS oot ON oot.OrganizationId = o.Id
  INNER JOIN foodshare.OrganizationTypes AS ot ON ot.Id = oot.OrganizationTypeId
  INNER JOIN foodshare.FoodCategories AS fc ON fc.Id = d.FoodCategoryId
  INNER JOIN foodshare.Branches AS b ON b.Id = d.BranchId
  WHERE d.Status = N'available'
    AND d.AvailableUntil > SYSUTCDATETIME()
    AND o.Status = N'active'
    AND o.VerificationStatus = N'verified'
    AND ot.Name = N'Donante'
    AND b.Status = N'active';
GO

IF DATABASE_PRINCIPAL_ID(N'foodshare_api') IS NULL
  CREATE USER [foodshare_api] FOR LOGIN [foodshare_api];
GO

GRANT SELECT ON OBJECT::foodshare.vw_AvailableDonations TO [foodshare_api];
GO
