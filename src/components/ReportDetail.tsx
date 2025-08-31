import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [userFlagged, setUserFlagged] = useState(false);
  const [confirmations, setConfirmations] = useState(0);
  const [flags, setFlags] = useState(0);
  const { user } = useAuth();

  // Check if user has already confirmed or flagged this report
  const checkUserActions = useCallback(async () => {
    if (!user || !reportId) return;

    try {
      const { data: confirmationsData } = await supabase
        .from('report_confirmations')
        .select('*')
        .eq('report_id', reportId)
        .eq('user_id', user.id);

      if (confirmationsData) {
        const userConfirm = confirmationsData.find(c => c.confirmation_type === 'confirm');
        const userFlag = confirmationsData.find(c => c.confirmation_type === 'flag');
        
        setUserConfirmed(!!userConfirm);
        setUserFlagged(!!userFlag);
      }

      // Get total counts
      const { count: confirmCount } = await supabase
        .from('report_confirmations')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('confirmation_type', 'confirm');

      const { count: flagCount } = await supabase
        .from('report_confirmations')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('confirmation_type', 'flag');

      setConfirmations(confirmCount || 0);
      setFlags(flagCount || 0);
    } catch (error) {
      console.error('Error checking user actions:', error);
    }
  }, [user, reportId]);

  // Fetch report details
  const fetchReport = useCallback(async () => {
    if (!reportId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        throw error;
      }

      setReport(data);
      
      // Check user actions after fetching report
      await checkUserActions();
    } catch (error) {
      console.error('Error fetching report:', error);
      toast({
        title: "Error",
        description: "Failed to load report details.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [reportId, checkUserActions]);

  useEffect(() => {
    if (reportId && isOpen) {
      fetchReport();
    }
  }, [reportId, isOpen, fetchReport]);

  const handleFlag = async () => {
    if (!reportId) return;

    try {
      // First, add a confirmation record
      const { error: confirmationError } = await supabase
        .from('report_confirmations')
        .insert({
          report_id: reportId,
          user_id: user?.id,
          confirmation_type: 'flag'
        });

      if (confirmationError) {
        console.error('Error adding confirmation:', confirmationError);
        // Continue anyway, the main update is more important
      }

      // Update the report status
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
      
      // More specific error messages
      let errorMessage = "Failed to flag report. Please try again.";
      
      if (error?.code === '23505') {
        errorMessage = "You have already flagged this report.";
      } else if (error?.code === '42501') {
        errorMessage = "You don't have permission to flag this report.";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleConfirm = async () => {
    if (!reportId) return;

    try {
      // Add confirmation record
      const { error: confirmationError } = await supabase
        .from('report_confirmations')
        .insert({
          report_id: reportId,
          user_id: user?.id,
          confirmation_type: 'confirm'
        });

      if (confirmationError) {
        // Check if user already confirmed
        if (confirmationError.code === '23505') {
          toast({
            title: "Already Confirmed",
            description: "You have already confirmed this report.",
          });
          return;
        }
        throw confirmationError;
      }

      toast({
        title: "Report Confirmed",
        description: "Thank you for confirming this hazard report.",
      });

      // Refresh the report to show updated confirmation count
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error confirming report:', error);
      toast({
        title: "Error",
        description: "Failed to confirm report. Please try again.",
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
          <DialogDescription>
            Review this hazard report and help verify its accuracy.
          </DialogDescription>
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
          <div className="flex gap-2">
            <Button
              onClick={handleConfirm}
              disabled={userConfirmed}
              variant={userConfirmed ? "secondary" : "default"}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {userConfirmed ? 'Confirmed' : 'Confirm'} 
              {confirmations > 0 && ` (${confirmations})`}
            </Button>
            
            <Button
              onClick={handleFlag}
              disabled={userFlagged}
              variant={userFlagged ? "secondary" : "outline"}
              className="flex-1"
            >
              <Flag className="w-4 h-4 mr-2" />
              {userFlagged ? 'Flagged' : 'Flag'} 
              {flags > 0 && ` (${flags})`}
            </Button>
          </div>

          {/* Community Status */}
          {(confirmations > 0 || flags > 0) && (
            <div className="bg-muted/30 p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Community Response</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>{confirmations} confirmation{confirmations !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-yellow-600" />
                  <span>{flags} flag{flags !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDetail;