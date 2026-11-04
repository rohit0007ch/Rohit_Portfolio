export interface DeviceInfo {
  browser: string;
  browserVersion: string;
  operatingSystem: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  screenResolution: string;
  timezone: string;
}

function firstMatch(ua: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = ua.match(pattern);
    if (match) {
      return match;
    }
  }
  return null;
}

function detectBrowser(ua: string): { browser: string; browserVersion: string } {
  const edge = firstMatch(ua, [/Edg(?:e|A|iOS)?\/([\d.]+)/i]);
  if (edge) {
    return { browser: 'Edge', browserVersion: edge[1] ?? 'unknown' };
  }

  const opera = firstMatch(ua, [/OPR\/([\d.]+)/i, /Opera\/([\d.]+)/i]);
  if (opera) {
    return { browser: 'Opera', browserVersion: opera[1] ?? 'unknown' };
  }

  const chrome = firstMatch(ua, [/Chrome\/([\d.]+)/i, /CriOS\/([\d.]+)/i]);
  if (chrome && !/Chromium/i.test(ua)) {
    return { browser: 'Chrome', browserVersion: chrome[1] ?? 'unknown' };
  }

  const firefox = firstMatch(ua, [/Firefox\/([\d.]+)/i, /FxiOS\/([\d.]+)/i]);
  if (firefox) {
    return { browser: 'Firefox', browserVersion: firefox[1] ?? 'unknown' };
  }

  const safari = firstMatch(ua, [/Version\/([\d.]+).*Safari/i]);
  if (safari || /Safari/i.test(ua)) {
    return {
      browser: 'Safari',
      browserVersion: safari?.[1] ?? 'unknown',
    };
  }

  return { browser: 'Unknown', browserVersion: 'unknown' };
}

function detectOs(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return 'Windows 10+';
  if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.2/i.test(ua)) return 'Windows 8';
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  return 'Unknown';
}

function detectDeviceType(ua: string): DeviceInfo['deviceType'] {
  if (/iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) {
    return 'mobile';
  }
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Mac/i.test(ua)) {
    // iPadOS desktop UA fallback
    return 'tablet';
  }
  return 'desktop';
}

export function collectDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const { browser, browserVersion } = detectBrowser(ua);

  let timezone = 'unknown';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    timezone = 'unknown';
  }

  const width = typeof window !== 'undefined' ? window.screen?.width : 0;
  const height = typeof window !== 'undefined' ? window.screen?.height : 0;

  return {
    browser,
    browserVersion,
    operatingSystem: detectOs(ua),
    deviceType: detectDeviceType(ua),
    screenResolution:
      width && height ? `${width}x${height}` : 'unknown',
    timezone,
  };
}
