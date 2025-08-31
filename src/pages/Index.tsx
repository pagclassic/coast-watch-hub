import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MapWrapper from '@/components/MapWrapper';
import { HazardReportForm } from '@/components/HazardReportForm';
import HazardFeed from '@/components/HazardFeed';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Map, 
  List, 
  Shield, 
  Activity, 
  Users, 
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';

export default function Index() {
  const [showReportForm, setShowReportForm] = useState(false);
  const [activeTab, setActiveTab] = useState('map');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch user role
  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }
      
      setUserRole(data?.role || 'user');
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  // Fetch reports
  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching reports:', error);
        return;
      }
      
      setReports(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
  };

  // Get stats
  const getStats = () => {
    const activeHazards = reports.filter(r => r.status !== 'resolved').length;
    const communityReports = reports.length;
    const recentActivity = reports.filter(r => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return new Date(r.created_at) > oneDayAgo;
    }).length;
    
    return { activeHazards, communityReports, recentActivity };
  };

  // Handle report click
  const handleReportClick = () => {
    setShowReportForm(true);
  };

  // Handle report detail click
  const handleReportDetailClick = (report) => {
    // Handle report detail view
    console.log('Report clicked:', report);
  };

  // Handle mobile menu toggle
  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  // Handle mobile menu close
  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  // Handle menu item click
  const handleMenuItemClick = (action: () => void) => {
    action();
    closeMobileMenu();
  };

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showMobileMenu) {
        closeMobileMenu();
      }
    };

    if (showMobileMenu) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [showMobileMenu]);

  useEffect(() => {
    if (user) {
      fetchUserRole();
      fetchReports();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden bg-primary text-primary-foreground p-4 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Ocean Safety</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50 mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop - click to close */}
          <div 
            className="absolute inset-0 mobile-menu-backdrop"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          
          {/* Menu Panel */}
          <div 
            className="absolute right-0 top-0 h-full w-64 bg-background shadow-lg p-4 z-10 mobile-menu-panel mobile-menu-shadow mobile-menu-rounded mobile-menu-transition"
            role="navigation"
            aria-label="Main navigation"
            style={{
              transform: showMobileMenu ? 'translateX(0)' : 'translateX(100%)'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeMobileMenu}
                className="hover:bg-muted mobile-menu-button"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3 mobile-menu-content">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 mobile-menu-item mobile-menu-transition-fast"
                onClick={() => handleMenuItemClick(() => setActiveTab('map'))}
                aria-label="Switch to map view"
              >
                <Map className="w-4 h-4" />
                Map View
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3 mobile-menu-item mobile-menu-transition-fast"
                onClick={() => handleMenuItemClick(() => setActiveTab('feed'))}
                aria-label="Switch to list view"
              >
                <List className="w-4 h-4" />
                List View
              </Button>

              {userRole === 'admin' && (
                <Button 
                  variant="outline"
                  className="w-full justify-start gap-3 mobile-menu-item mobile-menu-transition-fast"
                  onClick={() => handleMenuItemClick(() => navigate('/admin'))}
                  aria-label="Access admin dashboard"
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden lg:block bg-primary text-primary-foreground p-6 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Ocean Safety Dashboard</h1>
          <p className="text-primary-foreground/80 mt-2">
            Monitor and report ocean hazards in real-time
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Mobile Stats Cards */}
        <div className="lg:hidden grid grid-cols-2 gap-3 mb-4">
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-primary">
                {loading ? '...' : getStats().activeHazards}
              </div>
              <p className="text-xs text-muted-foreground">Active Hazards</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-3">
              <div className="text-lg font-bold text-primary">
                {loading ? '...' : getStats().communityReports}
              </div>
              <p className="text-xs text-muted-foreground">Reports</p>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Stats Cards */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Hazards</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">
                {loading ? '...' : getStats().activeHazards}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : 'Currently active'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Community Reports</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">
                {loading ? '...' : getStats().communityReports}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : 'Total reports'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-foreground">
                {loading ? '...' : getStats().recentActivity}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Loading...' : 'Last 24 hours'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Access</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              {userRole === 'admin' ? (
                <Button 
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  User access only
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mobile View Toggle */}
        <div className="lg:hidden flex gap-2 mb-4">
          <Button
            variant={activeTab === 'map' ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab('map')}
            className="flex-1"
          >
            <Map className="w-4 h-4 mr-2" />
            Map
          </Button>
          <Button
            variant={!activeTab === 'feed' ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab('feed')}
            className="flex-1"
          >
            <List className="w-4 h-4 mr-2" />
            List
          </Button>
        </div>

        {/* Mobile Report Button */}
        <div className="lg:hidden mb-4">
          <Button
            onClick={handleReportClick}
            className="w-full h-12 text-lg font-semibold"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Report Hazard
            {pendingReportsCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {pendingReportsCount} pending
              </Badge>
            )}
          </Button>
        </div>

        {/* Desktop Report Button */}
        <div className="hidden lg:block mb-6">
          <Button
            onClick={handleReportClick}
            size="lg"
            className="h-12 px-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Report New Hazard
            {pendingReportsCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {pendingReportsCount} pending
              </Badge>
            )}
          </Button>
        </div>

        {/* Main Content */}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Live Hazard Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px] lg:h-[600px] w-full">
                  <MapWrapper />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="feed" className="flex-1 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Recent Hazards
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HazardFeed />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile-First Report Form */}
      <HazardReportForm
        isOpen={showReportForm}
        onClose={() => setShowReportForm(false)}
      />
    </div>
  );
}
