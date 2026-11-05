import { createHash } from 'node:crypto';

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  ipHash: string | null;
}

/**
 * Iteratively URL-decode location labels so values like
 * `San%20Jose` / `Pati%C4%81la` collapse to a single display form.
 */
export function normalizeGeoLabel(
  value: string | null | undefined
): string | null {
  if (value == null) return null;

  let current = String(value).trim();
  if (!current) return null;

  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, ' ')).trim();
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  current = current.replace(/\s+/g, ' ').trim();
  return current || null;
}

function rawHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function geoHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  return normalizeGeoLabel(rawHeaderValue(headers, name));
}

function extractClientIp(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const forwarded = rawHeaderValue(headers, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return (
    rawHeaderValue(headers, 'x-real-ip') ||
    rawHeaderValue(headers, 'x-vercel-forwarded-for')
  );
}

export function getRequestGeo(
  headers: Record<string, string | string[] | undefined>
): GeoInfo {
  const ip = extractClientIp(headers);
  const ipHash = ip
    ? createHash('sha256').update(ip).digest('hex').slice(0, 64)
    : null;

  return {
    country: geoHeaderValue(headers, 'x-vercel-ip-country'),
    region: geoHeaderValue(headers, 'x-vercel-ip-country-region'),
    city: geoHeaderValue(headers, 'x-vercel-ip-city'),
    postalCode: geoHeaderValue(headers, 'x-vercel-ip-postal-code'),
    ipHash,
  };
}
