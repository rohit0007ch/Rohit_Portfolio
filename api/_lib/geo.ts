import { createHash } from 'node:crypto';

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  ipHash: string | null;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0]?.trim() || null;
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    return value || null;
  }
  return null;
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
