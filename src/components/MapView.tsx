import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, Navigation, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Fix default markers issue - only run in browser
if (typeof window !== 'undefined') {
  // Remove default icon URL getter
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  // Set default icon options
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

// Create default icon
const createDefaultIcon = () => {
  return L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Create custom hazard icons
const createHazardIcon = (severity: number, type: string) => {
  const color = severity >= 4 ? '#dc2626' : severity >= 3 ? '#ea580c' : '#0ea5e9';
  const svgIcon = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="3"/>
      <path d="M16 8l-1 8h2l-1-8zm0 12v2h2v-2z" fill="white"/>
    </svg>
  `;
  
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

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

interface MapViewProps {
  onReportClick?: () => void;
  onMarkerClick?: (reportId: string) => void;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}

// Location finder component
const LocationFinder: React.FC<{ onLocationFound: (lat: number, lng: number) => void }> = ({ onLocationFound }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleLocation = () => {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            try {
              map.setView([latitude, longitude], 13);
              onLocationFound(latitude, longitude);
            } catch (error) {
              console.error('Error setting map view:', error);
              onLocationFound(latitude, longitude);
            }
          },
          (error) => {
            console.error('Error getting location:', error);
            toast({
              title: "Location Error",
              description: "Could not get your current location. Using default location.",
              variant: "destructive"
            });
            // Default to San Francisco Bay
            try {
              map.setView([37.7749, -122.4194], 10);
            } catch (mapError) {
              console.error('Error setting default map view:', mapError);
            }
            onLocationFound(37.7749, -122.4194);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
        );
      } else {
        // Default to San Francisco Bay
        try {
          map.setView([37.7749, -122.4194], 10);
        } catch (mapError) {
          console.error('Error setting default map view:', mapError);
        }
        onLocationFound(37.7749, -122.4194);
      }
    };

    // Add a small delay to ensure map is fully initialized
    const timer = setTimeout(handleLocation, 100);

    return () => clearTimeout(timer);
  }, [map, onLocationFound]);

  return null;
};

const MapView: React.FC<MapViewProps> = ({ onReportClick, onMarkerClick, onLocationChange }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
        toast({
          title: "Error",
          description: "Failed to load hazard reports",
          variant: "destructive"
        });
      } else {
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('reports_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          fetchReports(); // Refetch all reports when there's a change
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLocationFound = (lat: number, lng: number) => {
    setUserLocation([lat, lng]);
    if (onLocationChange) {
      onLocationChange({ lat, lng });
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <Navigation className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <MapContainer
        center={[37.7749, -122.4194]} // Default to San Francisco Bay
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        key="main-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <LocationFinder onLocationFound={handleLocationFound} />
        
        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createDefaultIcon()}>
            <Popup>
              <div className="text-center">
                <MapPin className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="font-medium">Your Location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hazard Report Markers */}
        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createHazardIcon(report.severity, report.type)}
            eventHandlers={{
              click: () => {
                if (onMarkerClick) {
                  onMarkerClick(report.id);
                }
              }
            }}
          >
            <Popup maxWidth={300}>
              <Card className="border-0 shadow-none">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-sm capitalize">{report.type.replace('_', ' ')}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {getSeverityBadge(report.severity)}
                      {getStatusBadge(report.status)}
                    </div>
                  </div>
                  
                  {report.notes && (
                    <p className="text-sm text-foreground line-clamp-2">{report.notes}</p>
                  )}
                  
                  {report.photo_url && (
                    <img 
                      src={report.photo_url} 
                      alt="Hazard photo" 
                      className="w-full h-24 object-cover rounded-md"
                    />
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Severity: {report.severity}/5</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onMarkerClick) {
                          onMarkerClick(report.id);
                        }
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

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

export default MapView;