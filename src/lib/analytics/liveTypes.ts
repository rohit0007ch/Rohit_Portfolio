export interface AnonymizedSession {
  displayIndex: number;
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
  screenResolution: string;
  timezone: string;
  startedAtLabel: string;
  lastSeenAtLabel: string;
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
