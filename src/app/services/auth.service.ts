import { Injectable, computed, signal } from '@angular/core';

export type AppRole = 'admin' | 'donor' | 'beneficiary' | 'volunteer';
export interface AuthSession { email: string; role: AppRole; }
export type OrganizationApplicationStatus = 'pending' | 'approved' | 'rejected';
export interface OrganizationApplication {
  id: string;
  email: string;
  role: Extract<AppRole, 'donor' | 'beneficiary'>;
  organizationName: string;
  rnc: string;
  phone: string;
  address: string;
  representativeName: string;
  profileType?: string;
  status: OrganizationApplicationStatus;
  submittedAt: string;
}

const SESSION_KEY = 'foodshare.demo-session';
const APPLICATIONS_KEY = 'foodshare.demo-organization-applications';
const roles: AppRole[] = ['admin', 'donor', 'beneficiary', 'volunteer'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionState = signal<AuthSession | null>(this.readSession());
  private readonly applicationsState = signal<readonly OrganizationApplication[]>(this.readApplications());
  readonly session = this.sessionState.asReadonly();
  readonly organizationApplications = this.applicationsState.asReadonly();
  readonly pendingOrganizations = computed(() => this.applicationsState().filter((application) => application.status === 'pending'));
  readonly currentRole = computed(() => this.sessionState()?.role ?? null);
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  signIn(email: string, role: AppRole): void {
    const session = { email: email.trim().toLowerCase(), role };
    this.sessionState.set(session);
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  registerOrganization(application: Omit<OrganizationApplication, 'id' | 'status' | 'submittedAt'>): void {
    const normalizedEmail = application.email.trim().toLowerCase();
    const previous = this.applicationsState().find((item) => item.email === normalizedEmail && item.role === application.role);
    const record: OrganizationApplication = {
      ...application,
      email: normalizedEmail,
      id: previous?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    const next = previous
      ? this.applicationsState().map((item) => item.id === previous.id ? record : item)
      : [...this.applicationsState(), record];
    this.saveApplications(next);
  }

  organizationAccess(email: string, role: Extract<AppRole, 'donor' | 'beneficiary'>): OrganizationApplicationStatus | 'missing' {
    return this.applicationsState().find((item) => item.email === email.trim().toLowerCase() && item.role === role)?.status ?? 'missing';
  }

  reviewOrganization(id: string, status: Extract<OrganizationApplicationStatus, 'approved' | 'rejected'>): void {
    this.saveApplications(this.applicationsState().map((item) => item.id === id ? { ...item, status } : item));
  }

  signOut(): void {
    this.sessionState.set(null);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
  }

  private readSession(): AuthSession | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      if (typeof value === 'object' && value !== null && 'email' in value && 'role' in value
        && typeof value.email === 'string' && roles.includes(value.role as AppRole)) {
        return { email: value.email, role: value.role as AppRole };
      }
    } catch { /* Ignore invalid demo session data. */ }
    return null;
  }

  private readApplications(): readonly OrganizationApplication[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) ?? '[]');
      if (Array.isArray(value)) {
        return value.filter((item): item is OrganizationApplication =>
          typeof item === 'object' && item !== null
          && 'id' in item && typeof item.id === 'string'
          && 'email' in item && typeof item.email === 'string'
          && 'role' in item && (item.role === 'donor' || item.role === 'beneficiary')
          && 'status' in item && (item.status === 'pending' || item.status === 'approved' || item.status === 'rejected'));
      }
    } catch { /* Ignore invalid demo application data. */ }
    return [];
  }

  private saveApplications(applications: readonly OrganizationApplication[]): void {
    this.applicationsState.set(applications);
    if (typeof localStorage !== 'undefined') localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
  }
}
