import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { CommunityOrganization } from '../../services/auth.service';
import { MapServicesService } from '../../services/map-services.service';

@Component({
  selector: 'app-organization-map',
  standalone: true,
  template: '<div #mapCanvas class="organization-map-canvas" role="application" aria-label="Mapa de organizaciones de apoyo"></div>',
  styleUrls: ['./organization-map.component.scss'],
})
export class OrganizationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly mapServices = inject(MapServicesService);
  @Input() organizations: CommunityOrganization[] = [];
  @Output() organizationSelected = new EventEmitter<string>();
  @Output() mapError = new EventEmitter<void>();
  @ViewChild('mapCanvas', { static: true }) private mapCanvas!: ElementRef<HTMLDivElement>;

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markers?: Leaflet.LayerGroup;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const leaflet = await import('leaflet');
      if (this.destroyed) return;
      const configuration = await this.mapServices.load();
      if (this.destroyed) return;
      this.leaflet = leaflet;
      this.map = leaflet.map(this.mapCanvas.nativeElement, { scrollWheelZoom: false, zoomControl: true }).setView([18.7357, -70.1627], 8);
      leaflet.tileLayer(configuration.tileUrlTemplate, {
        maxZoom: 19,
        attribution: configuration.tileAttribution,
      }).addTo(this.map);
      this.markers = leaflet.layerGroup().addTo(this.map);
      this.renderMarkers();
      requestAnimationFrame(() => this.map?.invalidateSize());
    } catch {
      this.mapCanvas.nativeElement.dataset['mapError'] = 'true';
      this.mapError.emit();
    }
  }

  ngOnChanges(_changes: SimpleChanges): void { this.renderMarkers(); }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
    this.map = undefined;
  }

  private renderMarkers(): void {
    if (!this.leaflet || !this.map || !this.markers) return;
    this.markers.clearLayers();
    const locations = this.organizations.filter((organization) => this.hasValidLocation(organization));
    for (const organization of locations) {
      const isDonor = organization.organizationType === 'donor';
      const marker = this.leaflet.marker([organization.latitude!, organization.longitude!], {
        title: organization.name,
        alt: `Ubicación de ${organization.name}`,
        icon: this.leaflet.divIcon({
          className: 'organization-map-div-icon',
          html: `<span class="organization-map-pin organization-map-pin--${isDonor ? 'donor' : 'beneficiary'}${organization.locationPrecision === 'city' ? ' organization-map-pin--approximate' : ''}"><span>${isDonor ? '✦' : '♡'}</span></span>`,
          iconSize: [36, 44],
          iconAnchor: [18, 42],
          popupAnchor: [0, -39],
        }),
      }).addTo(this.markers);
      marker.bindPopup(this.popupContent(organization), { maxWidth: 280, minWidth: 190, autoPan: true });
      marker.on('click', () => this.organizationSelected.emit(organization.id));
    }
    if (locations.length > 1) {
      this.map.fitBounds(this.leaflet.featureGroup(this.markers.getLayers() as Leaflet.Layer[]).getBounds().pad(0.18), { maxZoom: 13 });
    } else if (locations.length === 1) {
      this.map.setView([locations[0].latitude!, locations[0].longitude!], 13);
    } else {
      this.map.setView([18.7357, -70.1627], 8);
    }
  }

  private hasValidLocation(organization: CommunityOrganization): boolean {
    return organization.latitude !== null && organization.longitude !== null
      && Number.isFinite(organization.latitude) && Number.isFinite(organization.longitude)
      && organization.latitude >= 17 && organization.latitude <= 20
      && organization.longitude >= -72 && organization.longitude <= -68.2;
  }

  private popupContent(organization: CommunityOrganization): string {
    const type = organization.organizationType === 'donor' ? 'Organización donante' : 'Organización beneficiaria';
    const address = [organization.address, organization.city].filter(Boolean).join(', ');
    const approximate = organization.locationPrecision === 'city'
      ? '<p class="organization-map-popup__note">Ubicación aproximada al centro de la ciudad</p>'
      : '';
    return `<article class="organization-map-popup"><span class="organization-map-popup__type">${this.escapeHtml(type)}</span><strong>${this.escapeHtml(organization.name)}</strong>${organization.profileType ? `<span class="organization-map-popup__category">${this.escapeHtml(organization.profileType)}</span>` : ''}${address ? `<span class="organization-map-popup__address">${this.escapeHtml(address)}</span>` : ''}${approximate}</article>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]!);
  }
}
