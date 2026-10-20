/* Adds password-hash storage and the minimum grants needed by the API login. */
USE FoodShareDb;
GO

IF COL_LENGTH(N'foodshare.Users', N'PasswordHash') IS NULL
  ALTER TABLE foodshare.Users ADD PasswordHash NVARCHAR(512) NULL;
GO

IF OBJECT_ID(N'foodshare.ExternalIdentities', N'U') IS NULL
BEGIN
  CREATE TABLE foodshare.ExternalIdentities (
    Provider NVARCHAR(30) NOT NULL,
    ProviderUserId NVARCHAR(255) NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ExternalIdentities PRIMARY KEY (Provider, ProviderUserId),
    CONSTRAINT FK_ExternalIdentities_User FOREIGN KEY (UserId) REFERENCES foodshare.Users(Id)
  );
END;
GO

GRANT SELECT ON OBJECT::foodshare.Users TO [foodshare_api];
GRANT INSERT, UPDATE ON OBJECT::foodshare.Users TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.Roles TO [foodshare_api];
GRANT SELECT, INSERT ON OBJECT::foodshare.UserRoles TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.VolunteerProfiles TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.OrganizationMembers TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.Organizations TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.OrganizationOrganizationTypes TO [foodshare_api];
GRANT SELECT ON OBJECT::foodshare.OrganizationTypes TO [foodshare_api];
GRANT SELECT, INSERT ON OBJECT::foodshare.ExternalIdentities TO [foodshare_api];
GO
