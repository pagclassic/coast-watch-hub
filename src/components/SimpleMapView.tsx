import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MapPin, 
  AlertTriangle, 
  Navigation, 
  Plus,
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

interface SimpleMapViewProps {
  onReportClick?: () => void;
  onMarkerClick?: (reportId: string) => void;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}

const SimpleMapView: React.FC<SimpleMapViewProps> = ({ 
  onReportClick, 
  onMarkerClick, 
  onLocationChange 
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    getCurrentLocation();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('simple_map_reports_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          if (onLocationChange) {
            onLocationChange(location);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          const defaultLocation = { lat: 37.7749, lng: -122.4194 };
          setUserLocation(defaultLocation);
          if (onLocationChange) {
            onLocationChange(defaultLocation);
          }
        }
      );
    }
  };

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setReports(data || []);
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
      case 'invalid':
        return <Badge variant="destructive">Invalid</Badge>;
      case 'flagged':
        return <Badge className="bg-yellow-500 text-white">Flagged</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <Navigation className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Map-style view with location info */}
      <div className="h-full flex flex-col">
        {/* Header with location */}
        {userLocation && (
          <Card className="m-4 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">Your Location</p>
                  <p className="text-sm text-muted-foreground">
                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports Grid */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Hazard Reports</h3>
            <Badge variant="outline">{reports.length} total</Badge>
          </div>

          <ScrollArea className="h-full">
            <div className="grid gap-3">
              {reports.map((report) => (
                <Card 
                  key={report.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onMarkerClick?.(report.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* Photo or Icon */}
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
                            <h4 className="font-medium capitalize">
                              {report.type.replace('_', ' ')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(report.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            {getSeverityBadge(report.severity)}
                            {getStatusBadge(report.status)}
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
                          {userLocation && (
                            <span className="ml-2">
                              • {calculateDistance(
                                userLocation.lat, 
                                userLocation.lng, 
                                report.lat, 
                                report.lng
                              ).toFixed(1)}km away
                            </span>
                          )}
                        </div>

                        {/* Notes Preview */}
                        {report.notes && (
                          <p className="text-sm text-foreground line-clamp-2">
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

              {reports.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium">No hazards reported</p>
                    <p className="text-sm text-muted-foreground">
                      Be the first to report a marine hazard in your area
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Floating Report Button */}
      {onReportClick && (
        <Button
          onClick={onReportClick}
          size="lg"
          className="absolute bottom-6 right-6 z-10 rounded-full w-14 h-14 bg-primary hover:bg-primary/90 shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

      {/* Map Legend */}
      <Card className="absolute top-4 left-4 z-10 shadow-lg">
        <CardContent className="p-3">
          <h4 className="font-medium text-sm mb-2">Hazard Severity</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span>Critical (4-5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>High (3)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Medium-Low (1-2)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleMapView;