import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  MapPin, 
  Calendar,
  Navigation,
  Eye
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Report {
  id: string;
  user_id: string;
  type: string;
  severity: number;
  lat: number;
  lng: number;
  photo_url?: string;
  notes?: string;
  status: string;
  created_at: string;
}

interface HazardFeedProps {
  userLocation?: { lat: number; lng: number } | null;
  onReportClick: (reportId: string) => void;
  maxDistance?: number; // in kilometers
}

const HazardFeed: React.FC<HazardFeedProps> = ({
  userLocation,
  onReportClick,
  maxDistance = 50
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNearbyReports();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('feed_reports_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchNearbyReports();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userLocation]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchNearbyReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .neq('status', 'invalid')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      let filteredReports = data || [];

      // Filter by distance if user location is available
      if (userLocation) {
        filteredReports = filteredReports.filter(report => {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            report.lat,
            report.lng
          );
          return distance <= maxDistance;
        });

        // Sort by distance
        filteredReports.sort((a, b) => {
          const distanceA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
          const distanceB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
          return distanceA - distanceB;
        });
      }

      setReports(filteredReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load hazard reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 4) return <Badge variant="destructive">Critical</Badge>;
    if (severity >= 3) return <Badge className="bg-orange-500 text-white">High</Badge>;
    if (severity >= 2) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500 text-white">Verified</Badge>;
      case 'flagged':
        return <Badge className="bg-yellow-500 text-white">Flagged</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const now = new Date();
    const reportDate = new Date(dateString);
    const diffMs = now.getTime() - reportDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return reportDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDistance = (report: Report): string => {
    if (!userLocation) return '';
    
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      report.lat,
      report.lng
    );

    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <Navigation className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
        <div>
          <p className="font-medium text-foreground">No hazards reported</p>
          <p className="text-sm text-muted-foreground">
            {userLocation ? 'No hazards found in your area' : 'Enable location to see nearby hazards'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Recent Hazards</h3>
          <Badge variant="outline">{reports.length} reports</Badge>
        </div>

        {reports.map((report) => (
          <Card 
            key={report.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onReportClick(report.id)}
          >
            <CardContent className="p-4">
              <div className="flex gap-3">
                {/* Photo Thumbnail */}
                <div className="flex-shrink-0">
                  {report.photo_url ? (
                    <img
                      src={report.photo_url}
                      alt="Hazard"
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-md">
                      <AlertTriangle className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Report Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm capitalize">
                        {report.type.replace('_', ' ')}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(report.created_at)}</span>
                        {userLocation && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span>{formatDistance(report)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {getSeverityBadge(report.severity)}
                      {getStatusBadge(report.status)}
                    </div>
                  </div>

                  {/* Notes Preview */}
                  {report.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {report.notes}
                    </p>
                  )}

                  {/* View Button */}
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default HazardFeed;