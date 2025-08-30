import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  MapPin, 
  AlertTriangle, 
  Camera,
  Navigation,
  X,
  Crosshair
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { savePendingReport, isOnline } from '@/lib/offline-storage';

const reportSchema = z.object({
  type: z.string().min(1, 'Please select a hazard type'),
  severity: z.number().min(1).max(5),
  lat: z.number(),
  lng: z.number(),
  notes: z.string().optional(),
  photo: z.any().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface HazardReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: { lat: number; lng: number };
}

const hazardTypes = [
  { value: 'rip_current', label: 'Rip Current' },
  { value: 'debris', label: 'Debris' },
  { value: 'jellyfish', label: 'Jellyfish' },
  { value: 'oil_slick', label: 'Oil Slick' },
  { value: 'shallow_water', label: 'Shallow Water' },
  { value: 'strong_current', label: 'Strong Current' },
  { value: 'weather', label: 'Severe Weather' },
  { value: 'pollution', label: 'Water Pollution' },
  { value: 'wildlife', label: 'Dangerous Wildlife' },
  { value: 'other', label: 'Other' },
];

const severityLabels = {
  1: 'Very Low',
  2: 'Low', 
  3: 'Medium',
  4: 'High',
  5: 'Critical'
};

const HazardReportForm: React.FC<HazardReportFormProps> = ({
  isOpen,
  onClose,
  initialLocation
}) => {
  console.log('HazardReportForm render - isOpen:', isOpen); // Debug log
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      severity: 3,
      lat: initialLocation?.lat || 37.7749,
      lng: initialLocation?.lng || -122.4194,
    },
  });

  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
      form.setValue('lat', initialLocation.lat);
      form.setValue('lng', initialLocation.lng);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLocation({ lat, lng });
          form.setValue('lat', lat);
          form.setValue('lng', lng);
        },
        (error) => {
          console.error('Error getting location:', error);
          const defaultLoc = { lat: 37.7749, lng: -122.4194 };
          setCurrentLocation(defaultLoc);
          form.setValue('lat', defaultLoc.lat);
          form.setValue('lng', defaultLoc.lng);
        }
      );
    }
  }, [initialLocation, form]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLocation({ lat, lng });
          form.setValue('lat', lat);
          form.setValue('lng', lng);
          toast({
            title: "Location Updated",
            description: "Current location has been set successfully!",
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Location Error",
            description: "Could not get your current location.",
            variant: "destructive"
          });
        }
      );
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `hazard-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('hazard-photos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('hazard-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload photo. Report will be saved without photo.",
        variant: "destructive"
      });
      return null;
    }
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to report hazards",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if online
      if (!isOnline()) {
        // Save to localStorage for later sync
        const pendingId = savePendingReport({
          type: data.type,
          severity: data.severity,
          lat: data.lat,
          lng: data.lng,
          notes: data.notes,
          photo: photoFile || undefined
        });

        if (pendingId) {
          toast({
            title: "Report Saved Offline",
            description: "Your report will be submitted when you're back online.",
          });
          onClose();
          form.reset();
          setPhotoFile(null);
          setPhotoPreview(null);
        } else {
          throw new Error('Failed to save offline report');
        }
        return;
      }

      let photoUrl = null;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const { error } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          type: data.type,
          severity: data.severity,
          lat: data.lat,
          lng: data.lng,
          notes: data.notes || null,
          photo_url: photoUrl,
          status: 'pending'
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Report Submitted",
        description: "Your hazard report has been submitted successfully!",
      });

      onClose();
      form.reset();
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      
      // If online but failed, offer to save offline
      if (isOnline()) {
        toast({
          title: "Submission Error",
          description: "Failed to submit report. Please try again.",
          variant: "destructive"
        });
      } else {
        // Save offline as fallback
        const pendingId = savePendingReport({
          type: data.type,
          severity: data.severity,
          lat: data.lat,
          lng: data.lng,
          notes: data.notes,
          photo: photoFile || undefined
        });

        if (pendingId) {
          toast({
            title: "Saved Offline",
            description: "Report saved offline and will sync when connection is restored.",
          });
          onClose();
          form.reset();
          setPhotoFile(null);
          setPhotoPreview(null);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return 'text-red-600';
    if (severity >= 3) return 'text-orange-500';
    return 'text-blue-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Report Marine Hazard
          </DialogTitle>
          <DialogDescription>
            Help keep our waters safe by reporting marine hazards you encounter.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Hazard Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hazard Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select hazard type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hazardTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Severity Slider */}
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Severity Level</span>
                    <Badge className={getSeverityColor(field.value)}>
                      {severityLabels[field.value as keyof typeof severityLabels]}
                    </Badge>
                  </FormLabel>
                  <FormControl>
                    <div className="px-3">
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>Critical</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photo Upload */}
            <div className="space-y-2">
              <FormLabel>Photo (Optional)</FormLabel>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload">
                  <Button type="button" variant="outline" className="cursor-pointer" asChild>
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Choose Photo
                    </div>
                  </Button>
                </label>
                {photoFile && (
                  <span className="text-sm text-muted-foreground">{photoFile.name}</span>
                )}
              </div>
              {photoPreview && (
                <div className="relative w-32 h-32">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-md"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-3">
              <FormLabel>Location</FormLabel>
              
              {/* Current Location Button */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  className="flex items-center gap-2"
                >
                  <Crosshair className="w-4 h-4" />
                  Use Current Location
                </Button>
                {currentLocation && (
                  <div className="text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                  </div>
                )}
              </div>

              {/* Manual Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="37.7749"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                              field.onChange(value);
                              setCurrentLocation(prev => ({ ...prev!, lat: value }));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lng"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="-122.4194"
                          {...field}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                              field.onChange(value);
                              setCurrentLocation(prev => ({ ...prev!, lng: value }));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the hazard in more detail..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Navigation className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default HazardReportForm;