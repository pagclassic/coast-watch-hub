import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/components/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Simple admin check - in production, you'd check user roles/claims
  const isAdmin = user?.email?.includes('admin') || user?.email?.includes('moderator');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access the admin dashboard.
              </p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Admin Dashboard</h1>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Logged in as {user?.email}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <AdminDashboard />
      </main>
    </div>
  );
};

export default Admin;