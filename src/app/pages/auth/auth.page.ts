import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AppRole, AuthService } from '../../services/auth.service';

type RegistrationRole = 'donor' | 'beneficiary' | 'volunteer';

const phonePattern = /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}$/;
const rncPattern = /^\d{3}-?\d{5}-?\d$/;

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  imports: [ReactiveFormsModule, RouterLink],
})
export class AuthPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  readonly isRegister = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url.includes('register')),
    ),
    { initialValue: this.router.url.includes('register') },
  );
  readonly selectedRole = signal<RegistrationRole | null>(null);
  readonly submitted = signal(false);
  readonly loginError = signal('');
  readonly googleError = signal('');
  readonly registrationMessage = signal('');
  readonly registrationError = signal('');
  readonly organizationCategories = signal<import('../../services/auth.service').OrganizationCategory[]>([]);
  readonly catalogError = signal('');

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly donorForm = this.formBuilder.group({
    organizationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    rnc: ['', [Validators.required, Validators.pattern(rncPattern)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    address: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(250)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    representativeName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    institutionType: ['', Validators.required],
  });
  readonly beneficiaryForm = this.formBuilder.group({
    organizationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    institutionType: ['', Validators.required],
    otherInstitutionType: [''],
    rnc: ['', Validators.pattern(rncPattern)],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    address: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(250)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    representativeName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
  });
  readonly volunteerForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    transportType: ['', Validators.required],
    otherTransportType: [''],
    availabilityZone: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    volunteerAgreement: [false, Validators.requiredTrue],
  });

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.handleAuthCallback());
  }

  ngOnInit(): void {
    this.handleAuthCallback();
    this.auth.loadOrganizationCategories().subscribe({ next: (items) => this.organizationCategories.set(items), error: (error: Error) => this.catalogError.set(error.message || 'No se pudieron cargar los tipos de organizacion.') });
  }

  selectRole(role: RegistrationRole): void { this.selectedRole.set(role); this.submitted.set(false); }
  resetRole(): void { this.selectedRole.set(null); this.submitted.set(false); this.registrationMessage.set(''); }
  submitLogin(): void {
    this.loginError.set('');
    this.submit(this.loginForm);
    if (this.loginForm.invalid) return;
    const { email, password } = this.loginForm.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (result) => {
        this.auth.signIn(result.email, result.role);
        void this.router.navigateByUrl('/app/profile');
      },
      error: (error: { status?: number; message?: string }) => {
        this.loginError.set(error.status === 400 || error.status === 401
          ? 'Correo o contrasena incorrectos, o el perfil esta pendiente de aprobacion.'
          : error.message || 'No se pudo conectar con Supabase. Revisa la configuracion e intentalo de nuevo.');
      }
    });
  }

  loginWithGoogle(): void {
    this.googleError.set('');
    void this.auth.loginWithGoogle().catch((error: Error) => this.googleError.set(error.message || 'No se pudo iniciar sesion con Google.'));
  }

  private handleAuthCallback(): void {
    if (!window.location.hash.includes('access_token') && !window.location.search.includes('code=')) return;
    void this.auth.refreshSession().then((session) => {
      if (session) void this.router.navigateByUrl('/app/profile');
      else this.googleError.set('La cuenta de Google todavía no tiene un perfil activo en FoodShare.');
      window.history.replaceState({}, document.title, window.location.pathname);
    });
  }

  submitRegistration(role: RegistrationRole): void {
    this.registrationMessage.set('');
    this.registrationError.set('');
    let form: typeof this.donorForm | typeof this.beneficiaryForm | typeof this.volunteerForm;
    if (role === 'beneficiary') {
      this.setOtherValidation(this.beneficiaryForm.controls.otherInstitutionType, this.beneficiaryForm.controls.institutionType.value === 'other');
      form = this.beneficiaryForm;
    } else if (role === 'volunteer') {
      this.setOtherValidation(this.volunteerForm.controls.otherTransportType, this.volunteerForm.controls.transportType.value === 'other');
      form = this.volunteerForm;
    } else {
      form = this.donorForm;
    }
    this.submit(form);
    if (form.invalid) return;

    let payload: import('../../services/auth.service').RegistrationPayload;
    if (role === 'donor') {
      const profile = this.donorForm.getRawValue();
      payload = { role, email: profile.email, password: profile.password, fullName: profile.representativeName, organizationName: profile.organizationName, rnc: profile.rnc, phone: profile.phone, address: profile.address, city: profile.city, profileType: profile.institutionType };
    } else if (role === 'beneficiary') {
      const profile = this.beneficiaryForm.getRawValue();
      const institutionTypes: Record<string, string> = { community_dining: 'Comedor comunitario', foundation: 'Fundación', ngo: 'ONG', food_bank: 'Banco de alimentos' };
      payload = { role, email: profile.email, password: profile.password, fullName: profile.representativeName, organizationName: profile.organizationName, rnc: profile.rnc, phone: profile.phone, address: profile.address, city: profile.city, profileType: profile.institutionType === 'other' ? profile.otherInstitutionType : profile.institutionType };
    } else {
      const profile = this.volunteerForm.getRawValue();
      payload = { role, email: profile.email, password: profile.password, fullName: profile.fullName, phone: profile.phone, transportType: profile.transportType, otherTransportType: profile.otherTransportType, availabilityZone: profile.availabilityZone, agreementAccepted: profile.volunteerAgreement };
    }
    this.auth.registerAccount(payload).subscribe({
      next: (result) => this.registrationMessage.set(result.status === 'pending'
        ? 'Registro guardado. Podras iniciar sesion cuando administracion verifique la institucion.'
        : 'Registro guardado. Revisa tu correo y luego inicia sesion.'),
      error: (error: Error) => this.registrationError.set(error.message || 'No se pudo guardar el registro en Supabase.'),
    });
  }

  isInvalid(controlName: string, form: 'login' | 'donor' | 'beneficiary' | 'volunteer'): boolean {
    const control = this.getForm(form).get(controlName);
    return Boolean(control?.invalid && (control.touched || this.submitted()));
  }

  showOtherInstitutionType(): boolean { return this.beneficiaryForm.controls.institutionType.value === 'other'; }
  showOtherTransportType(): boolean { return this.volunteerForm.controls.transportType.value === 'other'; }

  private submit(form: typeof this.loginForm | typeof this.donorForm | typeof this.beneficiaryForm | typeof this.volunteerForm): void {
    this.submitted.set(true);
    form.markAllAsTouched();
  }

  private getForm(form: 'login' | 'donor' | 'beneficiary' | 'volunteer'): FormGroup {
    return form === 'login' ? this.loginForm : form === 'donor' ? this.donorForm : form === 'beneficiary' ? this.beneficiaryForm : this.volunteerForm;
  }

  private setOtherValidation(control: typeof this.beneficiaryForm.controls.otherInstitutionType, required: boolean): void {
    control.setValidators(required ? [Validators.required, Validators.minLength(3), Validators.maxLength(100)] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }
}
