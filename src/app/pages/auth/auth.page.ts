import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
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
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

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
  readonly registrationMessage = signal('');

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['donor' as AppRole, Validators.required],
  });
  readonly donorForm = this.formBuilder.group({
    organizationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    rnc: ['', [Validators.required, Validators.pattern(rncPattern)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    address: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(250)]],
    representativeName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
  });
  readonly beneficiaryForm = this.formBuilder.group({
    organizationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    institutionType: ['', Validators.required],
    otherInstitutionType: [''],
    rnc: ['', Validators.pattern(rncPattern)],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    address: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(250)]],
    representativeName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
  });
  readonly volunteerForm = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(phonePattern)]],
    transportType: ['', Validators.required],
    otherTransportType: [''],
    availabilityZone: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    volunteerAgreement: [false, Validators.requiredTrue],
  });

  selectRole(role: RegistrationRole): void { this.selectedRole.set(role); this.submitted.set(false); }
  resetRole(): void { this.selectedRole.set(null); this.submitted.set(false); this.registrationMessage.set(''); }
  submitLogin(): void {
    this.loginError.set('');
    this.submit(this.loginForm);
    if (this.loginForm.invalid) return;
    const { email, role } = this.loginForm.getRawValue();
    if (role === 'donor' || role === 'beneficiary') {
      const status = this.auth.organizationAccess(email, role);
      if (status !== 'approved') {
        this.loginError.set(status === 'pending'
          ? 'Tu organización está pendiente de verificación por administración.'
          : status === 'rejected'
            ? 'La solicitud fue rechazada. Contacta a FoodShare para revisar los datos antes de volver a solicitar.'
            : 'No encontramos una solicitud aprobada para este correo. Registra tu organización primero.');
        return;
      }
    }
    this.auth.signIn(email, role);
    const destination = this.rolePath(role);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl?.startsWith('/app/') && returnUrl === destination ? returnUrl : destination);
  }

  private rolePath(role: AppRole): string {
    return role === 'admin' ? '/app/admin' : `/app/${role}`;
  }

  submitRegistration(role: RegistrationRole): void {
    this.registrationMessage.set('');
    let form: typeof this.donorForm | typeof this.beneficiaryForm | typeof this.volunteerForm;
    let email: string;
    if (role === 'beneficiary') {
      this.setOtherValidation(this.beneficiaryForm.controls.otherInstitutionType, this.beneficiaryForm.controls.institutionType.value === 'other');
      form = this.beneficiaryForm;
      email = this.beneficiaryForm.controls.email.value;
    } else if (role === 'volunteer') {
      this.setOtherValidation(this.volunteerForm.controls.otherTransportType, this.volunteerForm.controls.transportType.value === 'other');
      form = this.volunteerForm;
      email = this.volunteerForm.controls.email.value;
    } else {
      form = this.donorForm;
      email = this.donorForm.controls.email.value;
    }
    this.submit(form);
    if (form.invalid) return;

    if (role === 'volunteer') {
      this.auth.signIn(email, role);
      void this.router.navigateByUrl(this.rolePath(role));
      return;
    }

    if (role === 'donor') {
      const profile = this.donorForm.getRawValue();
      this.auth.registerOrganization({ role, email, organizationName: profile.organizationName, rnc: profile.rnc, phone: profile.phone, address: profile.address, representativeName: profile.representativeName });
    } else {
      const profile = this.beneficiaryForm.getRawValue();
      this.auth.registerOrganization({ role, email, organizationName: profile.organizationName, rnc: profile.rnc, phone: profile.phone, address: profile.address, representativeName: profile.representativeName, profileType: profile.institutionType === 'other' ? profile.otherInstitutionType : profile.institutionType });
    }
    this.registrationMessage.set('Solicitud enviada. Podrás iniciar sesión cuando administración verifique tu organización.');
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
