import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MapWrapper from '@/components/MapWrapper';
import HazardReportForm from '@/components/HazardReportForm';
import ReportDetail from '@/components/ReportDetail';
import HazardFeed from '@/components/HazardFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LogOut, 
  Plus, 
  Waves, 
  AlertTriangle, 
  Users, 
  Navigation,
  Menu,
  X,
  List,
  Map,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import ErrorBoundary from '@/components/ErrorBoundary';

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pendingReportsCount } = useOfflineSync();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTab, setActiveTab] = useState('map');

  const handleSignOut = async () => {
    await signOut();
  };

  const handleReportClick = () => {
    setShowReportForm(true);
  };

  const handleReportDetailClick = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleCloseReportForm = () => {
    setShowReportForm(false);
  };

  const handleCloseReportDetail = () => {
    setSelectedReportId(null);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-soft z-20 relative">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="md:hidden"
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Waves className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Ocean Safety</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Marine Hazard Reporting</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="w-4 h-4" />
              <span>Welcome, {user?.email?.split('@')[0]}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Sidebar - Mobile Overlay & Desktop Side Panel */}
        <div className={`
          fixed md:relative inset-y-0 left-0 
          w-80 bg-card border-r border-border shadow-elevated
          transform transition-transform duration-300 ease-in-out
          z-30 md:z-10
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${showSidebar ? 'md:block' : 'hidden md:block'}
        `}>
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground mb-1">Dashboard</h2>
              <p className="text-sm text-muted-foreground">Monitor marine hazards in real-time</p>
            </div>

            {/* Stats Cards */}
            <div className="p-4 space-y-4">
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Active Hazards
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold text-foreground">12</div>
                  <p className="text-xs text-muted-foreground">In your area</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-secondary/20 to-accent/20 border-secondary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Community Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold text-foreground">48</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground mb-2">Quick Actions</h3>
              
              <Button 
                onClick={handleReportClick}
                className="w-full justify-start gap-3 ocean-glow ripple"
              >
                <Plus className="w-4 h-4" />
                Report New Hazard
                {pendingReportsCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {pendingReportsCount} pending
                  </Badge>
                )}
              </Button>

              <Button 
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => setActiveTab('feed')}
              >
                <List className="w-4 h-4" />
                View All Reports
              </Button>

              {/* Admin Dashboard Link - only show for admin users */}
              {(user?.email?.includes('admin') || user?.email?.includes('moderator')) && (
                <Button 
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Button>
              )}
            </div>

            {/* Recent Activity */}
            <div className="p-4 flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-foreground mb-3">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Oil Spill Reported</p>
                    <p className="text-xs text-muted-foreground">Marina District • 2 hours ago</p>
                    <Badge variant="destructive" className="mt-1 text-xs">Critical</Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Strong Currents</p>
                    <p className="text-xs text-muted-foreground">Bay Bridge Area • 4 hours ago</p>
                    <Badge className="mt-1 text-xs bg-warning text-warning-foreground">High</Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Debris Spotted</p>
                    <p className="text-xs text-muted-foreground">Golden Gate • 6 hours ago</p>
                    <Badge variant="secondary" className="mt-1 text-xs">Medium</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-20 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 relative">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-4 py-2">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <Map className="w-4 h-4" />
                  Map View
                </TabsTrigger>
                <TabsTrigger value="feed" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Feed
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="map" className="flex-1 m-0">
              <ErrorBoundary>
                <MapWrapper 
                  onReportClick={handleReportClick}
                  onMarkerClick={handleReportDetailClick}
                  onLocationChange={setUserLocation}
                />
              </ErrorBoundary>
            </TabsContent>
            
            <TabsContent value="feed" className="flex-1 m-0">
              <HazardFeed 
                userLocation={userLocation}
                onReportClick={handleReportDetailClick}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <HazardReportForm
        isOpen={showReportForm}
        onClose={handleCloseReportForm}
        initialLocation={userLocation}
      />

      <ReportDetail
        isOpen={!!selectedReportId}
        onClose={handleCloseReportDetail}
        reportId={selectedReportId}
      />
    </div>
  );
};

export default Index;
