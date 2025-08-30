import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, AlertTriangle, Navigation, Plus, Search, Crosshair, Globe } from 'lucide-react';
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

// Get hazard area color and radius based on severity
const getHazardAreaStyle = (severity: number) => {
  if (severity >= 4) {
    return {
      color: '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: 0.25,
      weight: 3,
      radius: 2000 // 2km radius for critical hazards
    };
  } else if (severity >= 3) {
    return {
      color: '#ea580c',
      fillColor: '#ea580c',
      fillOpacity: 0.2,
      weight: 2,
      radius: 1500 // 1.5km radius for high hazards
    };
  } else {
    return {
      color: '#0ea5e9',
      fillColor: '#0ea5e9',
      fillOpacity: 0.15,
      weight: 1,
      radius: 1000 // 1km radius for medium-low hazards
    };
  }
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
const LocationFinder: React.FC<{ 
  onLocationFound: (lat: number, lng: number) => void;
  mapRef: L.Map | null;
}> = ({ onLocationFound, mapRef }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleLocation = () => {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            try {
              // Only set initial location, don't force re-center
              if (mapRef) {
                // Just update the user location state, don't move the map
                onLocationFound(latitude, longitude);
              } else {
                // Only set initial view if no map ref (first load)
                map.setView([latitude, longitude], 13);
                onLocationFound(latitude, longitude);
              }
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
            // Default to San Francisco Bay - only on first load
            if (!mapRef) {
              try {
                map.setView([37.7749, -122.4194], 10);
              } catch (mapError) {
                console.error('Error setting default map view:', mapError);
              }
            }
            onLocationFound(37.7749, -122.4194);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
        );
      } else {
        // Default to San Francisco Bay - only on first load
        if (!mapRef) {
          try {
            map.setView([37.7749, -122.4194], 10);
          } catch (mapError) {
            console.error('Error setting default map view:', mapError);
          }
        }
        onLocationFound(37.7749, -122.4194);
      }
    };

    // Only run once on initial load
    handleLocation();

    return () => {
      // Cleanup - no continuous updates
    };
  }, [map, onLocationFound, mapRef]); // Only run when map or mapRef changes

  return null;
};

const MapView: React.FC<MapViewProps> = React.memo(({ onReportClick, onMarkerClick, onLocationChange }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHazardAreas, setShowHazardAreas] = useState(true);
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ lat: number; lng: number; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  // Filter reports based on critical filter
  const filteredReports = useMemo(() => {
    return showOnlyCritical 
      ? reports.filter(report => report.severity >= 4)
      : reports;
  }, [reports, showOnlyCritical]);

  // Check for overlapping hazard areas
  const checkOverlappingAreas = useCallback((report: Report) => {
    const reportRadius = getHazardAreaStyle(report.severity).radius;
    const overlapping = reports.filter(otherReport => {
      if (otherReport.id === report.id) return false;
      
      const distance = Math.sqrt(
        Math.pow(report.lat - otherReport.lat, 2) + 
        Math.pow(report.lng - otherReport.lng, 2)
      ) * 111000; // Convert to meters (roughly)
      
      const otherRadius = getHazardAreaStyle(otherReport.severity).radius;
      return distance < (reportRadius + otherRadius);
    });
    
    return overlapping.length > 0;
  }, [reports]);

  // Calculate total affected area
  const calculateTotalAffectedArea = useCallback(() => {
    if (!showHazardAreas) return 0;
    
    let totalArea = 0;
    const processedAreas = new Set<string>();
    
    filteredReports.forEach(report => {
      const radius = getHazardAreaStyle(report.severity).radius;
      const area = Math.PI * Math.pow(radius, 2);
      
      // Check for overlaps with already processed areas
      let overlapArea = 0;
      processedAreas.forEach(processedId => {
        const processedReport = reports.find(r => r.id === processedId);
        if (processedReport) {
          const distance = Math.sqrt(
            Math.pow(report.lat - processedReport.lat, 2) + 
            Math.pow(report.lng - processedReport.lng, 2)
          ) * 111000;
          
          const processedRadius = getHazardAreaStyle(processedReport.severity).radius;
          if (distance < (radius + processedRadius)) {
            // Calculate overlap area (simplified)
            overlapArea += Math.min(area, Math.PI * Math.pow(processedRadius, 2)) * 0.3;
          }
        }
      });
      
      totalArea += area - overlapArea;
      processedAreas.add(report.id);
    });
    
    return totalArea;
  }, [filteredReports, showHazardAreas, reports]);

  // Search for locations using OpenStreetMap Nominatim
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      
      const results = data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name
      }));
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching location:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for location. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search result selection
  const handleSearchResultClick = useCallback((result: { lat: number; lng: number; name: string }) => {
    moveMapTo(result.lat, result.lng, 13);
    setSearchResults([]);
    setSearchQuery('');
    
    toast({
      title: "Location Found",
      description: `Navigating to ${result.name}`,
    });
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Return to user location
  const returnToUserLocation = useCallback(() => {
    if (userLocation && mapRef) {
      mapRef.setView(userLocation, 13);
      toast({
        title: "Location Updated",
        description: "Returned to your current location",
      });
    } else {
      toast({
        title: "Location Unavailable",
        description: "Your location is not available. Please enable location services.",
        variant: "destructive"
      });
    }
  }, [userLocation, mapRef]);

  // Programmatically move map to a new location
  const moveMapTo = useCallback((lat: number, lng: number, zoom: number = 13) => {
    if (mapRef) {
      mapRef.setView([lat, lng], zoom, { animate: true });
    }
  }, [mapRef]);

  // Map ref callback
  const handleMapRef = useCallback((map: L.Map | null) => {
    setMapRef(map);
    if (map) {
      // Ensure all interactions are enabled
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    }
  }, []);


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

  // Check if a location is within reporting distance of user
  const isWithinReportingDistance = (lat: number, lng: number) => {
    if (!userLocation) return false;
    
    const distance = Math.sqrt(
      Math.pow(lat - userLocation[0], 2) + 
      Math.pow(lng - userLocation[1], 2)
    ) * 111000; // Convert to meters
    
    // Allow reporting within 5km of user location
    return distance <= 5000;
  };

  // Get distance from user location
  const getDistanceFromUser = (lat: number, lng: number) => {
    if (!userLocation) return null;
    
    const distance = Math.sqrt(
      Math.pow(lat - userLocation[0], 2) + 
      Math.pow(lng - userLocation[1], 2)
    ) * 111000; // Convert to meters
    
    return distance;
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
      {/* Test Map Interaction Button */}
      <Card className="absolute top-20 left-4 z-20 shadow-lg">
        <CardContent className="p-3">
          <Button
            size="sm"
            onClick={() => {
              if (mapRef) {
                console.log('Test button clicked, current map state:', {
                  center: mapRef.getCenter(),
                  zoom: mapRef.getZoom(),
                  dragging: mapRef.dragging.enabled(),
                  scrollWheelZoom: mapRef.scrollWheelZoom.enabled(),
                  touchZoom: mapRef.touchZoom.enabled()
                });
                
                // Test zoom
                const currentZoom = mapRef.getZoom();
                mapRef.setZoom(currentZoom + 1);
                
                toast({
                  title: "Map Test",
                  description: `Zoomed from ${currentZoom} to ${currentZoom + 1}`,
                });
              } else {
                console.log('Map ref is null');
                toast({
                  title: "Map Error",
                  description: "Map reference is not available",
                  variant: "destructive"
                });
              }
            }}
            className="w-full"
          >
            Test Map Interaction
          </Button>
        </CardContent>
      </Card>

      {/* Search Interface */}
      <Card className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 shadow-lg w-80">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchLocation(searchQuery)}
                className="pl-8 pr-8"
              />
              {searchQuery && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <Crosshair className="w-3 h-3" />
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => searchLocation(searchQuery)}
              disabled={isSearching || !searchQuery.trim()}
              className="px-3"
            >
              {isSearching ? '...' : 'Search'}
            </Button>
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-2 hover:bg-muted rounded cursor-pointer text-sm"
                  onClick={() => handleSearchResultClick(result)}
                >
                  <div className="font-medium truncate">{result.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Container - Fixed for full interactivity */}
      <div 
        id="map-container"
        className="h-full w-full" 
        style={{ 
          position: 'relative',
          zIndex: 1
        }}
      >
        <MapContainer
          key="stable-map"
          center={[37.7749, -122.4194]}
          zoom={10}
          style={{ 
            height: '100%', 
            width: '100%'
          }}
          zoomControl={true}
          minZoom={3}
          maxZoom={18}
          doubleClickZoom={true}
          scrollWheelZoom={true}
          dragging={true}
          touchZoom={true}
          boxZoom={true}
          keyboard={true}
          ref={handleMapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <LocationFinder onLocationFound={handleLocationFound} mapRef={mapRef} />
          
          {/* User Location Marker and Reporting Area */}
          {userLocation && (
            <>
              {/* User's reporting area (5km radius) */}
              <Circle
                center={userLocation}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.1,
                  weight: 2,
                  radius: 5000
                }}
              >
                <Popup>
                  <div className="text-center p-2">
                    <h4 className="font-medium text-sm mb-1">Your Reporting Area</h4>
                    <p className="text-xs text-muted-foreground">
                      You can report hazards within this 5km area
                    </p>
                  </div>
                </Popup>
              </Circle>
              
              {/* User location marker */}
              <Marker position={userLocation} icon={createDefaultIcon()}>
                <Popup>
                  <div className="text-center">
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="font-medium">Your Location</p>
                    <p className="text-xs text-muted-foreground">
                      Report hazards from here
                    </p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Hazard Report Markers */}
          {filteredReports.map((report) => {
            const areaStyle = getHazardAreaStyle(report.severity);
            const isOverlapping = checkOverlappingAreas(report);
            const markerStyle = isOverlapping ? {
              color: '#f59e0b', // Yellow for overlapping
              fillColor: '#f59e0b',
              fillOpacity: 0.3,
              weight: 2,
              radius: 1000 // Smaller radius for overlapping
            } : areaStyle;

            return (
              <React.Fragment key={report.id}>
                {/* Hazard Area Circle */}
                {showHazardAreas && (
                  <Circle
                    center={[report.lat, report.lng]}
                    pathOptions={markerStyle}
                    eventHandlers={{
                      click: () => {
                        if (onMarkerClick) {
                          onMarkerClick(report.id);
                        }
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-center p-2">
                        <h4 className="font-medium text-sm capitalize mb-1">
                          {report.type.replace('_', ' ')} Hazard Area
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Severity: {report.severity}/5
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Radius: {(markerStyle.radius / 1000).toFixed(1)}km
                        </p>
                      </div>
                    </Popup>
                  </Circle>
                )}
                <Marker
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
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Severity: {report.severity}/5</span>
                            </div>
                            {userLocation && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span>
                                  {getDistanceFromUser(report.lat, report.lng)?.toFixed(1)}km away
                                </span>
                                {isWithinReportingDistance(report.lat, report.lng) && (
                                  <Badge variant="outline" className="text-xs">Nearby</Badge>
                                )}
                              </div>
                            )}
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
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Hazard Summary Card */}
      <Card className="absolute top-4 right-4 z-10 shadow-lg">
        <CardContent className="p-3">
          <h4 className="font-medium text-sm mb-2">Hazard Summary</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-red-600 font-medium">Critical:</span>
              <Badge variant="destructive" className="text-xs">
                {reports.filter(r => r.severity >= 4).length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-orange-500 font-medium">High:</span>
              <Badge className="bg-orange-500 text-white text-xs">
                {reports.filter(r => r.severity === 3).length}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-500 font-medium">Medium-Low:</span>
              <Badge variant="secondary" className="text-xs">
                {reports.filter(r => r.severity <= 2).length}
              </Badge>
            </div>
            {showHazardAreas && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Area:</span>
                  <span className="text-xs">
                    {(calculateTotalAffectedArea() / 1000000).toFixed(1)} km²
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Location Indicator */}
      {userLocation && (
        <Card className="absolute bottom-6 left-6 z-20 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-xs">
                <div className="font-medium text-green-600">Your Location</div>
                <div className="text-muted-foreground">
                  {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Report Button */}
      {onReportClick && (
        <div className="absolute bottom-6 right-6 z-20">
          <Button
            onClick={onReportClick}
            size="lg"
            className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 shadow-lg"
            title="Report Hazard (Only from your current location)"
          >
            <Plus className="w-6 h-6" />
          </Button>
          {userLocation && (
            <div className="mt-2 text-xs text-center text-muted-foreground bg-background/80 px-2 py-1 rounded">
              Report from your location only
            </div>
          )}
        </div>
      )}

      {/* Map Legend */}
      <Card className="absolute top-4 left-4 z-10 shadow-lg">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Hazard Severity & Areas</h4>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={showOnlyCritical ? "default" : "outline"}
                onClick={() => setShowOnlyCritical(!showOnlyCritical)}
                className="h-6 text-xs"
              >
                {showOnlyCritical ? "All" : "Critical Only"}
              </Button>
              <Button
                size="sm"
                variant={showHazardAreas ? "default" : "outline"}
                onClick={() => setShowHazardAreas(!showHazardAreas)}
                className="h-6 text-xs"
              >
                {showHazardAreas ? "Hide" : "Show"} Areas
              </Button>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600"></div>
                <span>Critical (4-5)</span>
              </div>
              <div className="ml-5 text-xs text-muted-foreground">2km radius area</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>High (3)</span>
              </div>
              <div className="ml-5 text-xs text-muted-foreground">1.5km radius area</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Medium-Low (1-2)</span>
              </div>
              <div className="ml-5 text-xs text-muted-foreground">1km radius area</div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span>Overlapping Areas</span>
              </div>
              <div className="ml-5 text-xs text-muted-foreground">Multiple hazards nearby</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Controls */}
      <Card className="absolute bottom-20 left-4 z-10 shadow-lg">
        <CardContent className="p-2">
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={returnToUserLocation}
              className="h-8 w-8 p-0"
              title="Return to your location"
            >
              <Crosshair className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                moveMapTo(37.7749, -122.4194, 10);
                toast({
                  title: "Map Reset",
                  description: "Returned to San Francisco Bay area",
                });
              }}
              className="h-8 w-8 p-0"
              title="Reset to default area"
            >
              <Globe className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Location Info */}
      <Card className="absolute bottom-4 left-4 z-10 shadow-lg">
        <CardContent className="p-2">
          <div className="text-xs text-muted-foreground">
            <div>Center: {mapRef?.getCenter().lat.toFixed(4)}, {mapRef?.getCenter().lng.toFixed(4)}</div>
            <div>Zoom: {mapRef?.getZoom()}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default MapView;