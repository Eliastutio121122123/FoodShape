import { Injectable } from '@angular/core';

export interface MapServicesConfiguration {
  geocodingSearchUrl: string;
  tileUrlTemplate: string;
  tileAttribution: string;
}

const DEFAULT_CONFIGURATION: MapServicesConfiguration = {
  geocodingSearchUrl: 'https://nominatim.openstreetmap.org/search',
  tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

@Injectable({ providedIn: 'root' })
export class MapServicesService {
  private configurationPromise?: Promise<MapServicesConfiguration>;

  load(): Promise<MapServicesConfiguration> {
    this.configurationPromise ??= this.fetchConfiguration();
    return this.configurationPromise;
  }

  private async fetchConfiguration(): Promise<MapServicesConfiguration> {
    try {
      const configUrl = new URL('assets/map-services.json', document.baseURI);
      const response = await fetch(configUrl, { cache: 'no-store' });
      if (!response.ok) return DEFAULT_CONFIGURATION;
      const value = await response.json() as Partial<MapServicesConfiguration>;
      return {
        geocodingSearchUrl: this.isHttpsUrl(value.geocodingSearchUrl) ? value.geocodingSearchUrl! : DEFAULT_CONFIGURATION.geocodingSearchUrl,
        tileUrlTemplate: this.isHttpsUrl(value.tileUrlTemplate) ? value.tileUrlTemplate! : DEFAULT_CONFIGURATION.tileUrlTemplate,
        tileAttribution: typeof value.tileAttribution === 'string' && value.tileAttribution.trim()
          ? value.tileAttribution : DEFAULT_CONFIGURATION.tileAttribution,
      };
    } catch {
      return DEFAULT_CONFIGURATION;
    }
  }

  private isHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try { return new URL(value.replace('{z}', '1').replace('{x}', '1').replace('{y}', '1')).protocol === 'https:'; }
    catch { return false; }
  }
}
