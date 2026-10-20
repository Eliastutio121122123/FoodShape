import { Injectable, computed, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AppRole = 'admin' | 'donor' | 'beneficiary' | 'volunteer';
export interface AuthSession { email: string; role: AppRole; }
export interface LoginResponse { email: string; role: AppRole; accessToken: string; expiresAt: string; }
export type OrganizationApplicationStatus = 'pending' | 'approved' | 'rejected';
export interface OrganizationApplication {
  id: string; email: string; role: Extract<AppRole, 'donor' | 'beneficiary'>;
  organizationName: string; rnc: string; phone: string; address: string;
  representativeName: string; profileType?: string; status: OrganizationApplicationStatus; submittedAt: string;
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
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw error ?? new Error('No se pudo iniciar sesión.');
      const role = await this.getActiveRole(data.user.id);
      if (!role) {
        await this.supabase.auth.signOut();
        throw new Error('El perfil todavía no está aprobado o no está activo.');
      }
      const result = { email: data.user.email ?? email, role, accessToken: data.session.access_token, expiresAt: new Date((data.session.expires_at ?? 0) * 1000).toISOString() };
      this.sessionState.set({ email: result.email, role });
      return result;
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

  loadPendingOrganizations(): Observable<OrganizationApplication[]> {
    return from((async () => {
      const { data, error } = await this.supabase.from('organizations')
        .select('id, email, organization_type, name, rnc, phone, address, representative_name, profile_type, verification_status, created_at')
        .eq('verification_status', 'pending').order('created_at');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id, email: row.email, role: row.organization_type, organizationName: row.name,
        rnc: row.rnc ?? '', phone: row.phone, address: row.address,
        representativeName: row.representative_name, profileType: row.profile_type,
        status: row.verification_status, submittedAt: row.created_at,
      })) as OrganizationApplication[];
    })());
  }

  reviewOrganization(id: string, status: Extract<OrganizationApplicationStatus, 'approved' | 'rejected'>): Observable<void> {
    return from((async () => {
      const { error } = await this.supabase.from('organizations').update({
        verification_status: status, status: status === 'approved' ? 'active' : 'inactive',
      }).eq('id', id).eq('verification_status', 'pending');
      if (error) throw error;
    })());
  }

  setPendingOrganizations(applications: readonly OrganizationApplication[]): void { this.applicationsState.set(applications); }
  removePendingOrganization(id: string): void { this.applicationsState.update((items) => items.filter((item) => item.id !== id)); }

  signOut(): void {
    this.sessionState.set(null);
    void this.supabase.auth.signOut();
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    if (data.session) await this.loadSession(data.session.user.id, data.session.user.email ?? '');
  }

  private async loadSession(userId: string, email: string): Promise<void> {
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
