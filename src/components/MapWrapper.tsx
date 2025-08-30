import React, { useState, useEffect } from 'react';
import { Navigation } from 'lucide-react';

// Dynamic import to avoid SSR issues
const MapView = React.lazy(() => import('./MapView'));

interface MapWrapperProps {
  onReportClick?: () => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ onReportClick }) => {
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
    <React.Suspense 
      fallback={
        <div className="h-full flex items-center justify-center bg-muted/10">
          <div className="text-center space-y-4">
            <Navigation className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      }
    >
      <MapView onReportClick={onReportClick} />
    </React.Suspense>
  );
};

export default MapWrapper;