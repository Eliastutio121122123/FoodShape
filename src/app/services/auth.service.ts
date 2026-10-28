import { Injectable, computed, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AppRole = 'admin' | 'donor' | 'beneficiary' | 'volunteer';
export interface AuthSession { email: string; role: AppRole; }
export interface LoginResponse { email: string; role: AppRole; accessToken: string; expiresAt: string; }
export type OrganizationApplicationStatus = 'pending' | 'approved' | 'rejected';
export interface FoodCategory { id: string; name: string; active: boolean; }
export interface OrganizationCategory { id: string; organizationType: 'donor' | 'beneficiary'; name: string; active: boolean; }
export interface OrganizationApplication {
  id: string; email: string; role: Extract<AppRole, 'donor' | 'beneficiary'>;
  organizationName: string; rnc: string; phone: string; address: string; city: string;
  representativeName: string; profileType?: string; status: OrganizationApplicationStatus; submittedAt: string;
}
export interface AdminUser {
  id: string; email: string; fullName: string; role: AppRole; status: string;
  createdAt: string; organizationName: string | null;
}
export interface AdminDashboardSnapshot {
  donatedKilograms: number;
  activeOrganizations: number;
  activeVolunteers: number;
  completedDeliveries: number;
  availableDonations: number;
  reservedDonations: number;
  inDeliveryDonations: number;
  monthlyDonations: { label: string; kilograms: number; height: number }[];
  recentDonations: { id: string; foodName: string; quantity: number; unit: string; donorName: string; createdAt: string }[];
}
export interface AdminReportDonation { id: string; foodName: string; categoryName: string; quantity: number; unit: string; status: string; createdAt: string; donorOrganizationId: string; }
export type VolunteerDeliveryStatus = 'pending' | 'assigned' | 'pickup_in_progress' | 'picked_up' | 'delivered' | 'cancelled';
export interface VolunteerDeliveryItem {
  id: string;
  status: VolunteerDeliveryStatus;
  pickupAt: string | null;
  deliveredAt: string | null;
  foodName: string;
  quantity: number;
  unit: string;
  pickupAddress: string;
  pickupCity: string;
  pickupStartsAt: string | null;
  donorName: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryCity: string;
  notes: string | null;
}
export interface VolunteerDashboardSnapshot {
  volunteerStatus: string;
  activeDeliveries: VolunteerDeliveryItem[];
  completedThisMonth: number;
  totalCompleted: number;
}
export interface AdminReportSnapshot {
  donationCount: number; estimatedKilograms: number; participatingDonors: number; completedDeliveries: number;
  categoryBreakdown: { name: string; donationCount: number; estimatedKilograms: number; percent: number }[];
  donations: AdminReportDonation[];
}
export interface AccountProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: AppRole;
  status: string;
  avatarUrl?: string | null;
  organization?: {
    name: string;
    organizationType: string;
    verificationStatus: string;
    rnc: string | null;
    address: string;
    city: string;
    representativeName: string;
    profileType: string | null;
  };
  volunteer?: {
    transportType: string | null;
    otherTransportType: string | null;
    availabilityZone: string;
    status: string;
  };
}
export interface RegistrationPayload {
  role: Extract<AppRole, 'donor' | 'beneficiary' | 'volunteer'>; email: string; password: string; fullName: string;
  organizationName?: string; rnc?: string; phone: string; address?: string; city?: string; profileType?: string;
  transportType?: string; otherTransportType?: string; availabilityZone?: string; agreementAccepted?: boolean;
}

const roles: AppRole[] = ['admin', 'donor', 'beneficiary', 'volunteer'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  private readonly sessionState = signal<AuthSession | null>(null);
  private readonly readyPromise: Promise<void>;
  private readonly applicationsState = signal<readonly OrganizationApplication[]>([]);
  private readonly currentAvatarState = signal<string | null>(null);
  readonly currentAvatarUrl = this.currentAvatarState.asReadonly();
  readonly session = this.sessionState.asReadonly();
  readonly organizationApplications = this.applicationsState.asReadonly();
  readonly pendingOrganizations = computed(() => this.applicationsState().filter((application) => application.status === 'pending'));
  readonly currentRole = computed(() => this.sessionState()?.role ?? null);
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { this.sessionState.set(null); return; }
      queueMicrotask(() => void this.loadSession(session.user.id, session.user.email ?? ''));
    });
    this.readyPromise = this.restoreSession();
  }

  ready(): Promise<void> { return this.readyPromise; }

  signIn(email: string, role: AppRole): void { this.sessionState.set({ email: email.trim().toLowerCase(), role }); }

  async refreshSession(): Promise<AuthSession | null> {
    await this.restoreSession();
    return this.sessionState();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return from((async () => {
      let stage: 'authentication' | 'profile' = 'authentication';
      try {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error || !data.session) throw error ?? new Error('No se pudo iniciar sesion.');
        stage = 'profile';
        const role = await this.getActiveRole(data.user.id);
        if (!role) {
          await this.supabase.auth.signOut();
          throw new Error('El perfil todavia no esta aprobado o no esta activo.');
        }
        const result = { email: data.user.email ?? email, role, accessToken: data.session.access_token, expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString() };
        this.sessionState.set({ email: result.email, role });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/failed to fetch|networkerror|load failed/i.test(message)) {
          throw new Error(stage === 'authentication'
            ? 'El navegador no pudo conectar con Supabase Auth. Comprueba la conexion o si el navegador esta bloqueando la solicitud.'
            : 'La autenticacion respondio, pero no se pudo consultar tu perfil en Supabase. Revisa la conexion y las politicas de public.profiles.');
        }
        throw error;
      }
    })());
  }

  loginWithGoogle(): Promise<void> {
    return this.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/login` } }).then(({ error }) => {
      if (error) throw error;
    });
  }

  registerAccount(payload: RegistrationPayload): Observable<{ email: string; role: string; status: string }> {
    return from((async () => {
      const { data, error } = await this.supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: {
          role: payload.role, full_name: payload.fullName, phone: payload.phone,
          organization_name: payload.organizationName, rnc: payload.rnc, address: payload.address,
          city: payload.city, profile_type: payload.profileType, transport_type: payload.transportType,
          other_transport_type: payload.otherTransportType, availability_zone: payload.availabilityZone,
          agreement_accepted: payload.agreementAccepted === true,
        } },
      });
      if (error) throw error;
      return { email: data.user?.email ?? payload.email, role: payload.role, status: payload.role === 'volunteer' ? 'active' : 'pending' };
    })());
  }

  loadAccountProfile(): Observable<AccountProfile> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesiÃƒÂ³n para consultar tu perfil.');

      const { data: profile, error: profileError } = await this.supabase.from('profiles')
        .select('id, email, full_name, phone, role, status')
        .eq('id', user.id).single();
      if (profileError) throw profileError;

      let avatarUrl: string | null = null;
      try {
        avatarUrl = localStorage.getItem('foodshare_avatar_' + user.id);
      } catch {}
      if (!avatarUrl && user.user_metadata && user.user_metadata['avatar_url']) {
        avatarUrl = user.user_metadata['avatar_url'] as string;
      }
      if (!avatarUrl && (profile as Record<string, unknown>)['avatar_url']) {
        avatarUrl = (profile as Record<string, unknown>)['avatar_url'] as string;
      }
      this.currentAvatarState.set(avatarUrl);

      const account: AccountProfile = {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        role: profile.role as AppRole,
        status: profile.status,
        avatarUrl,
      };

      if (account.role === 'donor' || account.role === 'beneficiary') {
        const { data: organization, error } = await this.supabase.from('organizations')
          .select('name, organization_type, verification_status, rnc, address, city, representative_name, profile_type')
          .eq('owner_id', user.id).maybeSingle();
        if (error) throw error;
        if (organization) account.organization = {
          name: organization.name,
          organizationType: organization.organization_type,
          verificationStatus: organization.verification_status,
          rnc: organization.rnc,
          address: organization.address,
          city: organization.city,
          representativeName: organization.representative_name,
          profileType: organization.profile_type,
        };
      } else if (account.role === 'volunteer') {
        const { data: volunteer, error } = await this.supabase.from('volunteer_profiles')
          .select('transport_type, other_transport_type, availability_zone, status')
          .eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        if (volunteer) account.volunteer = {
          transportType: volunteer.transport_type,
          otherTransportType: volunteer.other_transport_type,
          availabilityZone: volunteer.availability_zone,
          status: volunteer.status,
        };
      }

      return account;
    })());
  }

  updateAccountProfile(fullName: string, phone: string): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesiÃƒÂ³n para editar tu perfil.');

      const { data, error } = await this.supabase.from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', user.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No se pudo actualizar el perfil. Revisa los permisos de la base de datos.');
    })());
  }

  loadFoodCategories(includeInactive = false): Observable<FoodCategory[]> {
    return from((async () => {
      let query = this.supabase.from('food_categories').select('id, name, active').order('name');
      if (!includeInactive) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FoodCategory[];
    })());
  }

  loadOrganizationCategories(includeInactive = false): Observable<OrganizationCategory[]> {
    return from((async () => {
      let query = this.supabase.from('organization_categories').select('id, organization_type, name, active').order('name');
      if (!includeInactive) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, organizationType: row.organization_type, name: row.name, active: row.active })) as OrganizationCategory[];
    })());
  }

  addFoodCategory(name: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('food_categories').insert({ name: name.trim(), active: true });
      if (error) throw error;
    })());
  }

  setFoodCategoryActive(id: string, active: boolean): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('food_categories').update({ active }).eq('id', id);
      if (error) throw error;
    })());
  }

  addOrganizationCategory(organizationType: 'donor' | 'beneficiary', name: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('organization_categories').insert({ organization_type: organizationType, name: name.trim(), active: true });
      if (error) throw error;
    })());
  }

  setOrganizationCategoryActive(id: string, active: boolean): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('organization_categories').update({ active }).eq('id', id);
      if (error) throw error;
    })());
  }
  loadPendingOrganizations(): Observable<OrganizationApplication[]> {
    return from((async () => {
      const { data, error } = await this.supabase.from('organizations')
        .select('id, email, organization_type, name, rnc, phone, address, city, representative_name, profile_type, verification_status, created_at')
        .eq('verification_status', 'pending').order('created_at');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id, email: row.email, role: row.organization_type, organizationName: row.name,
        rnc: row.rnc ?? '', phone: row.phone, address: row.address, city: row.city,
        representativeName: row.representative_name, profileType: row.profile_type,
        status: row.verification_status, submittedAt: row.created_at,
      })) as OrganizationApplication[];
    })());
  }

  loadAdminOrganizations(): Observable<OrganizationApplication[]> {
    return from((async () => {
      const { data, error } = await this.supabase.from('organizations')
        .select('id, email, organization_type, name, rnc, phone, address, city, representative_name, profile_type, verification_status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id, email: row.email, role: row.organization_type, organizationName: row.name,
        rnc: row.rnc ?? '', phone: row.phone, address: row.address, city: row.city,
        representativeName: row.representative_name, profileType: row.profile_type,
        status: row.verification_status, submittedAt: row.created_at,
      })) as OrganizationApplication[];
    })());
  }

  loadAdminUsers(): Observable<AdminUser[]> {
    return from((async () => {
      const { data: profiles, error: profilesError } = await this.supabase.from('profiles')
        .select('id, email, full_name, role, status, created_at').order('created_at', { ascending: false });
      if (profilesError) throw profilesError;
      const rows = profiles ?? [];
      if (!rows.length) return [];
      const { data: organizations, error: organizationsError } = await this.supabase.from('organizations')
        .select('owner_id, name').in('owner_id', rows.map((profile) => profile.id));
      if (organizationsError) throw organizationsError;
      const organizationNames = new Map((organizations ?? []).map((organization) => [organization.owner_id, organization.name]));
      return rows.map((profile) => ({
        id: profile.id, email: profile.email, fullName: profile.full_name,
        role: profile.role as AppRole, status: profile.status, createdAt: profile.created_at,
        organizationName: organizationNames.get(profile.id) ?? null,
      }));
    })());
  }

  loadAdminDashboard(): Observable<AdminDashboardSnapshot> {
    return from((async () => {
      const [organizationsResult, volunteersResult, deliveriesResult, donationsResult] = await Promise.all([
        this.supabase.from('organizations').select('id', { count: 'exact', head: true })
          .eq('status', 'active').eq('verification_status', 'approved'),
        this.supabase.from('volunteer_profiles').select('user_id, profiles!inner(status)', { count: 'exact', head: true })
          .in('status', ['available', 'assigned']).eq('profiles.status', 'active'),
        this.supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
        this.supabase.from('donations').select('id, food_name, quantity, unit, status, created_at, donor_organization_id')
          .order('created_at', { ascending: false }),
      ]);
      const error = organizationsResult.error ?? volunteersResult.error ?? deliveriesResult.error ?? donationsResult.error;
      if (error) throw error;

      const donations = donationsResult.data ?? [];
      const toKilograms = (quantity: number, unit: string): number => {
        const normalized = unit.trim().toLocaleLowerCase();
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(normalized)) return quantity;
        if (['g', 'gramo', 'gramos'].includes(normalized)) return quantity / 1000;
        if (['lb', 'lbs', 'libra', 'libras'].includes(normalized)) return quantity * 0.45359237;
        return 0;
      };
      const eligibleDonations = donations.filter((donation) => donation.status !== 'cancelled');
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
      const monthlyTotals = months.map((month) => eligibleDonations.reduce((total, donation) => {
        const createdAt = new Date(donation.created_at);
        return createdAt.getFullYear() === month.getFullYear() && createdAt.getMonth() === month.getMonth()
          ? total + toKilograms(Number(donation.quantity), donation.unit)
          : total;
      }, 0));
      const maximum = Math.max(...monthlyTotals, 0);
      const monthlyDonations = months.map((month, index) => ({
        label: new Intl.DateTimeFormat('es-DO', { month: 'short' }).format(month).replace('.', '').replace(/^./, (letter) => letter.toUpperCase()),
        kilograms: monthlyTotals[index],
        height: maximum === 0 ? 0 : Math.max(5, Math.round((monthlyTotals[index] / maximum) * 100)),
      }));

      const recent = eligibleDonations.slice(0, 3);
      const donorIds = [...new Set(recent.map((donation) => donation.donor_organization_id))];
      const { data: donorOrganizations, error: donorError } = donorIds.length
        ? await this.supabase.from('organizations').select('id, name').in('id', donorIds)
        : { data: [], error: null };
      if (donorError) throw donorError;
      const donorNames = new Map((donorOrganizations ?? []).map((organization) => [organization.id, organization.name]));

      return {
        donatedKilograms: eligibleDonations.reduce((total, donation) => total + toKilograms(Number(donation.quantity), donation.unit), 0),
        activeOrganizations: organizationsResult.count ?? 0,
        activeVolunteers: volunteersResult.count ?? 0,
        completedDeliveries: deliveriesResult.count ?? 0,
        availableDonations: eligibleDonations.filter((donation) => donation.status === 'available').length,
        reservedDonations: eligibleDonations.filter((donation) => donation.status === 'reserved').length,
        inDeliveryDonations: eligibleDonations.filter((donation) => ['pickup_in_progress', 'picked_up'].includes(donation.status)).length,
        monthlyDonations,
        recentDonations: recent.map((donation) => ({
          id: donation.id, foodName: donation.food_name, quantity: Number(donation.quantity), unit: donation.unit,
          donorName: donorNames.get(donation.donor_organization_id) ?? 'Organizacion donante', createdAt: donation.created_at,
        })),
      };
    })());
  }

  loadAdminReport(startAt: string, endAt: string): Observable<AdminReportSnapshot> {
    return from((async () => {
      const donations: AdminReportDonation[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await this.supabase.from('donations')
          .select('id, food_name, category_id, quantity, unit, status, created_at, donor_organization_id, food_categories(name)')
          .gte('created_at', startAt).lt('created_at', endAt)
          .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as { id: string; food_name: string; quantity: number; unit: string; status: string; created_at: string; donor_organization_id: string; food_categories: { name: string } | { name: string }[] | null }[];
        donations.push(...page.map((row) => ({
          id: row.id, foodName: row.food_name,
          categoryName: (Array.isArray(row.food_categories) ? row.food_categories[0]?.name : row.food_categories?.name) ?? 'Sin categoria',
          quantity: Number(row.quantity), unit: row.unit, status: row.status, createdAt: row.created_at,
          donorOrganizationId: row.donor_organization_id,
        })));
        if (page.length < pageSize) break;
      }

      const { count: completedDeliveries, error: deliveriesError } = await this.supabase.from('deliveries')
        .select('id', { count: 'exact', head: true }).eq('status', 'delivered')
        .gte('delivered_at', startAt).lt('delivered_at', endAt);
      if (deliveriesError) throw deliveriesError;

      const eligible = donations.filter((donation) => donation.status !== 'cancelled');
      const toKilograms = (quantity: number, unit: string): number => {
        const normalized = unit.trim().toLocaleLowerCase();
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(normalized)) return quantity;
        if (['g', 'gramo', 'gramos'].includes(normalized)) return quantity / 1000;
        if (['lb', 'lbs', 'libra', 'libras'].includes(normalized)) return quantity * 0.45359237;
        return 0;
      };
      const groups = new Map<string, { donationCount: number; estimatedKilograms: number }>();
      for (const donation of eligible) {
        const group = groups.get(donation.categoryName) ?? { donationCount: 0, estimatedKilograms: 0 };
        group.donationCount += 1;
        group.estimatedKilograms += toKilograms(donation.quantity, donation.unit);
        groups.set(donation.categoryName, group);
      }
      const categoryBreakdown = [...groups.entries()].map(([name, values]) => ({ name, ...values, percent: 0 }))
        .sort((a, b) => b.donationCount - a.donationCount || a.name.localeCompare(b.name, 'es'));
      const maxCount = Math.max(...categoryBreakdown.map((category) => category.donationCount), 0);
      categoryBreakdown.forEach((category) => category.percent = maxCount ? Math.round(category.donationCount / maxCount * 100) : 0);

      return {
        donationCount: eligible.length,
        estimatedKilograms: eligible.reduce((sum, donation) => sum + toKilograms(donation.quantity, donation.unit), 0),
        participatingDonors: new Set(eligible.map((donation) => donation.donorOrganizationId)).size,
        completedDeliveries: completedDeliveries ?? 0,
        categoryBreakdown,
        donations: eligible,
      };
    })());
  }

  reviewOrganization(id: string, status: Extract<OrganizationApplicationStatus, 'approved' | 'rejected'>): Observable<void> {
    return from((async () => {
      const { data, error } = await this.supabase.from('organizations').update({
        verification_status: status, status: status === 'approved' ? 'active' : 'inactive',
      }).eq('id', id).eq('verification_status', 'pending').select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('La institucion ya fue revisada o no tienes permisos para cambiar su estado.');
    })());
  }

  setPendingOrganizations(applications: readonly OrganizationApplication[]): void { this.applicationsState.set(applications); }
  removePendingOrganization(id: string): void { this.applicationsState.update((items) => items.filter((item) => item.id !== id)); }


  loadVolunteerDashboard(): Observable<VolunteerDashboardSnapshot> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Sesion requerida.');
      const { data: volunteerProfile, error: vpError } = await this.supabase
        .from('volunteer_profiles').select('status').eq('user_id', user.id).maybeSingle();
      if (vpError) throw vpError;
      const { data: rawDeliveries, error: deliveriesError } = await this.supabase
        .from('deliveries')
        .select(`id, status, pickup_at, delivered_at, notes, donation_requests!inner(donations!inner(food_name, quantity, unit, address, city, pickup_starts_at, organizations!donor_organization_id(name)), organizations!beneficiary_organization_id(name, address, city))`)
        .eq('volunteer_id', user.id)
        .not('status', 'in', '(delivered,cancelled)')
        .order('pickup_at', { ascending: true, nullsFirst: false });
      if (deliveriesError) throw deliveriesError;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [monthResult, totalResult] = await Promise.all([
        this.supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('volunteer_id', user.id).eq('status', 'delivered').gte('delivered_at', startOfMonth),
        this.supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('volunteer_id', user.id).eq('status', 'delivered'),
      ]);
      const mapDelivery = (d: Record<string, unknown>): VolunteerDeliveryItem => {
        const req = d['donation_requests'] as Record<string, unknown> | null;
        const don = req ? req['donations'] as Record<string, unknown> | null : null;
        const donorOrg = don ? (don['organizations'] as Record<string, string> | null) : null;
        const benOrg = req ? (req['organizations'] as Record<string, string> | null) : null;
        return {
          id: d['id'] as string, status: d['status'] as VolunteerDeliveryStatus,
          pickupAt: (d['pickup_at'] as string | null) ?? null, deliveredAt: (d['delivered_at'] as string | null) ?? null,
          notes: (d['notes'] as string | null) ?? null, foodName: (don?.['food_name'] as string) ?? 'Alimento',
          quantity: Number(don?.['quantity'] ?? 0), unit: (don?.['unit'] as string) ?? '',
          pickupAddress: (don?.['address'] as string) ?? '', pickupCity: (don?.['city'] as string) ?? '',
          pickupStartsAt: (don?.['pickup_starts_at'] as string | null) ?? null,
          donorName: donorOrg?.['name'] ?? 'Organizacion donante', beneficiaryName: benOrg?.['name'] ?? 'Organizacion beneficiaria',
          beneficiaryAddress: benOrg?.['address'] ?? '', beneficiaryCity: benOrg?.['city'] ?? '',
        };
      };
      return {
        volunteerStatus: volunteerProfile?.status ?? 'available',
        activeDeliveries: (rawDeliveries ?? []).map(d => mapDelivery(d as Record<string, unknown>)),
        completedThisMonth: monthResult.count ?? 0, totalCompleted: totalResult.count ?? 0,
      };
    })());
  }

  updateVolunteerStatus(newStatus: 'available' | 'inactive'): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Sesion requerida.');
      const { error } = await this.supabase.from('volunteer_profiles').update({ status: newStatus }).eq('user_id', user.id);
      if (error) throw error;
    })());
  }
  updatePassword(newPassword: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    })());
  }

  saveProfilePhoto(avatarDataUrl: string): Observable<string> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Sesión requerida.');

      try {
        localStorage.setItem('foodshare_avatar_' + user.id, avatarDataUrl);
      } catch {}

      try {
        await this.supabase.auth.updateUser({ data: { avatar_url: avatarDataUrl } });
      } catch (err) {
        console.warn('No se pudo guardar avatar en metadata', err);
      }

      try {
        await this.supabase.from('profiles').update({ avatar_url: avatarDataUrl }).eq('id', user.id);
      } catch {}

      this.currentAvatarState.set(avatarDataUrl);
      return avatarDataUrl;
    })());
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    this.sessionState.set(null);
    this.currentAvatarState.set(null);
    if (error) throw error;
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    if (data.session) await this.loadSession(data.session.user.id, data.session.user.email ?? '');
  }

  private async loadSession(userId: string, email: string): Promise<void> {
    try {
      const savedAvatar = localStorage.getItem('foodshare_avatar_' + userId);
      if (savedAvatar) this.currentAvatarState.set(savedAvatar);
    } catch {}
    const role = await this.getActiveRole(userId);
    if (!role) { this.sessionState.set(null); return; }
    this.sessionState.set({ email, role });
  }

  private async getActiveRole(userId: string): Promise<AppRole | null> {
    const { data, error } = await this.supabase.from('profiles').select('role, status').eq('id', userId).maybeSingle();
    if (error || !data || data.status !== 'active' || !roles.includes(data.role as AppRole)) return null;
    if (data.role === 'donor' || data.role === 'beneficiary') {
      const { data: organization } = await this.supabase.from('organizations').select('verification_status').eq('owner_id', userId).maybeSingle();
      if (organization?.verification_status !== 'approved') return null;
    }
    return data.role as AppRole;
  }
}


