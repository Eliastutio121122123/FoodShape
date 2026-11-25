import { Injectable, computed, signal } from '@angular/core';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AppRole = 'admin' | 'donor' | 'beneficiary' | 'volunteer' | 'person';
export interface AuthSession { email: string; role: AppRole; }
export interface LoginResponse { email: string; role: AppRole; accessToken: string; expiresAt: string; }
export interface FoodShareChatMessage {
  id: string; conversationId: string; senderId: string; content: string; createdAt: string;
  replyToMessageId: string | null; deletedAt: string | null;
}
export interface FoodShareChatConversation {
  id: string; personId: string; organizationId: string; personName: string; organizationName: string;
  organizationType: 'donor' | 'beneficiary'; otherParticipantName: string; updatedAt: string;
  lastMessage: string | null; lastMessageAt: string | null;
}
export interface FoodShareChatThread { conversation: FoodShareChatConversation; messages: FoodShareChatMessage[]; currentUserId: string; }
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
export interface DonorDashboardDonation {
  id: string;
  foodName: string;
  quantity: number;
  unit: string;
  status: string;
  isVisible: boolean;
  expiresAt: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  createdAt: string;
  requestCount: number;
}
export interface DonorDashboardActivity {
  id: string;
  kind: 'request' | 'accepted' | 'delivered';
  organizationName: string;
  foodName: string;
  createdAt: string;
}
export interface DonorDashboardSnapshot {
  organizationName: string;
  activeDonations: number;
  availableDonations: number;
  newRequests: number;
  completedDeliveries: number;
  donatedKilograms: number;
  estimatedPortions: number;
  supportedOrganizations: number;
  recentDonations: DonorDashboardDonation[];
  recentActivity: DonorDashboardActivity[];
}
export interface DonorManagementDonation {
  id: string;
  categoryId: string | null;
  foodName: string;
  categoryName: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  deliveredQuantity: number;
  unit: string;
  status: string;
  isVisible: boolean;
  expiresAt: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  createdAt: string;
  requestCount: number;
  beneficiaryName: string | null;
  deliveredAt: string | null;
  imageUrl: string | null;
  description: string | null;
  pickupAddress: string;
  pickupCity: string;
}
export interface DonorDonationsSnapshot {
  organizationName: string;
  donations: DonorManagementDonation[];
}
export interface DonorRequestInboxItem {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  requestedAt: string;
  quantityRequested: number | null;
  message: string | null;
  donationId: string;
  donationName: string;
  donationQuantity: number;
  donationUnit: string;
  donationStatus: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  expiresAt: string;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  deliveryId: string | null;
  receivedConfirmedAt: string | null;
  receivedConfirmedBy: string | null;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryType: string | null;
  beneficiaryCity: string;
  beneficiaryRepresentative: string;
  beneficiaryProfileAvailable: boolean;
  beneficiaryAddress: string;
  beneficiaryPhone: string;
  beneficiaryVerified: boolean;
  pickupAddress: string;
  pickupCity: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
}
export interface DonorHistoryEntry {
  id: string;
  donationName: string;
  quantity: number;
  unit: string;
  beneficiaryName: string;
  deliveredAt: string;
  status: string;
}
export interface DonorHistorySnapshot {
  donatedKilogramsThisMonth: number;
  completedDeliveriesThisMonth: number;
  supportedOrganizationsThisMonth: number;
  deliveries: DonorHistoryEntry[];
}
export interface BeneficiaryDonation {
  id: string;
  createdAt: string;
  foodName: string;
  categoryName: string;
  imageUrl: string | null;
  quantity: number;
  unit: string;
  expiresAt: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  city: string;
  description: string | null;
}
export interface BeneficiaryRequest {
  id: string;
  donationId: string;
  donationName: string;
  categoryName: string;
  requestedQuantity: number | null;
  donationQuantity: number;
  unit: string;
  status: string;
  requestedAt: string;
  updatedAt: string;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  deliveryId: string | null;
  receivedConfirmedAt: string | null;
  receivedConfirmedBy: string | null;
  pickupAddress: string | null;
  pickupCity: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
}
export interface BeneficiaryDashboardSnapshot {
  organizationName: string;
  fullName: string;
  verificationStatus: string;
  organizationStatus: string;
  organizationAddress: string;
  organizationCity: string;
  donations: BeneficiaryDonation[];
  requests: BeneficiaryRequest[];
  receivedByUnitThisMonth: { unit: string; quantity: number }[];
  notifications: { id: string; title: string; message: string; createdAt: string; read: boolean }[];
}
export interface CommunityOrganization {
  id: string; name: string; organizationType: 'donor' | 'beneficiary'; profileType: string | null;
  address: string; city: string; phone: string; email: string;
}
export interface PersonalAidRequest {
  id: string; personId: string; organizationId: string; donationId: string | null; organizationName: string; organizationType: 'donor' | 'beneficiary';
  address: string; city: string; phone: string; email: string; requestType: 'membership' | 'ration';
  status: 'pending' | 'approved' | 'rejected'; preferredDate: string | null; scheduledAt: string | null;
  message: string | null; createdAt: string; foodName: string | null; quantity: number | null; unit: string | null;
  pickupStartsAt: string | null; pickupEndsAt: string | null;
}
export interface PersonalFoodOffer {
  id: string; organizationId: string; organizationName: string; foodName: string; quantity: number; unit: string;
  categoryName: string; expiresAt: string; pickupStartsAt: string; pickupEndsAt: string;
  address: string; city: string; phone: string; email: string;
}
export interface DonorDonationCreateOptions {
  organizationId: string;
  organizationName: string;
  pickupAddress: string;
  pickupCity: string;
  categories: FoodCategory[];
}
export interface CreateDonorDonationInput {
  foodName: string;
  categoryId: string;
  quantity: number;
  unit: string;
  description: string;
  pickupStartsAt: string;
  pickupEndsAt: string;
  image: File | null;
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
  role: Extract<AppRole, 'donor' | 'beneficiary' | 'volunteer' | 'person'>; email: string; password: string; fullName: string;
  organizationName?: string; rnc?: string; phone: string; address?: string; city?: string; profileType?: string;
  transportType?: string; otherTransportType?: string; availabilityZone?: string; agreementAccepted?: boolean;
}

const roles: AppRole[] = ['admin', 'donor', 'beneficiary', 'volunteer', 'person'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  private readonly sessionState = signal<AuthSession | null>(null);
  private restoringSession: Promise<void> | null = null;
  private readonly applicationsState = signal<readonly OrganizationApplication[]>([]);
  private readonly currentAvatarState = signal<string | null>(null);
  readonly currentAvatarUrl = this.currentAvatarState.asReadonly();
  readonly session = this.sessionState.asReadonly();
  readonly organizationApplications = this.applicationsState.asReadonly();
  readonly pendingOrganizations = computed(() => this.applicationsState().filter((application) => application.status === 'pending'));
  readonly currentRole = computed(() => this.sessionState()?.role ?? null);
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  constructor() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      // The initial state is restored below from getSession(); don't let an
      // early INITIAL_SESSION event overwrite that restoration.
      if (event === 'INITIAL_SESSION') return;
      if (!session?.user) {
        this.sessionState.set(null);
        this.currentAvatarState.set(null);
        return;
      }
      queueMicrotask(() => void this.loadSession(session.user.id, session.user.email ?? ''));
    });
    void this.restoreSession().catch((error) => console.warn('No se pudo restaurar la sesión de FoodShare.', error));
  }

  ready(): Promise<void> { return this.restoreSession(); }

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
          const { data: prof } = await this.supabase.from('profiles').select('role, status').eq('id', data.user.id).maybeSingle();
          let msg = 'El perfil todavía no está aprobado o no está activo.';
          if (prof?.role === 'donor' || prof?.role === 'beneficiary') {
            msg = 'Tu organización está registrada pero pendiente de verificación por el equipo de administración.';
          } else if (prof?.status === 'inactive') {
            msg = 'Esta cuenta se encuentra inactiva. Comunícate con el equipo de soporte.';
          }
          await this.supabase.auth.signOut();
          throw new Error(msg);
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
      return { email: data.user?.email ?? payload.email, role: payload.role, status: payload.role === 'volunteer' || payload.role === 'person' ? 'active' : 'pending' };
    })());
  }

  loadAccountProfile(): Observable<AccountProfile> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesiÃƒÂ³n para consultar tu perfil.');

      const { data: profile, error: profileError } = await this.supabase.from('profiles')
        .select('id, email, full_name, phone, role, status, avatar_path')
        .eq('id', user.id).single();
      if (profileError) throw profileError;

      const account: AccountProfile = {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        role: profile.role as AppRole,
        status: profile.status,
      };

      if (account.role === 'donor' || account.role === 'beneficiary') {
        const { data: organization, error } = await this.supabase.from('organizations')
          .select('name, organization_type, verification_status, rnc, address, city, representative_name, profile_type')
          .eq('owner_id', user.id).eq('organization_type', account.role).maybeSingle();
        if (error) throw error;
        if (organization && organization.organization_type === account.role) account.organization = {
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

      // Account/profile queries can finish after a user switches accounts in
      // another tab. Never return or cache data for the previous auth user.
      const { data: { user: currentUser }, error: currentUserError } = await this.supabase.auth.getUser();
      if (currentUserError || !currentUser || currentUser.id !== user.id) {
        throw new Error('La sesión cambió mientras se cargaba el perfil. Vuelve a intentarlo.');
      }

      const avatarPath = profile.avatar_path as string | null;
      const avatarUrl = avatarPath
        ? this.supabase.storage.from('foodshare-avatars').getPublicUrl(avatarPath).data.publicUrl
        : null;
      try {
        const cacheKey = 'foodshare_avatar_' + user.id;
        if (avatarUrl) localStorage.setItem(cacheKey, avatarUrl);
        else localStorage.removeItem(cacheKey);
      } catch { /* The database path remains the source of truth if local storage is unavailable. */ }
      this.currentAvatarState.set(avatarUrl);
      account.avatarUrl = avatarUrl;

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

  loadCommunityDirectory(city = ''): Observable<CommunityOrganization[]> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar organizaciones.');
      const { data, error } = await this.supabase.from('organizations')
        .select('id, name, organization_type, profile_type, address, city, phone, email')
        .eq('verification_status', 'approved').eq('status', 'active').order('name');
      if (error) throw error;
      const needle = city.trim().toLocaleLowerCase();
      return (data ?? []).filter((item) => !needle || String(item.city ?? '').toLocaleLowerCase().includes(needle))
        .map((item) => ({ id: item.id, name: item.name, organizationType: item.organization_type, profileType: item.profile_type,
          address: item.address, city: item.city, phone: item.phone, email: item.email }));
    })());
  }

  loadPersonalAidRequests(): Observable<PersonalAidRequest[]> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar tus solicitudes.');
      const { data, error } = await this.supabase.from('individual_aid_requests')
        .select('id, person_id, organization_id, donation_id, request_type, status, preferred_date, scheduled_at, message, created_at, organizations!inner(name, organization_type, address, city, phone, email), donations(food_name, quantity, unit, address, city, pickup_starts_at, pickup_ends_at)')
        .eq('person_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((item) => {
        const org = item.organizations as unknown as Record<string, string>;
        const donation = item.donations as unknown as Record<string, string | number> | null;
        return { id: item.id, personId: item.person_id, organizationId: item.organization_id, donationId: item.donation_id, organizationName: org['name'],
          organizationType: org['organization_type'] as 'donor' | 'beneficiary', address: donation?.['address'] as string ?? org['address'], city: donation?.['city'] as string ?? org['city'],
          phone: org['phone'], email: org['email'], requestType: item.request_type as 'membership' | 'ration',
          status: item.status as 'pending' | 'approved' | 'rejected', preferredDate: item.preferred_date,
          scheduledAt: item.scheduled_at, message: item.message, createdAt: item.created_at,
          foodName: donation?.['food_name'] as string | null ?? null, quantity: donation ? Number(donation['quantity']) : null,
          unit: donation?.['unit'] as string | null ?? null, pickupStartsAt: donation?.['pickup_starts_at'] as string | null ?? null,
          pickupEndsAt: donation?.['pickup_ends_at'] as string | null ?? null };
      });
    })());
  }

  loadPersonalFoodOffers(city = ''): Observable<PersonalFoodOffer[]> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para ver alimentos disponibles.');
      const { data, error } = await this.supabase.from('donations')
        .select('id, food_name, quantity, available_quantity, unit, expires_at, pickup_starts_at, pickup_ends_at, address, city, organizations!inner(id, name, phone, email), food_categories(name)')
        .eq('status', 'available').gt('available_quantity', 0).gt('expires_at', new Date().toISOString()).order('expires_at');
      if (error) throw error;
      const needle = city.trim().toLocaleLowerCase();
      return (data ?? []).filter((item) => !needle || String(item.city ?? '').toLocaleLowerCase().includes(needle)).map((item) => {
        const org = item.organizations as unknown as Record<string, string>;
        const category = item.food_categories as unknown as Record<string, string> | null;
        return { id: item.id, organizationId: org['id'], organizationName: org['name'], foodName: item.food_name,
          quantity: Number(item.available_quantity), unit: item.unit, categoryName: category?.['name'] ?? 'Alimentos',
          expiresAt: item.expires_at, pickupStartsAt: item.pickup_starts_at, pickupEndsAt: item.pickup_ends_at,
          address: item.address, city: item.city, phone: org['phone'], email: org['email'] };
      });
    })());
  }

  createPersonalAidRequest(organizationId: string, requestType: 'membership' | 'ration', preferredDate: string | null, message: string, donationId: string | null = null): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para solicitar apoyo.');
      const { error } = await this.supabase.from('individual_aid_requests').insert({
        person_id: user.id, organization_id: organizationId, donation_id: donationId, request_type: requestType,
        preferred_date: preferredDate || null, message: message.trim() || null,
      });
      if (error) throw error;
    })());
  }

  async openChatWithOrganization(organizationId: string): Promise<string> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para abrir un chat.');
    if (this.currentRole() !== 'person') throw new Error('Solo las personas pueden iniciar un chat desde el directorio.');
    return this.getOrCreateChat(user.id, organizationId);
  }

  async openChatWithPerson(personId: string): Promise<string> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para abrir un chat.');
    const role = this.currentRole();
    if (role !== 'donor' && role !== 'beneficiary') throw new Error('Esta cuenta no puede abrir chats con personas.');
    const { data: organization, error } = await this.supabase.from('organizations').select('id')
      .eq('owner_id', user.id).eq('organization_type', role).maybeSingle();
    if (error) throw error;
    if (!organization) throw new Error('No encontramos una organización activa asociada a esta cuenta.');
    return this.getOrCreateChat(personId, organization.id);
  }

  private async getOrCreateChat(personId: string, organizationId: string): Promise<string> {
    const { data, error } = await this.supabase.from('chat_conversations').upsert(
      { person_id: personId, organization_id: organizationId },
      { onConflict: 'person_id,organization_id', ignoreDuplicates: true },
    ).select('id').maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
    const existing = await this.supabase.from('chat_conversations').select('id')
      .eq('person_id', personId).eq('organization_id', organizationId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data?.id) throw new Error('No se pudo abrir la conversación. Comprueba tu acceso e inténtalo de nuevo.');
    return existing.data.id;
  }

  async loadChatConversations(): Promise<FoodShareChatConversation[]> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar tus mensajes.');
    const role = this.currentRole();
    if (role !== 'person' && role !== 'donor' && role !== 'beneficiary') {
      throw new Error('El chat está disponible para personas y organizaciones.');
    }
    const { data, error } = await this.supabase.from('chat_conversations')
      .select('id, person_id, organization_id, person_display_name, organization_name, organization_type, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];
    const { data: messages, error: messagesError } = await this.supabase.from('chat_messages')
      .select('id, conversation_id, sender_id, content, created_at, reply_to_message_id, deleted_at')
      .in('conversation_id', rows.map((row) => row.id)).order('created_at', { ascending: false });
    if (messagesError) throw messagesError;
    const latestByConversation = new Map<string, { content: string; created_at: string }>();
    for (const message of messages ?? []) {
      if (!latestByConversation.has(message.conversation_id)) {
        latestByConversation.set(message.conversation_id, { content: message.content, created_at: message.created_at });
      }
    }
    return rows.map((row) => {
      const latest = latestByConversation.get(row.id);
      return {
        id: row.id, personId: row.person_id, organizationId: row.organization_id,
        personName: row.person_display_name, organizationName: row.organization_name,
        organizationType: row.organization_type as 'donor' | 'beneficiary',
        otherParticipantName: role === 'person' ? row.organization_name : row.person_display_name,
        updatedAt: row.updated_at, lastMessage: latest?.content ?? null, lastMessageAt: latest?.created_at ?? null,
      };
    });
  }

  async loadChatThread(conversationId: string): Promise<FoodShareChatThread> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para abrir esta conversación.');
    const { data: row, error } = await this.supabase.from('chat_conversations')
      .select('id, person_id, organization_id, person_display_name, organization_name, organization_type, updated_at')
      .eq('id', conversationId).maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('La conversación no existe o tu cuenta no tiene acceso.');
    const { data: messageRows, error: messagesError } = await this.supabase.from('chat_messages')
      .select('id, conversation_id, sender_id, content, created_at, reply_to_message_id, deleted_at')
      .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(500);
    if (messagesError) throw messagesError;
    const role = this.currentRole();
    const messages = (messageRows ?? []).reverse().map((message) => ({
      id: message.id, conversationId: message.conversation_id, senderId: message.sender_id,
      content: message.content, createdAt: message.created_at,
      replyToMessageId: message.reply_to_message_id, deletedAt: message.deleted_at,
    }));
    const summary: FoodShareChatConversation = {
      id: row.id, personId: row.person_id, organizationId: row.organization_id,
      personName: row.person_display_name, organizationName: row.organization_name,
      organizationType: row.organization_type as 'donor' | 'beneficiary',
      otherParticipantName: role === 'person' ? row.organization_name : row.person_display_name,
      updatedAt: row.updated_at, lastMessage: messages.at(-1)?.content ?? null,
      lastMessageAt: messages.at(-1)?.createdAt ?? null,
    };
    return {
      conversation: summary,
      currentUserId: user.id,
      messages,
    };
  }

  async sendChatMessage(conversationId: string, content: string, replyToMessageId: string | null = null): Promise<FoodShareChatMessage> {
    const normalized = content.trim();
    if (!normalized) throw new Error('Escribe un mensaje antes de enviarlo.');
    if (normalized.length > 2000) throw new Error('El mensaje no puede superar los 2000 caracteres.');
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para enviar mensajes.');
    const { data, error } = await this.supabase.from('chat_messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, content: normalized, reply_to_message_id: replyToMessageId })
      .select('id, conversation_id, sender_id, content, created_at, reply_to_message_id, deleted_at').single();
    if (error) throw error;
    return {
      id: data.id, conversationId: data.conversation_id, senderId: data.sender_id,
      content: data.content, createdAt: data.created_at,
      replyToMessageId: data.reply_to_message_id, deletedAt: data.deleted_at,
    };
  }

  async deleteOwnChatMessage(messageId: string): Promise<void> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error('Inicia sesión para eliminar un mensaje.');
    const { error } = await this.supabase.from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId).eq('sender_id', user.id);
    if (error) throw error;
  }

  subscribeToChat(conversationId: string, onMessage: () => void): RealtimeChannel {
    return this.supabase.channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, onMessage)
      .subscribe();
  }

  removeChatSubscription(channel: RealtimeChannel): void { void this.supabase.removeChannel(channel); }

  loadOrganizationAidRequests(): Observable<PersonalAidRequest[]> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para revisar las solicitudes.');
      const { data: organization, error: orgError } = await this.supabase.from('organizations')
        .select('id').eq('owner_id', user.id).maybeSingle();
      if (orgError || !organization) throw orgError ?? new Error('No encontramos la organización de esta cuenta.');
      const { data, error } = await this.supabase.from('individual_aid_requests')
        .select('id, person_id, organization_id, donation_id, request_type, status, preferred_date, scheduled_at, message, created_at, profiles!inner(full_name, phone, email), donations(food_name, quantity, unit, address, city, pickup_starts_at, pickup_ends_at)')
        .eq('organization_id', organization.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((item) => {
        const person = item.profiles as unknown as Record<string, string>;
        const donation = item.donations as unknown as Record<string, string | number> | null;
        return { id: item.id, personId: item.person_id, organizationId: item.organization_id, donationId: item.donation_id, organizationName: person['full_name'],
          organizationType: 'beneficiary' as const, address: '', city: '', phone: person['phone'], email: person['email'],
          requestType: item.request_type as 'membership' | 'ration', status: item.status as 'pending' | 'approved' | 'rejected',
          preferredDate: item.preferred_date, scheduledAt: item.scheduled_at, message: item.message, createdAt: item.created_at,
          foodName: donation?.['food_name'] as string | null ?? null, quantity: donation ? Number(donation['quantity']) : null,
          unit: donation?.['unit'] as string | null ?? null, pickupStartsAt: donation?.['pickup_starts_at'] as string | null ?? null,
          pickupEndsAt: donation?.['pickup_ends_at'] as string | null ?? null };
      });
    })());
  }

  reviewOrganizationAidRequest(id: string, status: 'approved' | 'rejected', scheduledAt: string | null, responseMessage: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('individual_aid_requests').update({
        status, scheduled_at: scheduledAt, response_message: responseMessage.trim() || null,
      }).eq('id', id);
      if (error) throw error;
    })());
  }

  loadBeneficiaryDashboard(): Observable<BeneficiaryDashboardSnapshot> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar el espacio de tu organización.');

      const [profileResult, organizationResult] = await Promise.all([
        this.supabase.from('profiles').select('id, full_name, role').eq('id', user.id).maybeSingle(),
        this.supabase.from('organizations').select('id, name, verification_status, status, city, address')
          .eq('owner_id', user.id).eq('organization_type', 'beneficiary').maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (organizationResult.error) throw organizationResult.error;
      if (profileResult.data?.role !== 'beneficiary') throw new Error('Esta sección es exclusiva para cuentas beneficiarias.');
      const organization = organizationResult.data;
      if (!organization) throw new Error('No encontramos una organización beneficiaria asociada a esta cuenta.');

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [donationsResult, requestResult, notificationResult] = await Promise.all([
        this.supabase.from('donations')
          .select('id, food_name, quantity, available_quantity, unit, expires_at, pickup_starts_at, pickup_ends_at, city, notes, created_at, image_path, food_categories(name)')
          .eq('status', 'available').eq('is_visible', true).gt('available_quantity', 0).gt('expires_at', now.toISOString())
          .order('created_at', { ascending: false }),
        this.supabase.from('donation_requests')
          .select('id, donation_id, status, quantity_requested, requested_at, updated_at')
          .eq('beneficiary_organization_id', organization.id).order('requested_at', { ascending: false }),
        this.supabase.from('notifications').select('id, title, message, created_at, read_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      if (donationsResult.error) throw donationsResult.error;
      if (requestResult.error) throw requestResult.error;
      if (notificationResult.error) throw notificationResult.error;

      type CategoryRelation = { name: string } | { name: string }[] | null;
      const categoryName = (relation: CategoryRelation): string => Array.isArray(relation) ? relation[0]?.name ?? 'Otros' : relation?.name ?? 'Otros';
      const donations: BeneficiaryDonation[] = (donationsResult.data ?? []).map((row) => ({
        id: row.id, createdAt: row.created_at, foodName: row.food_name, categoryName: categoryName(row.food_categories as CategoryRelation),
        imageUrl: row.image_path ? this.supabase.storage.from('foodshare-donations').getPublicUrl(row.image_path).data.publicUrl : null,
        quantity: Number(row.available_quantity), unit: row.unit, expiresAt: row.expires_at,
        pickupStartsAt: row.pickup_starts_at, pickupEndsAt: row.pickup_ends_at, city: row.city,
        description: row.notes,
      }));

      const requests = requestResult.data ?? [];
      const requestIds = requests.map((request) => request.id);
      const requestDonationIds = [...new Set(requests.map((request) => request.donation_id))];
      const [deliveryResult, requestDonationsResult] = await Promise.all([
        requestIds.length
          ? this.supabase.from('deliveries').select('id, request_id, status, delivered_at, received_confirmed_at, received_confirmed_by, created_at').in('request_id', requestIds)
          : Promise.resolve({ data: [], error: null }),
        requestDonationIds.length
          ? this.supabase.from('donations').select('id, food_name, quantity, unit, city, pickup_starts_at, pickup_ends_at, food_categories(name)').in('id', requestDonationIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (deliveryResult.error) throw deliveryResult.error;
      if (requestDonationsResult.error) throw requestDonationsResult.error;
      const deliveriesByRequest = new Map((deliveryResult.data ?? []).map((delivery) => [delivery.request_id, delivery]));
      const requestDonationsById = new Map((requestDonationsResult.data ?? []).map((donation) => [donation.id, donation]));
      const acceptedDonationIds = [...new Set(requests.filter((request) => request.status === 'accepted').map((request) => request.donation_id))];
      const acceptedDetailsResult = acceptedDonationIds.length
        ? await this.supabase.from('donations').select('id, address, latitude, longitude').in('id', acceptedDonationIds)
        : { data: [], error: null };
      if (acceptedDetailsResult.error) throw acceptedDetailsResult.error;
      const pickupAddressByDonation = new Map((acceptedDetailsResult.data ?? []).map((donation) => [donation.id, donation.address]));
      const pickupCoordinatesByDonation = new Map((acceptedDetailsResult.data ?? []).map((donation) => [donation.id, {
        latitude: donation.latitude === null ? null : Number(donation.latitude),
        longitude: donation.longitude === null ? null : Number(donation.longitude),
      }]));
      const requestItems: BeneficiaryRequest[] = requests.map((request) => {
        const donation = requestDonationsById.get(request.donation_id);
        const categoryRelation = donation?.food_categories as CategoryRelation | undefined;
        const delivery = deliveriesByRequest.get(request.id);
        const pickupCoordinates = request.status === 'accepted' ? pickupCoordinatesByDonation.get(request.donation_id) : undefined;
        return {
          id: request.id, donationId: request.donation_id, donationName: donation?.food_name ?? 'Donación ya no disponible',
          categoryName: categoryName(categoryRelation ?? null), requestedQuantity: request.quantity_requested === null ? null : Number(request.quantity_requested),
          donationQuantity: Number(donation?.quantity ?? request.quantity_requested ?? 0), unit: donation?.unit ?? 'unidades', status: request.status,
          requestedAt: request.requested_at, updatedAt: request.updated_at,
          deliveryStatus: delivery?.status ?? null, deliveredAt: delivery?.delivered_at ?? null,
          deliveryId: delivery?.id ?? null, receivedConfirmedAt: delivery?.received_confirmed_at ?? null,
          receivedConfirmedBy: delivery?.received_confirmed_by ?? null,
          pickupAddress: request.status === 'accepted' ? pickupAddressByDonation.get(request.donation_id) ?? null : null,
          pickupCity: donation?.city ?? '', pickupStartsAt: donation?.pickup_starts_at ?? '', pickupEndsAt: donation?.pickup_ends_at ?? '',
          pickupLatitude: pickupCoordinates?.latitude ?? null,
          pickupLongitude: pickupCoordinates?.longitude ?? null,
        };
      });

      const receivedByUnit = new Map<string, number>();
      for (const request of requestItems) {
        if (!request.receivedConfirmedAt || Date.parse(request.receivedConfirmedAt) < Date.parse(monthStart)) continue;
        const quantity = request.requestedQuantity ?? request.donationQuantity;
        receivedByUnit.set(request.unit, (receivedByUnit.get(request.unit) ?? 0) + quantity);
      }

      return {
        organizationName: organization.name,
        fullName: profileResult.data.full_name,
        verificationStatus: organization.verification_status,
        organizationStatus: organization.status,
        organizationAddress: organization.address,
        organizationCity: organization.city,
        donations,
        requests: requestItems,
        receivedByUnitThisMonth: [...receivedByUnit].map(([unit, quantity]) => ({ unit, quantity })),
        notifications: (notificationResult.data ?? []).map((notification) => ({
          id: notification.id, title: notification.title, message: notification.message,
          createdAt: notification.created_at, read: Boolean(notification.read_at),
        })),
      };
    })());
  }

  createBeneficiaryDonationRequest(donationId: string, quantity: number, message: string): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para solicitar una donación.');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Indica una cantidad válida.');
      if (message.trim().length > 500) throw new Error('El mensaje no puede superar los 500 caracteres.');

      const [{ data: organization, error: organizationError }, { data: donation, error: donationError }] = await Promise.all([
        this.supabase.from('organizations').select('id, status, verification_status')
          .eq('owner_id', user.id).eq('organization_type', 'beneficiary').maybeSingle(),
        this.supabase.from('donations').select('id, available_quantity, status, is_visible, expires_at')
          .eq('id', donationId).maybeSingle(),
      ]);
      if (organizationError) throw organizationError;
      if (donationError) throw donationError;
      if (!organization) throw new Error('No encontramos una organización beneficiaria asociada a esta cuenta.');
      if (organization.status !== 'active' || organization.verification_status !== 'approved') {
        throw new Error('La organización debe estar activa y verificada para solicitar donaciones.');
      }
      if (!donation || donation.status !== 'available' || !donation.is_visible || Date.parse(donation.expires_at) <= Date.now()) {
        throw new Error('Esta donación ya no está disponible. Actualiza la lista e inténtalo con otra.');
      }
      if (quantity > Number(donation.available_quantity)) throw new Error('La cantidad solicitada supera la cantidad disponible.');

      const { error } = await this.supabase.from('donation_requests').insert({
        donation_id: donation.id, beneficiary_organization_id: organization.id,
        quantity_requested: quantity, message: message.trim() || null,
      });
      if (error?.code === '23505') throw new Error('Tu organización ya envió una solicitud para esta donación.');
      if (error) throw error;
    })());
  }

  confirmBeneficiaryDelivery(deliveryId: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.rpc('confirm_beneficiary_delivery', { p_delivery_id: deliveryId });
      if (error) throw new Error(error.message || 'No se pudo confirmar la recepción. Inténtalo de nuevo.');
    })());
  }

  cancelBeneficiaryDonationRequest(requestId: string): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.rpc('cancel_beneficiary_donation_request', { p_request_id: requestId });
      if (error) throw new Error(error.message || 'No se pudo cancelar la solicitud.');
    })());
  }


  loadDonorDashboard(): Observable<DonorDashboardSnapshot> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar el panel de tu organización.');

      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id, name').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos una organización donante asociada a esta cuenta.');

      const { data: donationRows, error: donationsError } = await this.supabase.from('donations')
        .select('id, food_name, quantity, available_quantity, reserved_quantity, delivered_quantity, unit, status, is_visible, expires_at, pickup_starts_at, pickup_ends_at, created_at')
        .eq('donor_organization_id', organization.id).order('created_at', { ascending: false });
      if (donationsError) throw donationsError;
      const donations = donationRows ?? [];
      const donationIds = donations.map((donation) => donation.id);

      const { data: requestRows, error: requestsError } = donationIds.length
        ? await this.supabase.from('donation_requests')
          .select('id, donation_id, beneficiary_organization_id, status, requested_at, updated_at')
          .in('donation_id', donationIds).order('requested_at', { ascending: false })
        : { data: [], error: null };
      if (requestsError) throw requestsError;
      const requests = requestRows ?? [];
      const requestIds = requests.map((request) => request.id);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data: deliveryRows, error: deliveriesError } = requestIds.length
        ? await this.supabase.from('deliveries').select('id, request_id, delivered_at, received_confirmed_at')
          .in('request_id', requestIds).eq('status', 'delivered')
          .not('received_confirmed_at', 'is', null)
          .gte('delivered_at', monthStart).lt('delivered_at', nextMonthStart)
        : { data: [], error: null };
      if (deliveriesError) throw deliveriesError;
      const deliveries = deliveryRows ?? [];

      const beneficiaryIds = [...new Set(requests.map((request) => request.beneficiary_organization_id))];
      const { data: beneficiaryRows, error: beneficiariesError } = beneficiaryIds.length
        ? await this.supabase.from('organizations').select('id, name').in('id', beneficiaryIds)
        : { data: [], error: null };
      if (beneficiariesError) throw beneficiariesError;
      const beneficiaryNames = new Map((beneficiaryRows ?? []).map((row) => [row.id, row.name]));
      const donationsById = new Map(donations.map((donation) => [donation.id, donation]));
      const requestsById = new Map(requests.map((request) => [request.id, request]));
      const requestsByDonation = new Map<string, typeof requests>();
      for (const request of requests) {
        const grouped = requestsByDonation.get(request.donation_id) ?? [];
        grouped.push(request);
        requestsByDonation.set(request.donation_id, grouped);
      }
      const toKilograms = (quantity: number, unit: string): number => {
        const normalized = unit.trim().toLocaleLowerCase();
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(normalized)) return quantity;
        if (['g', 'gramo', 'gramos'].includes(normalized)) return quantity / 1000;
        if (['lb', 'lbs', 'libra', 'libras'].includes(normalized)) return quantity * 0.45359237;
        return 0;
      };

      const recentDonations = donations.slice(0, 3).map((donation) => ({
        id: donation.id, foodName: donation.food_name, quantity: Number(donation.available_quantity), unit: donation.unit,
        status: donation.status, isVisible: donation.is_visible, expiresAt: donation.expires_at, pickupStartsAt: donation.pickup_starts_at,
        pickupEndsAt: donation.pickup_ends_at, createdAt: donation.created_at,
        requestCount: (requestsByDonation.get(donation.id) ?? []).length,
      }));
      const recentActivity: DonorDashboardActivity[] = [];
      for (const request of requests) {
        if (request.status !== 'pending' && request.status !== 'accepted') continue;
        const donation = donationsById.get(request.donation_id);
        if (!donation) continue;
        recentActivity.push({
          id: request.id, kind: request.status === 'pending' ? 'request' : 'accepted',
          organizationName: beneficiaryNames.get(request.beneficiary_organization_id) ?? 'Organización beneficiaria',
          foodName: donation.food_name,
          createdAt: request.status === 'pending' ? request.requested_at : request.updated_at,
        });
      }
      for (const delivery of deliveries) {
        const request = requestsById.get(delivery.request_id);
        const donation = request ? donationsById.get(request.donation_id) : undefined;
        if (!request || !donation || !delivery.delivered_at) continue;
        recentActivity.push({
          id: delivery.id, kind: 'delivered',
          organizationName: beneficiaryNames.get(request.beneficiary_organization_id) ?? 'Organización beneficiaria',
          foodName: donation.food_name, createdAt: delivery.delivered_at,
        });
      }
      recentActivity.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const kilograms = deliveries.reduce((total, delivery) => {
        const request = requestsById.get(delivery.request_id);
        const donation = request ? donationsById.get(request.donation_id) : undefined;
        return total + (donation ? toKilograms(Number(donation.quantity), donation.unit) : 0);
      }, 0);
      const completedRequestIds = new Set(deliveries.map((delivery) => delivery.request_id));
      const supportedOrganizations = new Set(requests
        .filter((request) => completedRequestIds.has(request.id))
        .map((request) => request.beneficiary_organization_id)).size;
      const activeStatuses = ['available', 'reserved', 'pickup_in_progress', 'picked_up'];
      const isCurrentlyActive = (donation: typeof donations[number]) =>
        activeStatuses.includes(donation.status) && Date.parse(donation.expires_at) > now.getTime();

      return {
        organizationName: organization.name,
        activeDonations: donations.filter(isCurrentlyActive).length,
        availableDonations: donations.filter((donation) => donation.status === 'available' && donation.is_visible && Date.parse(donation.expires_at) > now.getTime()).length,
        newRequests: requests.filter((request) => request.status === 'pending').length,
        completedDeliveries: deliveries.length,
        donatedKilograms: kilograms,
        estimatedPortions: Math.round(kilograms * 2),
        supportedOrganizations,
        recentDonations,
        recentActivity: recentActivity.slice(0, 3),
      };
    })());
  }

  loadDonorDonationCreateOptions(): Observable<DonorDonationCreateOptions> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para publicar una donación.');
      const [organizationResult, categoriesResult] = await Promise.all([
        this.supabase.from('organizations').select('id, name, address, city, status, verification_status')
          .eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle(),
        this.supabase.from('food_categories').select('id, name, active').eq('active', true).order('name'),
      ]);
      if (organizationResult.error) throw organizationResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      const organization = organizationResult.data;
      if (!organization) throw new Error('No encontramos una organización donante asociada a esta cuenta.');
      if (organization.status !== 'active' || organization.verification_status !== 'approved') {
        throw new Error('La organización debe estar activa y verificada para publicar donaciones.');
      }
      if (!organization.address.trim() || !organization.city.trim()) {
        throw new Error('Completa la dirección y ciudad de tu organización antes de publicar una donación.');
      }
      return {
        organizationId: organization.id,
        organizationName: organization.name,
        pickupAddress: organization.address,
        pickupCity: organization.city,
        categories: (categoriesResult.data ?? []) as FoodCategory[],
      };
    })());
  }

  createDonorDonation(input: CreateDonorDonationInput): Observable<string> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para publicar una donación.');
      const name = input.foodName.trim();
      const allowedUnits = ['kg', 'g', 'lb', 'unit', 'portion', 'box', 'package'];
      const quantity = Number(input.quantity);
      const pickupStartsAt = Date.parse(input.pickupStartsAt);
      const pickupEndsAt = Date.parse(input.pickupEndsAt);
      if (!name || name.length > 120) throw new Error('Escribe un nombre de alimento de hasta 120 caracteres.');
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999999999.99) throw new Error('La cantidad debe ser mayor que cero.');
      if (!allowedUnits.includes(input.unit)) throw new Error('Selecciona una unidad válida.');
      if (!Number.isFinite(pickupStartsAt) || pickupStartsAt <= Date.now()) throw new Error('La recogida debe comenzar en una fecha futura.');
      if (!Number.isFinite(pickupEndsAt) || pickupEndsAt <= pickupStartsAt) throw new Error('La fecha límite debe ser posterior al inicio de recogida.');

      const [organizationResult, categoryResult] = await Promise.all([
        this.supabase.from('organizations').select('id, address, city, status, verification_status')
          .eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle(),
        this.supabase.from('food_categories').select('id').eq('id', input.categoryId).eq('active', true).maybeSingle(),
      ]);
      if (organizationResult.error) throw organizationResult.error;
      if (categoryResult.error) throw categoryResult.error;
      const organization = organizationResult.data;
      if (!organization || organization.status !== 'active' || organization.verification_status !== 'approved') {
        throw new Error('La organización debe estar activa y verificada para publicar donaciones.');
      }
      if (!categoryResult.data) throw new Error('Selecciona una categoría de alimento activa.');

      let imagePath: string | null = null;
      if (input.image) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.image.type)) {
          throw new Error('La imagen debe ser JPG, PNG o WEBP.');
        }
        if (input.image.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
        const extension = input.image.type === 'image/png' ? 'png' : input.image.type === 'image/webp' ? 'webp' : 'jpg';
        imagePath = `${organization.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await this.supabase.storage.from('foodshare-donations').upload(imagePath, input.image, {
          cacheControl: '3600', upsert: false, contentType: input.image.type,
        });
        if (uploadError) {
          throw new Error(`No se pudo subir la imagen a Supabase Storage: ${uploadError.message}. Verifica que la migración de imágenes esté aplicada en este proyecto.`);
        }
      }

      const { data: donation, error: insertError } = await this.supabase.from('donations').insert({
        donor_organization_id: organization.id,
        food_name: name,
        category_id: input.categoryId,
        quantity,
        available_quantity: quantity,
        reserved_quantity: 0,
        delivered_quantity: 0,
        unit: input.unit,
        notes: input.description.trim() || null,
        address: organization.address,
        city: organization.city,
        pickup_starts_at: new Date(pickupStartsAt).toISOString(),
        pickup_ends_at: new Date(pickupEndsAt).toISOString(),
        expires_at: new Date(pickupEndsAt).toISOString(),
        status: 'available',
        image_path: imagePath,
      }).select('id').single();
      if (insertError) {
        if (imagePath) {
          const { error: removeError } = await this.supabase.storage.from('foodshare-donations').remove([imagePath]);
          if (removeError) console.warn('No se pudo limpiar la imagen de una donación que no se guardó.', removeError);
        }
        throw new Error(`La imagen se subió, pero no se pudo guardar la donación: ${insertError.message}`);
      }
      return donation.id as string;
    })());
  }

  updateDonorDonation(id: string, input: CreateDonorDonationInput, removeCurrentImage: boolean): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para editar una donación.');
      const name = input.foodName.trim();
      const quantity = Number(input.quantity);
      const pickupStartsAt = Date.parse(input.pickupStartsAt);
      const pickupEndsAt = Date.parse(input.pickupEndsAt);
      if (!name || name.length > 120) throw new Error('Escribe un nombre de alimento de hasta 120 caracteres.');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.');
      if (!['kg', 'g', 'lb', 'unit', 'portion', 'box', 'package'].includes(input.unit)) throw new Error('Selecciona una unidad válida.');
      if (!Number.isFinite(pickupStartsAt) || pickupStartsAt <= Date.now()) throw new Error('La recogida debe comenzar en una fecha futura.');
      if (!Number.isFinite(pickupEndsAt) || pickupEndsAt <= pickupStartsAt) throw new Error('La fecha límite debe ser posterior al inicio de recogida.');

      const [organizationResult, categoryResult, currentResult, requestsResult] = await Promise.all([
        this.supabase.from('organizations').select('id, address, city, status, verification_status')
          .eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle(),
        this.supabase.from('food_categories').select('id').eq('id', input.categoryId).eq('active', true).maybeSingle(),
        this.supabase.from('donations').select('id, image_path, status, is_visible').eq('id', id).maybeSingle(),
        this.supabase.from('donation_requests').select('id', { count: 'exact', head: true }).eq('donation_id', id),
      ]);
      if (organizationResult.error) throw organizationResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (currentResult.error) throw currentResult.error;
      if (requestsResult.error) throw requestsResult.error;
      const organization = organizationResult.data;
      const current = currentResult.data;
      if (!organization || organization.status !== 'active' || organization.verification_status !== 'approved') {
        throw new Error('La organización debe estar activa y verificada para editar donaciones.');
      }
      if (requestsResult.count && requestsResult.count > 0) {
        throw new Error('No se puede editar una donación que ya recibió solicitudes.');
      }
      if (!current || current.status !== 'available') {
        throw new Error('Solo puedes editar donaciones disponibles.');
      }
      if (!categoryResult.data) throw new Error('Selecciona una categoría de alimento activa.');

      let imagePath = removeCurrentImage ? null : current.image_path as string | null;
      let newImagePath: string | null = null;
      if (input.image) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.image.type)) throw new Error('La imagen debe ser JPG, PNG o WEBP.');
        if (input.image.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
        const extension = input.image.type === 'image/png' ? 'png' : input.image.type === 'image/webp' ? 'webp' : 'jpg';
        newImagePath = `${organization.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await this.supabase.storage.from('foodshare-donations').upload(newImagePath, input.image, {
          cacheControl: '3600', upsert: false, contentType: input.image.type,
        });
        if (uploadError) throw new Error(`No se pudo subir la imagen: ${uploadError.message}`);
        imagePath = newImagePath;
      }

      const { data: updated, error: updateError } = await this.supabase.from('donations').update({
        food_name: name, category_id: input.categoryId, quantity, available_quantity: quantity,
        reserved_quantity: 0, delivered_quantity: 0, unit: input.unit,
        notes: input.description.trim() || null, address: organization.address, city: organization.city,
        pickup_starts_at: new Date(pickupStartsAt).toISOString(),
        pickup_ends_at: new Date(pickupEndsAt).toISOString(), expires_at: new Date(pickupEndsAt).toISOString(),
        image_path: imagePath,
      }).eq('id', id).eq('donor_organization_id', organization.id).select('id').maybeSingle();
      if (updateError || !updated) {
        if (newImagePath) await this.supabase.storage.from('foodshare-donations').remove([newImagePath]);
        throw updateError ?? new Error('No se pudo actualizar la donación.');
      }
      if (current.image_path && current.image_path !== imagePath) {
        const { error: removeError } = await this.supabase.storage.from('foodshare-donations').remove([current.image_path]);
        if (removeError) console.warn('No se pudo eliminar la imagen anterior de la donación.', removeError);
      }
    })());
  }

  setDonorDonationVisibility(id: string, hidden: boolean): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para cambiar la visibilidad.');
      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos tu organización donante.');
      const { data, error } = await this.supabase.from('donations')
        .update({ is_visible: !hidden })
        .eq('id', id).eq('donor_organization_id', organization.id)
        .eq('status', 'available').eq('is_visible', hidden).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Solo puedes ocultar o mostrar donaciones disponibles.');
    })());
  }

  deleteDonorDonation(id: string): Observable<void> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para eliminar una donación.');
      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos tu organización donante.');
      const { data: donation, error: donationError } = await this.supabase.from('donations')
        .select('id, image_path').eq('id', id).eq('donor_organization_id', organization.id).maybeSingle();
      if (donationError) throw donationError;
      if (!donation) throw new Error('No se encontró la donación que quieres eliminar.');
      const { data, error } = await this.supabase.from('donations').delete()
        .eq('id', id).eq('donor_organization_id', organization.id).select('id').maybeSingle();
      if (error?.code === '23503') throw new Error('No se puede eliminar porque ya tiene solicitudes. Puedes ocultarla para que no vuelva a aparecer.');
      if (error) throw error;
      if (!data) throw new Error('No se pudo eliminar la donación. Revisa si ya tiene solicitudes asociadas.');
      if (donation.image_path) {
        const { error: imageError } = await this.supabase.storage.from('foodshare-donations').remove([donation.image_path]);
        if (imageError) console.warn('No se pudo eliminar la imagen de la donación.', imageError);
      }
    })());
  }

  restockDonorDonation(id: string, quantity: number, pickupStartsAt: string, pickupEndsAt: string): Observable<string> {
    return from((async () => {
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999999999.99) {
        throw new Error('La cantidad de reposición debe ser mayor que cero.');
      }
      const startsAt = Date.parse(pickupStartsAt);
      const endsAt = Date.parse(pickupEndsAt);
      if (!Number.isFinite(startsAt) || startsAt <= Date.now() || !Number.isFinite(endsAt) || endsAt <= startsAt) {
        throw new Error('Indica un horario futuro válido para recoger el alimento.');
      }
      const { data, error } = await this.supabase.rpc('restock_donor_donation', {
        p_source_donation_id: id,
        p_quantity: quantity,
        p_pickup_starts_at: new Date(startsAt).toISOString(),
        p_pickup_ends_at: new Date(endsAt).toISOString(),
      });
      if (error) throw new Error(error.message || 'No se pudo volver a publicar el alimento.');
      if (!data) throw new Error('Supabase no devolvió la nueva publicación.');
      return data as string;
    })());
  }

  loadDonorDonations(): Observable<DonorDonationsSnapshot> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar las donaciones de tu organización.');
      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id, name').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos una organización donante asociada a esta cuenta.');

      const { data: donationRows, error: donationsError } = await this.supabase.from('donations')
        .select('id, food_name, category_id, quantity, available_quantity, reserved_quantity, delivered_quantity, unit, status, is_visible, expires_at, pickup_starts_at, pickup_ends_at, created_at, image_path, notes, address, city, food_categories(name)')
        .eq('donor_organization_id', organization.id).order('created_at', { ascending: false });
      if (donationsError) throw donationsError;
      const donations = (donationRows ?? []) as unknown as {
        id: string; food_name: string; category_id: string | null; quantity: number; available_quantity: number; reserved_quantity: number; delivered_quantity: number; unit: string; status: string; is_visible: boolean;
        expires_at: string; pickup_starts_at: string; pickup_ends_at: string; created_at: string;
        image_path: string | null;
        notes: string | null; address: string; city: string;
        food_categories: { name: string } | { name: string }[] | null;
      }[];
      const donationIds = donations.map((donation) => donation.id);
      const { data: requestRows, error: requestsError } = donationIds.length
        ? await this.supabase.from('donation_requests')
          .select('id, donation_id, beneficiary_organization_id, status')
          .in('donation_id', donationIds)
        : { data: [], error: null };
      if (requestsError) throw requestsError;
      const requests = requestRows ?? [];
      const requestIds = requests.map((request) => request.id);
      const beneficiaryIds = [...new Set(requests.map((request) => request.beneficiary_organization_id))];
      const [{ data: beneficiaryRows, error: beneficiariesError }, { data: deliveryRows, error: deliveriesError }] = await Promise.all([
        beneficiaryIds.length
          ? this.supabase.from('organizations').select('id, name').in('id', beneficiaryIds)
          : Promise.resolve({ data: [], error: null }),
        requestIds.length
          ? this.supabase.from('deliveries').select('request_id, delivered_at').in('request_id', requestIds).eq('status', 'delivered')
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (beneficiariesError) throw beneficiariesError;
      if (deliveriesError) throw deliveriesError;

      const beneficiaryNames = new Map((beneficiaryRows ?? []).map((row) => [row.id, row.name]));
      const requestsByDonation = new Map<string, typeof requests>();
      for (const request of requests) {
        const related = requestsByDonation.get(request.donation_id) ?? [];
        related.push(request);
        requestsByDonation.set(request.donation_id, related);
      }
      const deliveriesByRequest = new Map((deliveryRows ?? []).map((delivery) => [delivery.request_id, delivery.delivered_at]));

      return {
        organizationName: organization.name,
        donations: donations.map((donation) => {
          const relatedRequests = requestsByDonation.get(donation.id) ?? [];
          const acceptedRequest = relatedRequests.find((request) => request.status === 'accepted');
          const beneficiaryRequest = acceptedRequest ?? relatedRequests[0];
          const deliveredAt = relatedRequests.map((request) => deliveriesByRequest.get(request.id) ?? null)
            .filter((value): value is string => value !== null)
            .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
          const category = Array.isArray(donation.food_categories) ? donation.food_categories[0] : donation.food_categories;
          return {
            id: donation.id, categoryId: donation.category_id, foodName: donation.food_name, categoryName: category?.name ?? 'Otros',
            quantity: Number(donation.quantity), availableQuantity: Number(donation.available_quantity),
            reservedQuantity: Number(donation.reserved_quantity), deliveredQuantity: Number(donation.delivered_quantity),
            unit: donation.unit, status: donation.status, isVisible: donation.is_visible,
            expiresAt: donation.expires_at, pickupStartsAt: donation.pickup_starts_at,
            pickupEndsAt: donation.pickup_ends_at, createdAt: donation.created_at,
            imageUrl: donation.image_path ? this.supabase.storage.from('foodshare-donations').getPublicUrl(donation.image_path).data.publicUrl : null,
            description: donation.notes,
            pickupAddress: donation.address,
            pickupCity: donation.city,
            requestCount: relatedRequests.length,
            beneficiaryName: beneficiaryRequest ? beneficiaryNames.get(beneficiaryRequest.beneficiary_organization_id) ?? null : null,
            deliveredAt,
          };
        }),
      };
    })());
  }

  loadDonorRequests(): Observable<DonorRequestInboxItem[]> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar las solicitudes de tu organización.');
      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos una organización donante asociada a esta cuenta.');

      const { data: donationRows, error: donationsError } = await this.supabase.from('donations')
        .select('id, food_name, quantity, unit, status, expires_at, pickup_starts_at, pickup_ends_at, address, city, latitude, longitude')
        .eq('donor_organization_id', organization.id);
      if (donationsError) throw donationsError;
      const donations = (donationRows ?? []) as {
        id: string; food_name: string; quantity: number; unit: string; status: string;
        expires_at: string; pickup_starts_at: string; pickup_ends_at: string; address: string; city: string;
        latitude: number | null; longitude: number | null;
      }[];
      const donationIds = donations.map((donation) => donation.id);
      if (!donationIds.length) return [];

      const { data: requestRows, error: requestsError } = await this.supabase.from('donation_requests')
        .select('id, donation_id, beneficiary_organization_id, status, quantity_requested, message, requested_at')
        .in('donation_id', donationIds).order('requested_at', { ascending: false });
      if (requestsError) throw requestsError;
      const requests = (requestRows ?? []) as {
        id: string; donation_id: string; beneficiary_organization_id: string; status: string;
        quantity_requested: number | null; message: string | null; requested_at: string;
      }[];
      if (!requests.length) return [];

      const beneficiaryIds = [...new Set(requests.map((request) => request.beneficiary_organization_id))];
      const requestIds = requests.map((request) => request.id);
      const [beneficiariesResult, deliveriesResult] = await Promise.all([
        this.supabase.from('organizations').select('id, name, profile_type, city, phone, representative_name, verification_status').in('id', beneficiaryIds),
        this.supabase.from('deliveries').select('id, request_id, status, delivered_at, received_confirmed_at, received_confirmed_by').in('request_id', requestIds),
      ]);
      if (beneficiariesResult.error) throw beneficiariesResult.error;
      if (deliveriesResult.error) throw deliveriesResult.error;

      const acceptedBeneficiaryIds = [...new Set(requests.filter((request) => request.status === 'accepted').map((request) => request.beneficiary_organization_id))];
      const acceptedAddressesResult = acceptedBeneficiaryIds.length
        ? await this.supabase.from('organizations').select('id, address').in('id', acceptedBeneficiaryIds)
        : { data: [], error: null };
      if (acceptedAddressesResult.error) throw acceptedAddressesResult.error;

      const beneficiaryById = new Map((beneficiariesResult.data ?? []).map((beneficiary) => [beneficiary.id, beneficiary]));
      const donationById = new Map(donations.map((donation) => [donation.id, donation]));
      const deliveryByRequestId = new Map((deliveriesResult.data ?? []).map((delivery) => [delivery.request_id, delivery]));
      const acceptedAddressByBeneficiaryId = new Map((acceptedAddressesResult.data ?? []).map((beneficiary) => [beneficiary.id, beneficiary.address]));
      return requests.flatMap((request) => {
        const donation = donationById.get(request.donation_id);
        if (!donation) return [];
        const beneficiary = beneficiaryById.get(request.beneficiary_organization_id);
        const delivery = deliveryByRequestId.get(request.id);
        return [{
          id: request.id, status: request.status as DonorRequestInboxItem['status'], requestedAt: request.requested_at,
          quantityRequested: request.quantity_requested === null ? null : Number(request.quantity_requested),
          message: request.message, donationId: donation.id, donationName: donation.food_name,
          donationQuantity: Number(donation.quantity), donationUnit: donation.unit, donationStatus: donation.status,
          pickupStartsAt: donation.pickup_starts_at, pickupEndsAt: donation.pickup_ends_at, expiresAt: donation.expires_at,
          deliveryStatus: delivery?.status ?? null, deliveredAt: delivery?.delivered_at ?? null,
          deliveryId: delivery?.id ?? null, receivedConfirmedAt: delivery?.received_confirmed_at ?? null,
          receivedConfirmedBy: delivery?.received_confirmed_by ?? null,
          beneficiaryId: request.beneficiary_organization_id,
          beneficiaryName: beneficiary?.name ?? 'Organización beneficiaria',
          beneficiaryType: beneficiary?.profile_type ?? null, beneficiaryCity: beneficiary?.city ?? '',
          beneficiaryRepresentative: beneficiary?.representative_name ?? '', beneficiaryProfileAvailable: Boolean(beneficiary),
          beneficiaryPhone: beneficiary?.phone ?? '', beneficiaryVerified: beneficiary?.verification_status === 'approved',
          beneficiaryAddress: request.status === 'accepted' ? acceptedAddressByBeneficiaryId.get(request.beneficiary_organization_id) ?? '' : '',
          pickupAddress: donation.address, pickupCity: donation.city,
          pickupLatitude: donation.latitude === null ? null : Number(donation.latitude),
          pickupLongitude: donation.longitude === null ? null : Number(donation.longitude),
        }];
      });
    })());
  }

  reviewDonorRequest(requestId: string, decision: 'accepted' | 'rejected'): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.rpc('review_donation_request', {
        p_request_id: requestId,
        p_decision: decision,
      });
      if (error) throw new Error(error.message || 'No se pudo actualizar la solicitud.');
    })());
  }

  renewDonorDonationAvailability(donationId: string, pickupStartsAt: string, pickupEndsAt: string, foodSafeConfirmed: boolean): Observable<void> {
    return from((async () => {
      if (!foodSafeConfirmed) throw new Error('Confirma que el alimento sigue apto para consumo antes de renovar la oferta.');
      const start = Date.parse(pickupStartsAt);
      const end = Date.parse(pickupEndsAt);
      if (!Number.isFinite(start) || start <= Date.now()) throw new Error('El nuevo inicio de recogida debe estar en el futuro.');
      if (!Number.isFinite(end) || end <= start) throw new Error('El fin de recogida debe ser posterior al inicio.');
      const { error } = await this.supabase.rpc('renew_donor_donation_availability', {
        p_donation_id: donationId,
        p_pickup_starts_at: new Date(start).toISOString(),
        p_pickup_ends_at: new Date(end).toISOString(),
        p_food_safe_confirmed: foodSafeConfirmed,
      });
      if (error) throw new Error(error.message || 'No se pudo actualizar la vigencia de la donación.');
    })());
  }

  loadDonorHistory(): Observable<DonorHistorySnapshot> {
    return from((async () => {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Inicia sesión para consultar el historial de tu organización.');
      const { data: organization, error: organizationError } = await this.supabase.from('organizations')
        .select('id').eq('owner_id', user.id).eq('organization_type', 'donor').maybeSingle();
      if (organizationError) throw organizationError;
      if (!organization) throw new Error('No encontramos una organización donante asociada a esta cuenta.');

      const { data: donationRows, error: donationsError } = await this.supabase.from('donations')
        .select('id, food_name, quantity, unit')
        .eq('donor_organization_id', organization.id);
      if (donationsError) throw donationsError;
      const donations = donationRows ?? [];
      const donationIds = donations.map((donation) => donation.id);
      if (!donationIds.length) {
        return { donatedKilogramsThisMonth: 0, completedDeliveriesThisMonth: 0, supportedOrganizationsThisMonth: 0, deliveries: [] };
      }

      const { data: requestRows, error: requestsError } = await this.supabase.from('donation_requests')
        .select('id, donation_id, beneficiary_organization_id, quantity_requested')
        .in('donation_id', donationIds);
      if (requestsError) throw requestsError;
      const requests = requestRows ?? [];
      const requestIds = requests.map((request) => request.id);
      if (!requestIds.length) {
        return { donatedKilogramsThisMonth: 0, completedDeliveriesThisMonth: 0, supportedOrganizationsThisMonth: 0, deliveries: [] };
      }

      const [deliveriesResult, beneficiariesResult] = await Promise.all([
        this.supabase.from('deliveries').select('id, request_id, status, delivered_at, pickup_at, created_at, received_confirmed_at')
          .in('request_id', requestIds).eq('status', 'delivered').not('received_confirmed_at', 'is', null),
        this.supabase.from('organizations').select('id, name')
          .in('id', [...new Set(requests.map((request) => request.beneficiary_organization_id))]),
      ]);
      if (deliveriesResult.error) throw deliveriesResult.error;
      if (beneficiariesResult.error) throw beneficiariesResult.error;

      const requestsById = new Map(requests.map((request) => [request.id, request]));
      const donationsById = new Map(donations.map((donation) => [donation.id, donation]));
      const beneficiariesById = new Map((beneficiariesResult.data ?? []).map((beneficiary) => [beneficiary.id, beneficiary.name]));
      const toKilograms = (quantity: number, unit: string): number => {
        const normalized = unit.trim().toLocaleLowerCase();
        if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(normalized)) return quantity;
        if (['g', 'gramo', 'gramos'].includes(normalized)) return quantity / 1000;
        if (['lb', 'lbs', 'libra', 'libras'].includes(normalized)) return quantity * 0.45359237;
        return 0;
      };
      const completed = (deliveriesResult.data ?? []).flatMap((delivery) => {
        const request = requestsById.get(delivery.request_id);
        const donation = request ? donationsById.get(request.donation_id) : undefined;
        if (!request || !donation) return [];
        return [{
          id: delivery.id,
          donationName: donation.food_name,
          quantity: request.quantity_requested === null ? Number(donation.quantity) : Number(request.quantity_requested),
          unit: donation.unit,
          beneficiaryId: request.beneficiary_organization_id,
          beneficiaryName: beneficiariesById.get(request.beneficiary_organization_id) ?? 'Organización beneficiaria',
          deliveredAt: delivery.delivered_at ?? delivery.pickup_at ?? delivery.created_at,
          status: delivery.status,
        }];
      }).sort((a, b) => Date.parse(b.deliveredAt) - Date.parse(a.deliveredAt));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      const completedThisMonth = completed.filter((delivery) => {
        const date = Date.parse(delivery.deliveredAt);
        return date >= monthStart && date < nextMonthStart;
      });
      const deliveredQuantitiesThisMonth = completedThisMonth.reduce(
        (total, delivery) => total + toKilograms(delivery.quantity, delivery.unit), 0,
      );

      return {
        donatedKilogramsThisMonth: deliveredQuantitiesThisMonth,
        completedDeliveriesThisMonth: completedThisMonth.length,
        supportedOrganizationsThisMonth: new Set(completedThisMonth.map((delivery) => delivery.beneficiaryId)).size,
        deliveries: completed.map(({ beneficiaryId: _beneficiaryId, ...delivery }) => delivery),
      };
    })());
  }

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

      const image = await fetch(avatarDataUrl).then((response) => response.blob());
      if (!image.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen válida.');
      if (image.size > 2 * 1024 * 1024) throw new Error('La foto debe pesar menos de 2 MB.');

      const { data: currentProfile, error: currentProfileError } = await this.supabase
        .from('profiles').select('avatar_path').eq('id', user.id).maybeSingle();
      if (currentProfileError) throw currentProfileError;

      const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const bucket = this.supabase.storage.from('foodshare-avatars');
      const { error: uploadError } = await bucket.upload(path, image, {
        cacheControl: '3600', upsert: false, contentType: image.type,
      });
      if (uploadError) throw uploadError;

      const { error: profileError } = await this.supabase.from('profiles')
        .update({ avatar_path: path }).eq('id', user.id);
      if (profileError) {
        await bucket.remove([path]);
        throw profileError;
      }

      const avatarUrl = bucket.getPublicUrl(path).data.publicUrl;
      this.currentAvatarState.set(avatarUrl);
      try { localStorage.setItem('foodshare_avatar_' + user.id, avatarUrl); } catch {}

      const oldPath = currentProfile?.avatar_path as string | null | undefined;
      if (oldPath && oldPath.startsWith(`${user.id}/`)) {
        const { error: removeError } = await bucket.remove([oldPath]);
        if (removeError) console.warn('No se pudo borrar la foto de perfil anterior.', removeError);
      }

      return avatarUrl;
    })());
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    this.sessionState.set(null);
    this.currentAvatarState.set(null);
    if (error) throw error;
  }

  private restoreSession(): Promise<void> {
    if (this.restoringSession) return this.restoringSession;

    const restoration = (async () => {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        this.sessionState.set(null);
        this.currentAvatarState.set(null);
        return;
      }
      await this.loadSession(data.session.user.id, data.session.user.email ?? '');
    })();

    this.restoringSession = restoration;
    const clearRestoration = (): void => {
      if (this.restoringSession === restoration) this.restoringSession = null;
    };
    void restoration.then(clearRestoration, clearRestoration);
    return restoration;
  }

  private async loadSession(userId: string, email: string): Promise<void> {
    const role = await this.getActiveRole(userId);
    const { data: { session }, error } = await this.supabase.auth.getSession();
    // Auth events can overlap when accounts are switched in another tab. A
    // late profile lookup must not restore an older user's role or avatar.
    if (error || !session || session.user.id !== userId) return;
    if (!role) {
      this.sessionState.set(null);
      this.currentAvatarState.set(null);
      return;
    }
    try {
      const cacheKey = 'foodshare_avatar_' + userId;
      const cachedAvatar = localStorage.getItem(cacheKey);
      if (cachedAvatar?.startsWith('https://') && cachedAvatar.length < 2048) {
        this.currentAvatarState.set(cachedAvatar);
      } else {
        localStorage.removeItem(cacheKey);
        this.currentAvatarState.set(null);
      }
    } catch {}
    this.sessionState.set({ email, role });
  }

  private async getActiveRole(userId: string): Promise<AppRole | null> {
    const { data: existingProfile, error: profileError } = await this.supabase
      .from('profiles').select('id, role, status').eq('id', userId).maybeSingle();
    if (profileError) throw new Error(`No se pudo consultar el perfil: ${profileError.message}`);
    let data = existingProfile;

    // Si no existe la fila en profiles, auto-crearla usando la metadata de auth
    if (!data) {
      const { data: userData, error: userError } = await this.supabase.auth.getUser();
      if (userError) throw new Error(`No se pudo consultar la cuenta: ${userError.message}`);
      const user = userData?.user;
      if (user && user.id === userId) {
        const meta = user.user_metadata || {};
        const rawRole = meta['role'] as AppRole;
        const assignedRole: AppRole = roles.includes(rawRole) ? rawRole : 'volunteer';
        const fullName = meta['full_name'] || meta['name'] || user.email?.split('@')[0] || 'Usuario';
        const phone = meta['phone'] || '';
        const initialStatus = (assignedRole === 'donor' || assignedRole === 'beneficiary') ? 'pending' : 'active';

        const { data: created, error: createError } = await this.supabase.from('profiles').upsert({
          id: userId,
          email: user.email?.toLowerCase(),
          full_name: fullName,
          phone,
          role: assignedRole,
          status: initialStatus,
        }).select('id, role, status').maybeSingle();
        if (createError) throw new Error(`No se pudo crear el perfil: ${createError.message}`);

        if (created) data = created;

        if (assignedRole === 'volunteer') {
          const { error: volunteerError } = await this.supabase.from('volunteer_profiles').upsert({
            user_id: userId,
            transport_type: meta['transport_type'] || null,
            other_transport_type: meta['other_transport_type'] || null,
            availability_zone: meta['availability_zone'] || '',
            status: 'available',
          });
          if (volunteerError) throw new Error(`No se pudo crear el perfil de voluntariado: ${volunteerError.message}`);
        }
      }
    }

    if (!data) return null;

    // Los voluntarios no requieren verificación institucional; si quedaron en 'pending', activarlos
    if (data.role === 'volunteer' && data.status === 'pending') {
      // The authenticated client is only granted profile name/phone updates. Treat
      // legacy pending volunteers as active here; the migration persists the fix.
      data.status = 'active';
    }

    if (data.status !== 'active') {
      return null;
    }

    if (data.role === 'donor' || data.role === 'beneficiary') {
      const { data: organization } = await this.supabase.from('organizations').select('verification_status')
        .eq('owner_id', userId).eq('organization_type', data.role).maybeSingle();
      if (organization && organization.verification_status !== 'approved') {
        return null;
      }
    }

    return roles.includes(data.role as AppRole) ? (data.role as AppRole) : null;
  }
}


