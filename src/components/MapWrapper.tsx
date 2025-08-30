import React, { useState, useEffect } from 'react';
import { Navigation } from 'lucide-react';
import MapView from './MapView';

interface MapWrapperProps {
  onReportClick?: () => void;
  onMarkerClick?: (reportId: string) => void;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ onReportClick, onMarkerClick, onLocationChange }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
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
    <MapView 
      onReportClick={onReportClick} 
      onMarkerClick={onMarkerClick} 
      onLocationChange={onLocationChange}
    />
  );
};

export default MapWrapper;