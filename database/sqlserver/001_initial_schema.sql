/*
  FoodShare - esquema inicial para Microsoft SQL Server.
  Ejecutar con una cuenta que pueda crear bases de datos.
*/
USE master;
GO

IF DB_ID(N'FoodShareDb') IS NULL
  CREATE DATABASE FoodShareDb;
GO

USE FoodShareDb;
GO

CREATE SCHEMA foodshare;
GO

CREATE TABLE foodshare.Roles (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  Code NVARCHAR(50) NOT NULL,
  Name NVARCHAR(100) NOT NULL,
  Description NVARCHAR(250) NULL,
  CONSTRAINT PK_Roles PRIMARY KEY (Id),
  CONSTRAINT UQ_Roles_Code UNIQUE (Code)
);
GO

CREATE TABLE foodshare.Users (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  FullName NVARCHAR(150) NOT NULL,
  Email NVARCHAR(254) NOT NULL,
  Phone NVARCHAR(30) NULL,
  AvatarUrl NVARCHAR(2048) NULL,
  AuthProvider NVARCHAR(30) NOT NULL DEFAULT N'google',
  ProviderUserId NVARCHAR(255) NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'active',
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Users PRIMARY KEY (Id),
  CONSTRAINT UQ_Users_Email UNIQUE (Email),
  CONSTRAINT UQ_Users_ProviderUser UNIQUE (AuthProvider, ProviderUserId),
  CONSTRAINT CK_Users_Status CHECK (Status IN (N'active', N'inactive', N'suspended'))
);
GO

CREATE TABLE foodshare.UserRoles (
  UserId UNIQUEIDENTIFIER NOT NULL,
  RoleId UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
  CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES foodshare.Roles(Id)
);
GO

CREATE TABLE foodshare.OrganizationTypes (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  Name NVARCHAR(100) NOT NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CONSTRAINT PK_OrganizationTypes PRIMARY KEY (Id),
  CONSTRAINT UQ_OrganizationTypes_Name UNIQUE (Name)
);
GO

CREATE TABLE foodshare.Organizations (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  Name NVARCHAR(150) NOT NULL,
  Rnc NVARCHAR(20) NULL,
  Email NVARCHAR(254) NOT NULL,
  Phone NVARCHAR(30) NOT NULL,
  AddressLine NVARCHAR(250) NOT NULL,
  City NVARCHAR(100) NOT NULL,
  Country NVARCHAR(100) NOT NULL DEFAULT N'República Dominicana',
  Latitude DECIMAL(9, 6) NULL,
  Longitude DECIMAL(9, 6) NULL,
  Reference NVARCHAR(250) NULL,
  LogoUrl NVARCHAR(2048) NULL,
  VerificationStatus NVARCHAR(20) NOT NULL DEFAULT N'pending',
  Status NVARCHAR(20) NOT NULL DEFAULT N'active',
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Organizations PRIMARY KEY (Id),
  CONSTRAINT UQ_Organizations_Rnc UNIQUE (Rnc),
  CONSTRAINT CK_Organizations_Verification CHECK (VerificationStatus IN (N'pending', N'under_review', N'verified', N'rejected')),
  CONSTRAINT CK_Organizations_Status CHECK (Status IN (N'active', N'inactive')),
  CONSTRAINT CK_Organizations_Latitude CHECK (Latitude IS NULL OR Latitude BETWEEN -90 AND 90),
  CONSTRAINT CK_Organizations_Longitude CHECK (Longitude IS NULL OR Longitude BETWEEN -180 AND 180)
);
GO

CREATE TABLE foodshare.OrganizationOrganizationTypes (
  OrganizationId UNIQUEIDENTIFIER NOT NULL,
  OrganizationTypeId UNIQUEIDENTIFIER NOT NULL,
  CONSTRAINT PK_OrganizationOrganizationTypes PRIMARY KEY (OrganizationId, OrganizationTypeId),
  CONSTRAINT FK_OOT_Organization FOREIGN KEY (OrganizationId) REFERENCES foodshare.Organizations(Id),
  CONSTRAINT FK_OOT_OrganizationType FOREIGN KEY (OrganizationTypeId) REFERENCES foodshare.OrganizationTypes(Id)
);
GO

CREATE TABLE foodshare.OrganizationMembers (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  OrganizationId UNIQUEIDENTIFIER NOT NULL,
  UserId UNIQUEIDENTIFIER NOT NULL,
  RoleId UNIQUEIDENTIFIER NOT NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_OrganizationMembers PRIMARY KEY (Id),
  CONSTRAINT UQ_OrganizationMembers UNIQUE (OrganizationId, UserId, RoleId),
  CONSTRAINT FK_OrganizationMembers_Organization FOREIGN KEY (OrganizationId) REFERENCES foodshare.Organizations(Id),
  CONSTRAINT FK_OrganizationMembers_User FOREIGN KEY (UserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_OrganizationMembers_Role FOREIGN KEY (RoleId) REFERENCES foodshare.Roles(Id)
);
GO

CREATE TABLE foodshare.Branches (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  OrganizationId UNIQUEIDENTIFIER NOT NULL,
  Name NVARCHAR(150) NOT NULL,
  Phone NVARCHAR(30) NULL,
  AddressLine NVARCHAR(250) NOT NULL,
  City NVARCHAR(100) NOT NULL,
  Country NVARCHAR(100) NOT NULL DEFAULT N'República Dominicana',
  Latitude DECIMAL(9, 6) NOT NULL,
  Longitude DECIMAL(9, 6) NOT NULL,
  Reference NVARCHAR(250) NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'active',
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Branches PRIMARY KEY (Id),
  CONSTRAINT FK_Branches_Organization FOREIGN KEY (OrganizationId) REFERENCES foodshare.Organizations(Id),
  CONSTRAINT CK_Branches_Status CHECK (Status IN (N'active', N'inactive')),
  CONSTRAINT CK_Branches_Latitude CHECK (Latitude BETWEEN -90 AND 90),
  CONSTRAINT CK_Branches_Longitude CHECK (Longitude BETWEEN -180 AND 180)
);
GO

CREATE TABLE foodshare.FoodCategories (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  Name NVARCHAR(100) NOT NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CONSTRAINT PK_FoodCategories PRIMARY KEY (Id),
  CONSTRAINT UQ_FoodCategories_Name UNIQUE (Name)
);
GO

CREATE TABLE foodshare.Donations (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  DonorOrganizationId UNIQUEIDENTIFIER NOT NULL,
  BranchId UNIQUEIDENTIFIER NOT NULL,
  FoodCategoryId UNIQUEIDENTIFIER NOT NULL,
  FoodName NVARCHAR(150) NOT NULL,
  Quantity DECIMAL(12, 2) NOT NULL,
  Unit NVARCHAR(20) NOT NULL,
  Description NVARCHAR(1000) NULL,
  AvailableUntil DATETIME2(0) NOT NULL,
  PickupStartsAt DATETIME2(0) NOT NULL,
  PickupEndsAt DATETIME2(0) NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'draft',
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Donations PRIMARY KEY (Id),
  CONSTRAINT FK_Donations_Organization FOREIGN KEY (DonorOrganizationId) REFERENCES foodshare.Organizations(Id),
  CONSTRAINT FK_Donations_Branch FOREIGN KEY (BranchId) REFERENCES foodshare.Branches(Id),
  CONSTRAINT FK_Donations_Category FOREIGN KEY (FoodCategoryId) REFERENCES foodshare.FoodCategories(Id),
  CONSTRAINT CK_Donations_Quantity CHECK (Quantity > 0),
  CONSTRAINT CK_Donations_Unit CHECK (Unit IN (N'kg', N'g', N'lb', N'unit', N'portion', N'box', N'package')),
  CONSTRAINT CK_Donations_Status CHECK (Status IN (N'draft', N'available', N'requested', N'reserved', N'in_pickup', N'picked_up', N'in_delivery', N'delivered', N'completed', N'expired', N'cancelled')),
  CONSTRAINT CK_Donations_PickupWindow CHECK (PickupEndsAt > PickupStartsAt)
);
GO

CREATE TABLE foodshare.DonationImages (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  DonationId UNIQUEIDENTIFIER NOT NULL,
  FileName NVARCHAR(255) NOT NULL,
  Url NVARCHAR(2048) NOT NULL,
  MimeType NVARCHAR(100) NOT NULL,
  SizeInBytes BIGINT NOT NULL,
  CONSTRAINT PK_DonationImages PRIMARY KEY (Id),
  CONSTRAINT FK_DonationImages_Donation FOREIGN KEY (DonationId) REFERENCES foodshare.Donations(Id),
  CONSTRAINT CK_DonationImages_Size CHECK (SizeInBytes > 0)
);
GO

CREATE TABLE foodshare.DonationRequests (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  DonationId UNIQUEIDENTIFIER NOT NULL,
  BeneficiaryOrganizationId UNIQUEIDENTIFIER NOT NULL,
  RequestedByUserId UNIQUEIDENTIFIER NOT NULL,
  QuantityRequested DECIMAL(12, 2) NULL,
  Observations NVARCHAR(1000) NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'pending',
  ReviewedByUserId UNIQUEIDENTIFIER NULL,
  ReviewedAt DATETIME2(0) NULL,
  RejectionReason NVARCHAR(500) NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_DonationRequests PRIMARY KEY (Id),
  CONSTRAINT FK_DonationRequests_Donation FOREIGN KEY (DonationId) REFERENCES foodshare.Donations(Id),
  CONSTRAINT FK_DonationRequests_Organization FOREIGN KEY (BeneficiaryOrganizationId) REFERENCES foodshare.Organizations(Id),
  CONSTRAINT FK_DonationRequests_Requester FOREIGN KEY (RequestedByUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_DonationRequests_Reviewer FOREIGN KEY (ReviewedByUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT CK_DonationRequests_Quantity CHECK (QuantityRequested IS NULL OR QuantityRequested > 0),
  CONSTRAINT CK_DonationRequests_Status CHECK (Status IN (N'pending', N'accepted', N'rejected', N'cancelled'))
);
GO

CREATE TABLE foodshare.VolunteerProfiles (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  UserId UNIQUEIDENTIFIER NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'available',
  TransportType NVARCHAR(20) NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_VolunteerProfiles PRIMARY KEY (Id),
  CONSTRAINT UQ_VolunteerProfiles_User UNIQUE (UserId),
  CONSTRAINT FK_VolunteerProfiles_User FOREIGN KEY (UserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT CK_VolunteerProfiles_Status CHECK (Status IN (N'available', N'unavailable', N'inactive')),
  CONSTRAINT CK_VolunteerProfiles_Transport CHECK (TransportType IS NULL OR TransportType IN (N'walking', N'bicycle', N'motorcycle', N'car', N'van'))
);
GO

CREATE TABLE foodshare.Deliveries (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  DonationId UNIQUEIDENTIFIER NOT NULL,
  DonationRequestId UNIQUEIDENTIFIER NOT NULL,
  VolunteerUserId UNIQUEIDENTIFIER NULL,
  PickupAddress NVARCHAR(250) NOT NULL,
  PickupLatitude DECIMAL(9, 6) NOT NULL,
  PickupLongitude DECIMAL(9, 6) NOT NULL,
  DeliveryAddress NVARCHAR(250) NOT NULL,
  DeliveryLatitude DECIMAL(9, 6) NOT NULL,
  DeliveryLongitude DECIMAL(9, 6) NOT NULL,
  ScheduledAt DATETIME2(0) NULL,
  PickedUpAt DATETIME2(0) NULL,
  DeliveredAt DATETIME2(0) NULL,
  RecipientConfirmedAt DATETIME2(0) NULL,
  Status NVARCHAR(25) NOT NULL DEFAULT N'pending_assignment',
  Observations NVARCHAR(1000) NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Deliveries PRIMARY KEY (Id),
  CONSTRAINT UQ_Deliveries_DonationRequest UNIQUE (DonationRequestId),
  CONSTRAINT FK_Deliveries_Donation FOREIGN KEY (DonationId) REFERENCES foodshare.Donations(Id),
  CONSTRAINT FK_Deliveries_Request FOREIGN KEY (DonationRequestId) REFERENCES foodshare.DonationRequests(Id),
  CONSTRAINT FK_Deliveries_Volunteer FOREIGN KEY (VolunteerUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT CK_Deliveries_Status CHECK (Status IN (N'pending_assignment', N'assigned', N'in_pickup', N'picked_up', N'in_delivery', N'delivered', N'completed', N'cancelled')),
  CONSTRAINT CK_Deliveries_PickupLatitude CHECK (PickupLatitude BETWEEN -90 AND 90),
  CONSTRAINT CK_Deliveries_PickupLongitude CHECK (PickupLongitude BETWEEN -180 AND 180),
  CONSTRAINT CK_Deliveries_DeliveryLatitude CHECK (DeliveryLatitude BETWEEN -90 AND 90),
  CONSTRAINT CK_Deliveries_DeliveryLongitude CHECK (DeliveryLongitude BETWEEN -180 AND 180)
);
GO

CREATE TABLE foodshare.Notifications (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  UserId UNIQUEIDENTIFIER NOT NULL,
  Type NVARCHAR(20) NOT NULL,
  Title NVARCHAR(150) NOT NULL,
  Message NVARCHAR(500) NOT NULL,
  IsRead BIT NOT NULL DEFAULT 0,
  RelatedEntityId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Notifications PRIMARY KEY (Id),
  CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT CK_Notifications_Type CHECK (Type IN (N'donation', N'request', N'delivery', N'system'))
);
GO

CREATE TABLE foodshare.Incidents (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  ReportedByUserId UNIQUEIDENTIFIER NOT NULL,
  DonationId UNIQUEIDENTIFIER NULL,
  DeliveryId UNIQUEIDENTIFIER NULL,
  Description NVARCHAR(1500) NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT N'open',
  ResolvedByUserId UNIQUEIDENTIFIER NULL,
  ResolvedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Incidents PRIMARY KEY (Id),
  CONSTRAINT FK_Incidents_Reporter FOREIGN KEY (ReportedByUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_Incidents_Donation FOREIGN KEY (DonationId) REFERENCES foodshare.Donations(Id),
  CONSTRAINT FK_Incidents_Delivery FOREIGN KEY (DeliveryId) REFERENCES foodshare.Deliveries(Id),
  CONSTRAINT FK_Incidents_Resolver FOREIGN KEY (ResolvedByUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT CK_Incidents_Status CHECK (Status IN (N'open', N'in_review', N'resolved', N'closed'))
);
GO

CREATE TABLE foodshare.Reputations (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
  RatedUserId UNIQUEIDENTIFIER NOT NULL,
  RatedByUserId UNIQUEIDENTIFIER NOT NULL,
  DeliveryId UNIQUEIDENTIFIER NOT NULL,
  Score TINYINT NOT NULL,
  Comment NVARCHAR(500) NULL,
  CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_Reputations PRIMARY KEY (Id),
  CONSTRAINT UQ_Reputations_RaterDelivery UNIQUE (RatedByUserId, DeliveryId),
  CONSTRAINT FK_Reputations_Rated FOREIGN KEY (RatedUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_Reputations_Rater FOREIGN KEY (RatedByUserId) REFERENCES foodshare.Users(Id),
  CONSTRAINT FK_Reputations_Delivery FOREIGN KEY (DeliveryId) REFERENCES foodshare.Deliveries(Id),
  CONSTRAINT CK_Reputations_Score CHECK (Score BETWEEN 1 AND 5),
  CONSTRAINT CK_Reputations_DifferentUsers CHECK (RatedUserId <> RatedByUserId)
);
GO

CREATE TABLE foodshare.PlatformSettings (
  [Key] NVARCHAR(100) NOT NULL,
  [Value] NVARCHAR(MAX) NOT NULL,
  UpdatedByUserId UNIQUEIDENTIFIER NULL,
  UpdatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_PlatformSettings PRIMARY KEY ([Key]),
  CONSTRAINT FK_PlatformSettings_User FOREIGN KEY (UpdatedByUserId) REFERENCES foodshare.Users(Id)
);
GO

CREATE INDEX IX_Branches_OrganizationId ON foodshare.Branches(OrganizationId);
CREATE INDEX IX_Donations_Search ON foodshare.Donations(Status, FoodCategoryId, AvailableUntil);
CREATE INDEX IX_DonationRequests_DonationId ON foodshare.DonationRequests(DonationId, Status);
CREATE INDEX IX_DonationRequests_BeneficiaryId ON foodshare.DonationRequests(BeneficiaryOrganizationId, Status);
CREATE INDEX IX_Deliveries_VolunteerId ON foodshare.Deliveries(VolunteerUserId, Status);
CREATE INDEX IX_Notifications_UserUnread ON foodshare.Notifications(UserId, IsRead, CreatedAt DESC);
GO

INSERT INTO foodshare.Roles (Code, Name, Description) VALUES
  (N'foodshare_admin', N'Administrador de FoodShare', N'Administración global de la plataforma'),
  (N'organization_admin', N'Administrador de organización', N'Administración de una institución'),
  (N'donation_manager', N'Gestor de donaciones', N'Gestión de donaciones y solicitudes'),
  (N'logistics_volunteer', N'Logística y voluntariado', N'Recogida y entrega de alimentos'),
  (N'basic_user', N'Usuario básico', N'Acceso limitado según asignación');

INSERT INTO foodshare.FoodCategories (Name) VALUES
  (N'Panadería'), (N'Frutas'), (N'Verduras'), (N'Lácteos'), (N'Comidas preparadas'), (N'Productos no perecederos');

INSERT INTO foodshare.OrganizationTypes (Name) VALUES
  (N'Donante'), (N'Beneficiaria');
GO
