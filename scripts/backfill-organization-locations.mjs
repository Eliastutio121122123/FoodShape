import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno antes de ejecutar este proceso.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const cache = new Map();
let lastRequestAt = 0;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function geocode(query) {
  const key = query.trim().toLocaleLowerCase();
  if (cache.has(key)) return cache.get(key);
  const elapsed = Date.now() - lastRequestAt;
  // Bulk geocoding is intentionally kept to four calls per minute for OSM's
  // public Nominatim service.
  if (elapsed < 15_100) await pause(15_100 - elapsed);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: `${query}, República Dominicana`, format: 'jsonv2', limit: '1', countrycodes: 'do' }).toString();
  lastRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { 'User-Agent': `FoodShare organization location backfill/1.0 (${supabaseUrl})`, 'Accept-Language': 'es' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status} al buscar una ubicación.`);
  const results = await response.json();
  const hit = Array.isArray(results) ? results[0] : null;
  if (!hit) { cache.set(key, null); return null; }
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  const point = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 17 && latitude <= 20 && longitude >= -72 && longitude <= -68.2
    ? { latitude, longitude, type: hit.type, addressType: hit.addresstype }
    : null;
  cache.set(key, point);
  return point;
}

const organizations = [];
for (let offset = 0; ; offset += 500) {
  const { data, error } = await supabase.from('organizations')
    .select('id, name, address, city, latitude, longitude')
    .eq('verification_status', 'approved').eq('status', 'active')
    .or('latitude.is.null,longitude.is.null').order('id').range(offset, offset + 499);
  if (error) throw error;
  organizations.push(...(data ?? []));
  if (!data || data.length < 500) break;
}

let updated = 0;
let unresolved = 0;
for (const organization of organizations ?? []) {
  let point = null;
  let precision = 'unknown';
  const addressQuery = [organization.address, organization.city].filter(Boolean).join(', ');
  if (addressQuery) {
    try { point = await geocode(addressQuery); } catch (reason) {
      console.error(`No se pudo consultar la dirección de ${organization.name}: ${reason.message}`);
    }
    if (point) precision = ['house', 'building', 'road', 'residential'].includes(point.addressType) ? 'address' : 'city';
  }
  // If the street address was not found, use only a municipality result as an
  // explicitly approximate fallback. Unmatched locations remain null.
  if (!point && organization.city) {
    try { point = await geocode(organization.city); } catch (reason) {
      console.error(`No se pudo consultar la ciudad de ${organization.name}: ${reason.message}`);
    }
    if (point) precision = 'city';
  }
  if (!point) { unresolved += 1; console.warn(`Sin coordenadas seguras: ${organization.name}`); continue; }

  const { error: updateError } = await supabase.from('organizations').update({
    latitude: point.latitude, longitude: point.longitude, location_precision: precision,
  }).eq('id', organization.id).eq('verification_status', 'approved').eq('status', 'active');
  if (updateError) console.error(`No se pudo guardar ${organization.name}: ${updateError.message}`);
  else { updated += 1; console.log(`${organization.name}: ${precision === 'address' ? 'dirección' : 'centro de ciudad'}`); }
}

console.log(`Proceso terminado. Actualizadas: ${updated}. Sin ubicación: ${unresolved}.`);
console.log('Los resultados deben revisarse; las ubicaciones de ciudad son aproximadas. OpenStreetMap/Nominatim proporcionó las coordenadas.');
