// Offline storage utilities for hazard reports

interface PendingReport {
  id: string;
  type: string;
  severity: number;
  lat: number;
  lng: number;
  notes?: string;
  photo?: File;
  timestamp: number;
  status: 'pending_upload';
}

const PENDING_REPORTS_KEY = 'ocean_safety_pending_reports';

export const savePendingReport = (report: Omit<PendingReport, 'id' | 'timestamp' | 'status'>) => {
  try {
    const pendingReports = getPendingReports();
    const newReport: PendingReport = {
      ...report,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'pending_upload'
    };
    
    pendingReports.push(newReport);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pendingReports));
    
    return newReport.id;
  } catch (error) {
    console.error('Error saving pending report:', error);
    return null;
  }
};

export const getPendingReports = (): PendingReport[] => {
  try {
    const stored = localStorage.getItem(PENDING_REPORTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting pending reports:', error);
    return [];
  }
};

export const removePendingReport = (id: string) => {
  try {
    const pendingReports = getPendingReports();
    const filtered = pendingReports.filter(report => report.id !== id);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing pending report:', error);
  }
};

export const clearPendingReports = () => {
  try {
    localStorage.removeItem(PENDING_REPORTS_KEY);
  } catch (error) {
    console.error('Error clearing pending reports:', error);
  }
};

export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const getOfflineReportsCount = (): number => {
  return getPendingReports().length;
};