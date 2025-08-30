import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MapPin,
  Calendar,
  Users,
  TrendingUp
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
  confirmations?: number;
}

interface AdminStats {
  totalReports: number;
  pendingReports: number;
  verifiedReports: number;
  flaggedReports: number;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalReports: 0,
    pendingReports: 0,
    verifiedReports: 0,
    flaggedReports: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          confirmations:report_confirmations(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Process confirmations count
      const reportsWithConfirmations = data?.map(report => ({
        ...report,
        confirmations: report.confirmations?.[0]?.count || 0
      })) || [];

      setReports(reportsWithConfirmations);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('status');

      if (error) {
        throw error;
      }

      const total = data?.length || 0;
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      const verified = data?.filter(r => r.status === 'verified').length || 0;
      const flagged = data?.filter(r => r.status === 'flagged').length || 0;

      setStats({
        totalReports: total,
        pendingReports: pending,
        verifiedReports: verified,
        flaggedReports: flagged
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) {
        throw error;
      }

      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId ? { ...report, status: newStatus } : report
      ));

      // Update stats
      fetchStats();

      toast({
        title: "Status Updated",
        description: `Report marked as ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating report status:', error);
      toast({
        title: "Error",
        description: "Failed to update report status",
        variant: "destructive"
      });
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Shield className="w-8 h-8 animate-pulse text-primary mx-auto" />
            <p className="text-muted-foreground">Loading admin dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage hazard reports and maintain data quality</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Flagged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.flaggedReports}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confirmations</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="capitalize">
                      {report.type.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {getSeverityBadge(report.severity)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="w-3 h-3" />
                        {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(report.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {report.confirmations || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="w-3 h-3" />
                        {formatDate(report.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {report.status !== 'verified' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateReportStatus(report.id, 'verified')}
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        {report.status !== 'invalid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateReportStatus(report.id, 'invalid')}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;