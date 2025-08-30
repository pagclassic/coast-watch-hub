import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingReports, removePendingReport, isOnline } from '@/lib/offline-storage';
import { toast } from '@/hooks/use-toast';

export const useOfflineSync = () => {
  const { user } = useAuth();

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `hazard-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('hazard-photos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('hazard-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const syncPendingReports = useCallback(async () => {
    if (!user || !isOnline()) return;

    const pendingReports = getPendingReports();
    if (pendingReports.length === 0) return;

    let syncedCount = 0;
    let failedCount = 0;

    for (const report of pendingReports) {
      try {
        let photoUrl = null;
        if (report.photo) {
          photoUrl = await uploadPhoto(report.photo);
        }

        const { error } = await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            type: report.type,
            severity: report.severity,
            lat: report.lat,
            lng: report.lng,
            notes: report.notes || null,
            photo_url: photoUrl,
            status: 'pending'
          });

        if (error) {
          throw error;
        }

        // Remove from pending reports
        removePendingReport(report.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing report:', error);
        failedCount++;
      }
    }

    if (syncedCount > 0) {
      toast({
        title: "Reports Synced",
        description: `${syncedCount} offline report${syncedCount > 1 ? 's' : ''} successfully uploaded!`,
      });
    }

    if (failedCount > 0) {
      toast({
        title: "Sync Issues",
        description: `${failedCount} report${failedCount > 1 ? 's' : ''} failed to sync. Will retry later.`,
        variant: "destructive"
      });
    }
  }, [user]);

  // Listen for online events
  useEffect(() => {
    const handleOnline = () => {
      syncPendingReports();
    };

    window.addEventListener('online', handleOnline);
    
    // Also sync when component mounts if online
    if (isOnline()) {
      syncPendingReports();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingReports]);

  return {
    syncPendingReports,
    pendingReportsCount: getPendingReports().length
  };
};