import { Component, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AccountProfile, AdminDashboardSnapshot, AdminReportSnapshot, AdminUser, AppRole, AuthService, FoodCategory, OrganizationApplication, OrganizationApplicationStatus, OrganizationCategory } from '../../services/auth.service';

type AdminSection = 'dashboard' | 'users' | 'organizations' | 'catalogs' | 'reports' | 'settings';
type SettingsSubsection = null | 'account' | 'notifications' | 'locale' | 'security';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  imports: [IonContent, RouterLink],
})
export class AdminPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly pendingOrganizations = this.auth.pendingOrganizations;
  readonly session = this.auth.session;
  readonly dashboard = signal<AdminDashboardSnapshot | null>(null);
  readonly report = signal<AdminReportSnapshot | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError = signal('');
  readonly reportPeriod = signal<'month' | 'quarter' | 'halfYear' | 'year'>('month');
  readonly foodCategories = signal<FoodCategory[]>([]);
  readonly organizationCategories = signal<OrganizationCategory[]>([]);
  readonly catalogLoading = signal(false);
  readonly catalogSaving = signal(false);
  readonly catalogError = signal('');
  readonly newFoodCategory = signal('');
  readonly newOrganizationCategory = signal('');
  readonly newOrganizationType = signal<'donor' | 'beneficiary'>('donor');
  readonly dashboardLoading = signal(false);
  readonly dashboardError = signal('');
  readonly section = signal<AdminSection>('dashboard');
  readonly menuOpen = signal(false);
  readonly settingsSubsection = signal<SettingsSubsection>(null);
  readonly notificationsEnabled = signal(this.loadNotificationPref());
  readonly settingsSaved = signal(false);
  readonly settingsSavedMessage = signal('');
  readonly accountProfile = signal<AccountProfile | null>(null);
  readonly accountLoading = signal(false);
  readonly accountError = signal('');
  readonly accountEditingName = signal(false);
  readonly accountEditName = signal('');
  readonly accountEditPhone = signal('');
  readonly accountSaving = signal(false);
  readonly passwordCurrent = signal('');
  readonly passwordNew = signal('');
  readonly passwordConfirm = signal('');
  readonly passwordChanging = signal(false);
  readonly passwordError = signal('');
  readonly passwordShowCurrent = signal(false);
  readonly passwordShowNew = signal(false);

  // Notification detailed settings
  readonly notifyNewOrgs = signal(this.loadBoolPref('fs_admin_notify_orgs', true));
  readonly notifyNewUsers = signal(this.loadBoolPref('fs_admin_notify_users', true));
  readonly notifyNewDonations = signal(this.loadBoolPref('fs_admin_notify_donations', true));
  readonly notifyDeliveries = signal(this.loadBoolPref('fs_admin_notify_deliveries', true));
  readonly notifyEmail = signal(this.loadBoolPref('fs_admin_notify_email', false));
  readonly notifyDailyDigest = signal(this.loadBoolPref('fs_admin_notify_digest', false));

  // Locale detailed settings
  readonly localeLanguage = signal(localStorage.getItem('fs_admin_locale_lang') || 'es-DO');
  readonly localeCountry = signal(localStorage.getItem('fs_admin_locale_country') || 'DO');
  readonly localeTimezone = signal(localStorage.getItem('fs_admin_locale_tz') || 'America/Santo_Domingo');
  readonly localeDateFormat = signal(localStorage.getItem('fs_admin_locale_date_format') || 'DD/MM/YYYY');
  readonly localeWeightUnit = signal(localStorage.getItem('fs_admin_locale_weight_unit') || 'kg');
  readonly organizations = signal<OrganizationApplication[]>([]);
  readonly organizationsLoading = signal(false);
  readonly organizationsError = signal('');
  readonly organizationActionError = signal('');
  readonly organizationTab = signal<OrganizationApplicationStatus>('pending');
  readonly organizationSearch = signal('');
  readonly reviewingOrganizationId = signal<string | null>(null);
  readonly visibleOrganizations = computed(() => {
    const search = this.organizationSearch().trim().toLocaleLowerCase();
    return this.organizations().filter((organization) => organization.status === this.organizationTab()
      && (!search || organization.organizationName.toLocaleLowerCase().includes(search)
        || organization.email.toLocaleLowerCase().includes(search)
        || organization.representativeName.toLocaleLowerCase().includes(search)));
  });
  readonly users = signal<AdminUser[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal('');
  readonly userSearch = signal('');
  readonly userRoleFilter = signal<'all' | AppRole>('all');
  readonly userStatusFilter = signal<'all' | 'active' | 'inactive' | 'pending'>('all');
  readonly filteredUsers = computed(() => {
    const search = this.userSearch().trim().toLocaleLowerCase();
    return this.users().filter((user) => {
      const matchesSearch = !search || user.fullName.toLocaleLowerCase().includes(search) || user.email.toLocaleLowerCase().includes(search);
      const matchesRole = this.userRoleFilter() === 'all' || user.role === this.userRoleFilter();
      const matchesStatus = this.userStatusFilter() === 'all' || user.status === this.userStatusFilter();
      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  constructor() {
    this.loadOrganizations();
    this.loadUsers();
    this.loadDashboard();
    this.loadCatalogs();
  }

  select(section: AdminSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
    this.settingsSubsection.set(null);
    this.settingsSaved.set(false);
    if (section === 'reports') this.loadReport();
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openProfile(): void { void this.router.navigateByUrl('/app/profile'); }

  // Settings
  openSettingsSubsection(sub: SettingsSubsection): void { this.settingsSubsection.set(sub); this.settingsSaved.set(false); }
  closeSettingsSubsection(): void { this.settingsSubsection.set(null); this.settingsSaved.set(false); }

  openAccountSubsection(): void {
    this.openSettingsSubsection('account');
    this.loadAccountDetails();
  }

  loadAccountDetails(): void {
    this.accountLoading.set(true);
    this.accountError.set('');
    this.auth.loadAccountProfile().subscribe({
      next: (profile) => { this.accountProfile.set(profile); this.accountLoading.set(false); },
      error: (error: Error) => { this.accountError.set(error.message || 'No se pudo cargar el perfil.'); this.accountLoading.set(false); },
    });
  }

  startEditingName(): void {
    const profile = this.accountProfile();
    this.accountEditName.set(profile?.fullName ?? '');
    this.accountEditPhone.set(profile?.phone ?? '');
    this.accountEditingName.set(true);
  }

  cancelEditingName(): void { this.accountEditingName.set(false); }

  saveAccountName(): void {
    const name = this.accountEditName().trim();
    const phone = this.accountEditPhone().trim();
    if (!name) return;
    this.accountSaving.set(true);
    this.auth.updateAccountProfile(name, phone).subscribe({
      next: () => {
        this.accountSaving.set(false);
        this.accountEditingName.set(false);
        this.loadAccountDetails();
        this.flashSaved('Perfil actualizado.');
      },
      error: (error: Error) => {
        this.accountError.set(error.message || 'No se pudo guardar.');
        this.accountSaving.set(false);
      },
    });
  }

  setAccountEditName(event: Event): void { this.accountEditName.set((event.target as HTMLInputElement).value); }
  setAccountEditPhone(event: Event): void { this.accountEditPhone.set((event.target as HTMLInputElement).value); }
  setPasswordCurrent(event: Event): void { this.passwordCurrent.set((event.target as HTMLInputElement).value); }
  setPasswordNew(event: Event): void { this.passwordNew.set((event.target as HTMLInputElement).value); }
  setPasswordConfirm(event: Event): void { this.passwordConfirm.set((event.target as HTMLInputElement).value); }
  togglePasswordShowCurrent(): void { this.passwordShowCurrent.update((v) => !v); }
  togglePasswordShowNew(): void { this.passwordShowNew.update((v) => !v); }

  changePassword(): void {
    this.passwordError.set('');
    const newPwd = this.passwordNew().trim();
    const confirm = this.passwordConfirm().trim();
    if (!newPwd || newPwd.length < 6) { this.passwordError.set('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPwd !== confirm) { this.passwordError.set('Las contraseñas no coinciden.'); return; }
    this.passwordChanging.set(true);
    this.auth.updatePassword(newPwd).subscribe({
      next: () => {
        this.passwordChanging.set(false);
        this.passwordCurrent.set('');
        this.passwordNew.set('');
        this.passwordConfirm.set('');
        this.flashSaved('Contraseña actualizada correctamente.');
      },
      error: (error: Error) => {
        this.passwordError.set(error.message || 'No se pudo cambiar la contraseña.');
        this.passwordChanging.set(false);
      },
    });
  }

  accountCreatedAt(): string {
    const profile = this.accountProfile();
    if (!profile) return '';
    return new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  toggleNotifications(): void {
    this.notificationsEnabled.update((v) => !v);
    localStorage.setItem('fs_admin_notifications', this.notificationsEnabled() ? '1' : '0');
    this.flashSaved('Preferencia guardada.');
  }

  private flashSaved(message: string): void {
    this.settingsSavedMessage.set(message);
    this.settingsSaved.set(true);
    setTimeout(() => this.settingsSaved.set(false), 2500);
  }

  toggleNotifyNewOrgs(): void {
    this.notifyNewOrgs.update((v) => !v);
    localStorage.setItem('fs_admin_notify_orgs', this.notifyNewOrgs() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  toggleNotifyNewUsers(): void {
    this.notifyNewUsers.update((v) => !v);
    localStorage.setItem('fs_admin_notify_users', this.notifyNewUsers() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  toggleNotifyNewDonations(): void {
    this.notifyNewDonations.update((v) => !v);
    localStorage.setItem('fs_admin_notify_donations', this.notifyNewDonations() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  toggleNotifyDeliveries(): void {
    this.notifyDeliveries.update((v) => !v);
    localStorage.setItem('fs_admin_notify_deliveries', this.notifyDeliveries() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  toggleNotifyEmail(): void {
    this.notifyEmail.update((v) => !v);
    localStorage.setItem('fs_admin_notify_email', this.notifyEmail() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  toggleNotifyDailyDigest(): void {
    this.notifyDailyDigest.update((v) => !v);
    localStorage.setItem('fs_admin_notify_digest', this.notifyDailyDigest() ? '1' : '0');
    this.flashSaved('Preferencia de alertas actualizada.');
  }

  resetNotificationPreferences(): void {
    this.notificationsEnabled.set(true);
    this.notifyNewOrgs.set(true);
    this.notifyNewUsers.set(true);
    this.notifyNewDonations.set(true);
    this.notifyDeliveries.set(true);
    this.notifyEmail.set(false);
    this.notifyDailyDigest.set(false);
    localStorage.setItem('fs_admin_notifications', '1');
    localStorage.setItem('fs_admin_notify_orgs', '1');
    localStorage.setItem('fs_admin_notify_users', '1');
    localStorage.setItem('fs_admin_notify_donations', '1');
    localStorage.setItem('fs_admin_notify_deliveries', '1');
    localStorage.setItem('fs_admin_notify_email', '0');
    localStorage.setItem('fs_admin_notify_digest', '0');
    this.flashSaved('Preferencias de notificaciones restablecidas.');
  }

  setLocaleLanguage(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.localeLanguage.set(val);
    localStorage.setItem('fs_admin_locale_lang', val);
  }

  setLocaleCountry(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.localeCountry.set(val);
    localStorage.setItem('fs_admin_locale_country', val);
  }

  setLocaleTimezone(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.localeTimezone.set(val);
    localStorage.setItem('fs_admin_locale_tz', val);
  }

  setLocaleDateFormat(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.localeDateFormat.set(val);
    localStorage.setItem('fs_admin_locale_date_format', val);
  }

  setLocaleWeightUnit(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.localeWeightUnit.set(val);
    localStorage.setItem('fs_admin_locale_weight_unit', val);
  }

  saveLocalePreferences(): void {
    this.flashSaved('Configuración regional guardada exitosamente.');
  }

  private loadBoolPref(key: string, defaultValue: boolean): boolean {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val === '1';
  }

  private loadNotificationPref(): boolean {
    return localStorage.getItem('fs_admin_notifications') !== '0';
  }

  supabaseUrlMasked(): string {
    try {
      const url = new URL((globalThis as typeof globalThis & { FOODSHARE_CONFIG?: { supabaseUrl?: string } }).FOODSHARE_CONFIG?.supabaseUrl ?? '');
      return url.hostname;
    } catch { return 'No configurado'; }
  }

  async signOutFromSettings(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/login');
  }

  loadDashboard(): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set('');
    this.auth.loadAdminDashboard().subscribe({
      next: (snapshot) => { this.dashboard.set(snapshot); this.dashboardLoading.set(false); },
      error: (error: Error) => { this.dashboardError.set(error.message || 'No se pudieron cargar las metricas.'); this.dashboardLoading.set(false); },
    });
  }

  loadReport(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (this.reportPeriod() === 'quarter') start.setMonth(start.getMonth() - 2);
    else if (this.reportPeriod() === 'halfYear') start.setMonth(start.getMonth() - 5);
    else if (this.reportPeriod() === 'year') start.setMonth(0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.reportLoading.set(true); this.reportError.set('');
    this.auth.loadAdminReport(start.toISOString(), end.toISOString()).subscribe({
      next: (snapshot) => { this.report.set(snapshot); this.reportLoading.set(false); },
      error: (error: Error) => { this.reportError.set(error.message || 'No se pudo generar el reporte.'); this.reportLoading.set(false); },
    });
  }

  setReportPeriod(event: Event): void {
    this.reportPeriod.set((event.target as HTMLSelectElement).value as 'month' | 'quarter' | 'halfYear' | 'year');
    this.loadReport();
  }

  reportPeriodLabel(): string {
    return ({ month: 'Este mes', quarter: 'Ultimos 3 meses', halfYear: 'Ultimos 6 meses', year: 'Este ano' })[this.reportPeriod()];
  }

  exportReport(): void {
    const report = this.report(); if (!report) return;
    const lines = [
      ['Periodo', this.reportPeriodLabel()],
      ['Donaciones publicadas', String(report.donationCount)],
      ['Kilogramos estimados', String(Number(report.estimatedKilograms.toFixed(2)))],
      ['Organizaciones donantes participantes', String(report.participatingDonors)],
      ['Entregas completadas', String(report.completedDeliveries)],
      [],
      ['Categoria', 'Donaciones', 'Kilogramos estimados'],
      ...report.categoryBreakdown.map((item) => [item.name, String(item.donationCount), String(Number(item.estimatedKilograms.toFixed(2)))]),
      [],
      ['Alimento', 'Categoria', 'Cantidad', 'Unidad', 'Estado', 'Fecha de publicacion'],
      ...report.donations.map((item) => [item.foodName, item.categoryName, String(item.quantity), item.unit, item.status, new Date(item.createdAt).toLocaleString('es-DO')]),
    ];
    const csv = '\uFEFF' + lines.map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `foodshare-reporte-${this.reportPeriod()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  donationCount(): number {
    const dashboard = this.dashboard();
    return dashboard ? dashboard.availableDonations + dashboard.reservedDonations + dashboard.inDeliveryDonations : 0;
  }

  donationStatusGradient(): string {
    const dashboard = this.dashboard();
    if (!dashboard) return 'conic-gradient(#e7ece7 0 100%)';
    const total = this.donationCount();
    if (!total) return 'conic-gradient(#e7ece7 0 100%)';
    const availableEnd = (dashboard.availableDonations / total) * 100;
    const reservedEnd = availableEnd + (dashboard.reservedDonations / total) * 100;
    return `conic-gradient(#2e7d4b 0 ${availableEnd}%, #f6a33f ${availableEnd}% ${reservedEnd}%, #8abce5 ${reservedEnd}% 100%)`;
  }

  formattedKilograms(value: number): string { return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 }).format(value); }
  recentAge(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return `Hace ${Math.floor(hours / 24)} d`;
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set('');
    this.auth.loadAdminUsers().subscribe({
      next: (users) => { this.users.set(users); this.usersLoading.set(false); },
      error: (error: Error) => { this.usersError.set(error.message || 'No se pudieron cargar los usuarios.'); this.usersLoading.set(false); },
    });
  }

  loadOrganizations(): void {
    this.organizationsLoading.set(true);
    this.organizationsError.set('');
    this.auth.loadAdminOrganizations().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.auth.setPendingOrganizations(organizations.filter((organization) => organization.status === 'pending'));
        this.organizationsLoading.set(false);
      },
      error: (error: Error) => { this.organizationsError.set(error.message || 'No se pudieron cargar las instituciones.'); this.organizationsLoading.set(false); },
    });
  }

  loadCatalogs(): void {
    this.catalogLoading.set(true); this.catalogError.set('');
    const foods = new Promise<FoodCategory[] | null>((resolve) => this.auth.loadFoodCategories(true).subscribe({ next: resolve, error: () => resolve(null) }));
    const organizations = new Promise<OrganizationCategory[] | null>((resolve) => this.auth.loadOrganizationCategories(true).subscribe({ next: resolve, error: () => resolve(null) }));
    Promise.all([foods, organizations]).then(([foodRows, organizationRows]) => {
      if (foodRows) this.foodCategories.set(foodRows);
      if (organizationRows) this.organizationCategories.set(organizationRows);
      if (!foodRows || !organizationRows) this.catalogError.set('No se pudieron cargar todos los catalogos. Aplica la migracion supabase/migrations/20261025000000_foodshare_admin_catalogs.sql en Supabase y vuelve a actualizar.');
    }).finally(() => this.catalogLoading.set(false));
  }

  setNewFoodCategory(event: Event): void { this.newFoodCategory.set((event.target as HTMLInputElement).value); }
  setNewOrganizationCategory(event: Event): void { this.newOrganizationCategory.set((event.target as HTMLInputElement).value); }
  setNewOrganizationType(event: Event): void { this.newOrganizationType.set((event.target as HTMLSelectElement).value as 'donor' | 'beneficiary'); }
  addFoodCategory(): void {
    const name = this.newFoodCategory().trim(); if (!name || this.catalogSaving()) return;
    this.saveCatalog(this.auth.addFoodCategory(name), () => { this.newFoodCategory.set(''); this.loadCatalogs(); });
  }
  toggleFoodCategory(category: FoodCategory): void { this.saveCatalog(this.auth.setFoodCategoryActive(category.id, !category.active), () => this.loadCatalogs()); }
  addOrganizationCategory(): void {
    const name = this.newOrganizationCategory().trim(); if (!name || this.catalogSaving()) return;
    this.saveCatalog(this.auth.addOrganizationCategory(this.newOrganizationType(), name), () => { this.newOrganizationCategory.set(''); this.loadCatalogs(); });
  }
  toggleOrganizationCategory(category: OrganizationCategory): void { this.saveCatalog(this.auth.setOrganizationCategoryActive(category.id, !category.active), () => this.loadCatalogs()); }
  organizationCategoriesFor(type: string): OrganizationCategory[] { return this.organizationCategories().filter((category) => category.organizationType === type); }
  private saveCatalog(operation: import('rxjs').Observable<void>, onSuccess: () => void): void {
    this.catalogSaving.set(true); this.catalogError.set('');
    operation.subscribe({ next: () => { this.catalogSaving.set(false); onSuccess(); }, error: (error: Error) => { this.catalogError.set(error.message || 'No se pudo guardar el catalogo.'); this.catalogSaving.set(false); } });
  }
  selectOrganizationTab(status: OrganizationApplicationStatus): void { this.organizationTab.set(status); this.organizationActionError.set(''); }
  setOrganizationSearch(event: Event): void { this.organizationSearch.set((event.target as HTMLInputElement).value); }
  organizationCount(status: OrganizationApplicationStatus): number { return this.organizations().filter((organization) => organization.status === status).length; }
  organizationStatusLabel(status: OrganizationApplicationStatus): string { return ({ pending: 'Pendiente', approved: 'Verificada', rejected: 'Rechazada' })[status]; }

  setUserSearch(event: Event): void { this.userSearch.set((event.target as HTMLInputElement).value); }
  setUserRoleFilter(event: Event): void { this.userRoleFilter.set((event.target as HTMLSelectElement).value as 'all' | AppRole); }
  setUserStatusFilter(event: Event): void { this.userStatusFilter.set((event.target as HTMLSelectElement).value as 'all' | 'active' | 'inactive' | 'pending'); }
  roleLabel(role: AppRole): string { return ({ admin: 'Administracion', donor: 'Donante', beneficiary: 'Beneficiario', volunteer: 'Voluntariado' })[role]; }
  statusLabel(status: string): string { return ({ active: 'Activo', inactive: 'Inactivo', pending: 'Pendiente' })[status as 'active' | 'inactive' | 'pending'] ?? status; }
  registrationDate(value: string): string { return new Date(value).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }); }

  approveOrganization(id: string): void { this.reviewOrganization(id, 'approved'); }
  rejectOrganization(id: string): void { this.reviewOrganization(id, 'rejected'); }

  private reviewOrganization(id: string, status: 'approved' | 'rejected'): void {
    this.organizationActionError.set('');
    this.reviewingOrganizationId.set(id);
    this.auth.reviewOrganization(id, status).subscribe({
      next: () => {
        const updated = this.organizations().map((organization) => organization.id === id ? { ...organization, status } : organization);
        this.organizations.set(updated);
        this.auth.setPendingOrganizations(updated.filter((organization) => organization.status === 'pending'));
        this.reviewingOrganizationId.set(null);
      },
      error: (error: Error) => {
        this.organizationActionError.set(error.message || 'No se pudo actualizar la institucion.');
        this.reviewingOrganizationId.set(null);
      },
    });
  }
}
