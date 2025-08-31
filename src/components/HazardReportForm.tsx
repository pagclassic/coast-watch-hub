import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, AlertTriangle, Camera, Upload, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface HazardReportFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HazardReportForm({ isOpen, onClose }: HazardReportFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    severity: '1',
    description: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    images: [] as File[]
  });

  // Mobile-friendly form state
  const [currentStep, setCurrentStep] = useState(1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const hazardTypes = [
    { value: 'rip_current', label: 'Rip Current', icon: '🌊' },
    { value: 'jellyfish', label: 'Jellyfish', icon: '🪼' },
    { value: 'shark_sighting', label: 'Shark Sighting', icon: '🦈' },
    { value: 'pollution', label: 'Pollution', icon: '🚯' },
    { value: 'rough_water', label: 'Rough Water', icon: '🌊' },
    { value: 'other', label: 'Other', icon: '⚠️' }
  ];

  const severityLevels = [
    { value: '1', label: 'Low', color: 'bg-green-500' },
    { value: '2', label: 'Medium', color: 'bg-yellow-500' },
    { value: '3', label: 'High', color: 'bg-orange-500' },
    { value: '4', label: 'Critical', color: 'bg-red-500' },
    { value: '5', label: 'Emergency', color: 'bg-red-700' }
  ];

  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude
        }));
        
        // Reverse geocode to get address
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(response => response.json())
          .then(data => {
            if (data.display_name) {
              setFormData(prev => ({
                ...prev,
                location: data.display_name.split(',').slice(0, 3).join(',')
              }));
            }
          })
          .catch(() => {
            // If reverse geocoding fails, use coordinates
            setFormData(prev => ({
              ...prev,
              location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            }));
          })
          .finally(() => setLoading(false));
      },
      (error) => {
        setLoading(false);
        toast({
          title: "Location error",
          description: "Unable to get your location. Please enter manually.",
          variant: "destructive"
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report hazards.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.type || !formData.description || !formData.location) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          type: formData.type,
          severity: parseInt(formData.severity),
          description: formData.description,
          location: formData.location,
          latitude: formData.latitude,
          longitude: formData.longitude,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Hazard reported successfully!",
        description: "Thank you for keeping our community safe.",
      });

      // Reset form
      setFormData({
        type: '',
        severity: '1',
        description: '',
        location: '',
        latitude: null,
        longitude: null,
        images: []
      });
      setCurrentStep(1);
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error submitting report",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
    );

    if (validFiles.length !== files.length) {
      toast({
        title: "Invalid files",
        description: "Please select valid image files under 5MB.",
        variant: "destructive"
      });
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles]
    }));
  };

  // Remove image
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Next step
  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  // Previous step
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Auto-get location on mount
  useEffect(() => {
    if (isOpen && !formData.latitude) {
      getCurrentLocation();
    }
  }, [isOpen, getCurrentLocation, formData.latitude]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Mobile Header */}
        <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Report Hazard</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 bg-muted/30">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-8 h-1 mx-2 ${
                    step < currentStep ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Step 1: Hazard Type & Severity */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Hazard Type *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {hazardTypes.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={formData.type === type.value ? "default" : "outline"}
                      className="h-16 flex-col gap-1 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                    >
                      <span className="text-lg">{type.icon}</span>
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Severity Level *</Label>
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {severityLevels.map((level) => (
                    <Button
                      key={level.value}
                      type="button"
                      variant={formData.severity === level.value ? "default" : "outline"}
                      className="flex-shrink-0 px-4 py-2"
                      onClick={() => setFormData(prev => ({ ...prev, severity: level.value }))}
                    >
                      <div className={`w-3 h-3 rounded-full ${level.color} mr-2`} />
                      {level.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the hazard in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-2 min-h-[100px] resize-none"
                  maxLength={500}
                />
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {formData.description.length}/500
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Add Photos (Optional)</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tap to upload images</span>
                  </label>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.images.map((image, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Upload ${index + 1}`}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <span className="text-sm flex-1 truncate">{image.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeImage(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Location *</Label>
                <div className="mt-2 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={getCurrentLocation}
                    disabled={loading}
                  >
                    <MapPin className="w-4 h-4" />
                    {loading ? 'Getting location...' : 'Use current location'}
                  </Button>
                  
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter location manually..."
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="text-sm"
                    />
                    {formData.latitude && formData.longitude && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        Coordinates: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Important:</p>
                    <ul className="space-y-1">
                      <li>• Only report hazards at your current location</li>
                      <li>• Provide accurate and detailed descriptions</li>
                      <li>• Emergency situations: Call 911 immediately</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2 pt-4">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="flex-1"
              >
                Back
              </Button>
            )}
            
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="flex-1"
                disabled={
                  (currentStep === 1 && !formData.type) ||
                  (currentStep === 2 && !formData.description)
                }
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading || !formData.location}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}