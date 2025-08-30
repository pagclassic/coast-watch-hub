import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  AlertTriangle, 
  Calendar,
  User,
  CheckCircle,
  Flag,
  Navigation
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

interface ReportDetailProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string | null;
}

const ReportDetail: React.FC<ReportDetailProps> = ({
  isOpen,
  onClose,
  reportId
}) => {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [confirmations, setConfirmations] = useState<number>(0);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reportId && isOpen) {
      fetchReportDetails();
      fetchConfirmations();
    }
  }, [reportId, isOpen]);

  const fetchReportDetails = async () => {
    if (!reportId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        throw error;
      }

      setReport(data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast({
        title: "Error",
        description: "Failed to load report details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfirmations = async () => {
    if (!reportId || !user) return;

    try {
      // Get total confirmations count
      const { count } = await supabase
        .from('report_confirmations')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', reportId);

      setConfirmations(count || 0);

      // Check if current user has confirmed
      const { data } = await supabase
        .from('report_confirmations')
        .select('id')
        .eq('report_id', reportId)
        .eq('user_id', user.id)
        .single();

      setUserConfirmed(!!data);
    } catch (error) {
      // User hasn't confirmed yet, which is fine
      setUserConfirmed(false);
    }
  };

  const handleConfirm = async () => {
    if (!user || !reportId || userConfirmed) return;

    try {
      const { error } = await supabase
        .from('report_confirmations')
        .insert({
          report_id: reportId,
          user_id: user.id
        });

      if (error) {
        throw error;
      }

      setUserConfirmed(true);
      setConfirmations(prev => prev + 1);
      
      toast({
        title: "Confirmed",
        description: "Thank you for confirming this hazard report!",
      });
    } catch (error) {
      console.error('Error confirming report:', error);
      toast({
        title: "Error",
        description: "Failed to confirm report. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleFlag = async () => {
    if (!reportId) return;

    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'flagged' })
        .eq('id', reportId);

      if (error) {
        throw error;
      }

      toast({
        title: "Report Flagged",
        description: "This report has been flagged for admin review.",
      });

      if (report) {
        setReport({ ...report, status: 'flagged' });
      }
    } catch (error) {
      console.error('Error flagging report:', error);
      toast({
        title: "Error",
        description: "Failed to flag report. Please try again.",
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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Navigation className="w-6 h-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!report) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Report not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Hazard Report Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg capitalize">
                {report.type.replace('_', ' ')}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {getSeverityBadge(report.severity)}
              {getStatusBadge(report.status)}
            </div>
          </div>

          {/* Photo */}
          {report.photo_url && (
            <div>
              <img 
                src={report.photo_url} 
                alt="Hazard photo" 
                className="w-full h-48 object-cover rounded-md"
              />
            </div>
          )}

          {/* Notes */}
          {report.notes && (
            <div>
              <h4 className="font-medium text-sm mb-2">Description</h4>
              <p className="text-sm text-foreground bg-muted/30 p-3 rounded-md">
                {report.notes}
              </p>
            </div>
          )}

          {/* Location */}
          <div>
            <h4 className="font-medium text-sm mb-2">Location</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
              <MapPin className="w-4 h-4" />
              <span>{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
            </div>
          </div>

          {/* Reporter Info */}
          <div>
            <h4 className="font-medium text-sm mb-2">Reporter</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Anonymous User</span>
            </div>
          </div>

          <Separator />

          {/* Confirmations */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                Confirmed by {confirmations} user{confirmations !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleConfirm}
              disabled={userConfirmed}
              className="flex-1"
              variant={userConfirmed ? "secondary" : "default"}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {userConfirmed ? 'Confirmed' : 'Confirm Hazard'}
            </Button>
            <Button
              onClick={handleFlag}
              variant="outline"
              className="flex-1"
              disabled={report.status === 'flagged'}
            >
              <Flag className="w-4 h-4 mr-2" />
              {report.status === 'flagged' ? 'Flagged' : 'Flag Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDetail;