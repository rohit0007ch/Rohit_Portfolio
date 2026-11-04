import { createHash } from 'node:crypto';

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  ipHash: string | null;
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' ')).trim();
  } catch {
    return value.trim();
  }
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }
  const decoded = decodeHeaderValue(value);
  return decoded || null;
}

function extractClientIp(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const forwarded = headerValue(headers, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return (
    headerValue(headers, 'x-real-ip') ||
    headerValue(headers, 'x-vercel-forwarded-for')
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
    country: headerValue(headers, 'x-vercel-ip-country'),
    region: headerValue(headers, 'x-vercel-ip-country-region'),
    city: headerValue(headers, 'x-vercel-ip-city'),
    postalCode: headerValue(headers, 'x-vercel-ip-postal-code'),
    ipHash,
  };
}
