/* Fields used by persistent volunteer and institution registration. */
USE FoodShareDb;
GO

IF COL_LENGTH(N'foodshare.Organizations', N'OrganizationSubtype') IS NULL
  ALTER TABLE foodshare.Organizations ADD OrganizationSubtype NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'foodshare.VolunteerProfiles', N'OtherTransportType') IS NULL
  ALTER TABLE foodshare.VolunteerProfiles ADD OtherTransportType NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'foodshare.VolunteerProfiles', N'AvailabilityZone') IS NULL
  ALTER TABLE foodshare.VolunteerProfiles ADD AvailabilityZone NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'foodshare.VolunteerProfiles', N'AgreementAcceptedAt') IS NULL
  ALTER TABLE foodshare.VolunteerProfiles ADD AgreementAcceptedAt DATETIME2(0) NULL;
GO

GRANT INSERT ON OBJECT::foodshare.Organizations TO [foodshare_api];
GRANT UPDATE ON OBJECT::foodshare.Organizations TO [foodshare_api];
GRANT INSERT ON OBJECT::foodshare.OrganizationOrganizationTypes TO [foodshare_api];
GRANT INSERT, UPDATE ON OBJECT::foodshare.OrganizationMembers TO [foodshare_api];
GRANT INSERT ON OBJECT::foodshare.VolunteerProfiles TO [foodshare_api];
GO
