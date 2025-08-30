// Map-related TypeScript interfaces and types for future features

export interface MapPosition {
  lat: number;
  lng: number;
}

export interface MapBounds {
  northeast: MapPosition;
  southwest: MapPosition;
}

export interface HazardReport {
  id: string;
  user_id: string;
  type: 'oil_spill' | 'debris' | 'strong_current' | 'shallow_water' | 'weather' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  position: MapPosition;
  photo_url?: string;
  notes?: string;
  status: 'pending' | 'verified' | 'invalid' | 'resolved';
  created_at: string;
  updated_at: string;
  verified_by?: string;
  verification_date?: string;
}

export interface MapFilter {
  types: string[];
  severities: number[];
  statuses: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'hazards' | 'weather' | 'traffic' | 'bathymetry' | 'custom';
  source?: string;
}

// Future feature interfaces
export interface MapSearchResult {
  id: string;
  name: string;
  position: MapPosition;
  type: 'location' | 'hazard' | 'facility';
}

export interface MapAnalytics {
  totalReports: number;
  criticalHazards: number;
  averageSeverity: number;
  mostCommonType: string;
  recentActivity: HazardReport[];
}