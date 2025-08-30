-- Update reports table to include 'flagged' status
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('pending', 'verified', 'invalid', 'flagged'));

-- Create hazard-photos bucket (matching the component)
INSERT INTO storage.buckets (id, name, public) VALUES ('hazard-photos', 'hazard-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hazard photos
CREATE POLICY "Anyone can view hazard photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'hazard-photos');

CREATE POLICY "Authenticated users can upload hazard photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'hazard-photos' AND auth.role() = 'authenticated');