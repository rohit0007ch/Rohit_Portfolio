export type AnalyticsRange = 'today' | '7d' | '30d' | 'all';

export interface NamedCount {
  label: string;
  count: number;
}

export interface TimePoint {
  t: string;
  count: number;
}

export interface PublicAnalytics {
  success: boolean;
  range: AnalyticsRange;
  timezone: string;
  updatedAt: string;
  updatedAtLabel: string;
  overview: {
    totalVisitors: number;
    uniqueVisitors: number;
    activeVisitors: number;
    totalSessions: number;
    totalPageViews: number;
    resumeDownloads: number;
  };
  live: {
    activeVisitors: number;
    visitorsOverTime: TimePoint[];
    pageViewsOverTime: TimePoint[];
  };
  demographics: {
    countries: NamedCount[];
    cities: NamedCount[];
    browsers: NamedCount[];
    operatingSystems: NamedCount[];
    deviceTypes: NamedCount[];
    screenResolutions: NamedCount[];
  };
  pages: {
    totalViews: number;
    top: Array<{ path: string; views: number }>;
  };
  resume: {
    totalSuccessful: number;
    byFilename: NamedCount[];
    overTime: TimePoint[];
  };
  message?: string;
}
