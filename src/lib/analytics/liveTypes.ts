export interface AnonymizedSession {
  sessionKey: string;
  label: string;
  isLive: boolean;
  deviceType: string;
  operatingSystem: string;
  browser: string;
  browserVersion: string;
  country: string;
  region: string;
  city: string;
  postalCode: string;
  locationLabel: string;
  screenResolution: string;
  timezone: string;
  startedAt: string | null;
  lastSeenAt: string | null;
  startedAtLabel: string;
  lastSeenAtLabel: string;
  lastSeenRelative: string;
}

export interface LiveTelemetry {
  success: boolean;
  timezone: string;
  updatedAt: string;
  updatedAtLabel: string;
  overview: {
    totalVisitors: number;
    uniqueDevices: number;
    activeWatchers: number;
  };
  watchingLabel: string;
  sessions: AnonymizedSession[];
  message?: string;
}
