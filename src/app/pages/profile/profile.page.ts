import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AccountProfile, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonContent, RouterLink],
})
export class ProfilePage {
  @ViewChild('cropImageRef') cropImageRef?: ElementRef<HTMLImageElement>;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly account = signal<AccountProfile | null>(null);
  readonly fullName = signal('');
  readonly phone = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly signingOut = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly roleName = computed(() => ({
    admin: 'Administración', donor: 'Organización donante', beneficiary: 'Organización beneficiaria', volunteer: 'Voluntariado',
  })[this.account()?.role ?? 'volunteer']);
  readonly homeRoute = computed(() => {
    const role = this.account()?.role ?? this.auth.currentRole();
    return role ? `/app/${role}` : '/login';
  });

  // ── Modal de Foto de Perfil ─────────────────────────────
  readonly showAvatarModal = signal(false);
  readonly rawImageSrc = signal<string | null>(null);
  readonly zoom = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly savingAvatar = signal(false);
  readonly avatarError = signal('');

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  // Viewport circle diameter in px
  readonly viewportSize = 250;

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.auth.loadAccountProfile().subscribe({
      next: (profile) => {
        this.account.set(profile);
        this.fullName.set(profile.fullName);
        this.phone.set(profile.phone);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message || 'No se pudo cargar el perfil.');
        this.loading.set(false);
      },
    });
  }

  updateFullName(event: Event): void { this.fullName.set((event.target as HTMLInputElement).value); }
  updatePhone(event: Event): void { this.phone.set((event.target as HTMLInputElement).value); }

  save(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!this.fullName().trim()) {
      this.errorMessage.set('Escribe tu nombre para guardar el perfil.');
      return;
    }

    this.saving.set(true);
    this.auth.updateAccountProfile(this.fullName(), this.phone()).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Perfil actualizado.');
        this.reload();
      },
      error: (error: Error) => {
        this.saving.set(false);
        this.errorMessage.set(error.message || 'No se pudo guardar el perfil.');
      },
    });
  }

  async signOut(): Promise<void> {
    this.errorMessage.set('');
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cerrar la sesion.');
    } finally {
      this.signingOut.set(false);
    }
  }

  // ── Editor de foto de perfil ──────────────────────────
  openAvatarEditor(): void {
    this.avatarError.set('');
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
    this.rawImageSrc.set(this.account()?.avatarUrl ?? null);
    this.showAvatarModal.set(true);
  }

  closeAvatarEditor(): void {
    this.showAvatarModal.set(false);
    this.rawImageSrc.set(null);
    this.avatarError.set('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Por favor, selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.rawImageSrc.set(reader.result as string);
      this.zoom.set(1);
      this.panX.set(0);
      this.panY.set(0);
      this.avatarError.set('');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onZoomChange(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.zoom.set(val);
  }

  resetPosition(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    if (!this.rawImageSrc()) return;
    this.isDragging = true;
    const point = 'touches' in event ? event.touches[0] : event;
    this.dragStartX = point.clientX;
    this.dragStartY = point.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
    event.preventDefault();
  }

  onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const point = 'touches' in event ? event.touches[0] : event;
    const dx = point.clientX - this.dragStartX;
    const dy = point.clientY - this.dragStartY;
    this.panX.set(this.initialPanX + dx);
    this.panY.set(this.initialPanY + dy);
    event.preventDefault();
  }

  endDrag(): void {
    this.isDragging = false;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    const newZoom = Math.max(0.6, Math.min(3.5, this.zoom() + delta));
    this.zoom.set(Math.round(newZoom * 100) / 100);
  }

  cropAndSave(): void {
    const src = this.rawImageSrc();
    if (!src) {
      this.avatarError.set('Selecciona una imagen primero.');
      return;
    }

    this.savingAvatar.set(true);
    this.avatarError.set('');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const outSize = 400;
        const canvas = document.createElement('canvas');
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo inicializar el procesador de imágenes.');

        const V = this.viewportSize;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;

        const baseScale = Math.max(V / nw, V / nh);
        const currentScale = baseScale * this.zoom();

        const renderedW = nw * currentScale;
        const renderedH = nh * currentScale;

        const leftInViewport = (V / 2) + this.panX() - (renderedW / 2);
        const topInViewport = (V / 2) + this.panY() - (renderedH / 2);

        const scaleFactor = outSize / V;
        const destX = leftInViewport * scaleFactor;
        const destY = topInViewport * scaleFactor;
        const destW = renderedW * scaleFactor;
        const destH = renderedH * scaleFactor;

        // Circular clip
        ctx.beginPath();
        ctx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, destX, destY, destW, destH);

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

        this.auth.saveProfilePhoto(croppedDataUrl).subscribe({
          next: () => {
            this.savingAvatar.set(false);
            const current = this.account();
            if (current) {
              this.account.set({ ...current, avatarUrl: croppedDataUrl });
            }
            this.closeAvatarEditor();
            this.successMessage.set('Foto de perfil guardada exitosamente.');
          },
          error: (err: Error) => {
            this.savingAvatar.set(false);
            this.avatarError.set(err.message || 'No se pudo guardar la foto de perfil.');
          },
        });
      } catch (err: unknown) {
        this.savingAvatar.set(false);
        this.avatarError.set(err instanceof Error ? err.message : 'Error al procesar la imagen.');
      }
    };
    img.onerror = () => {
      this.savingAvatar.set(false);
      this.avatarError.set('No se pudo cargar la imagen para procesarla.');
    };
    img.src = src;
  }
}
