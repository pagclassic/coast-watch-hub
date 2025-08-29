-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  photo_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'invalid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create report confirmations table
CREATE TABLE public.report_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
CREATE POLICY "Anyone can view reports" ON public.reports
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for confirmations
CREATE POLICY "Anyone can view confirmations" ON public.report_confirmations
  FOR SELECT USING (true);

CREATE POLICY "Users can create confirmations" ON public.report_confirmations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', true);

-- Storage policy for report photos
CREATE POLICY "Anyone can view report photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-photos');

CREATE POLICY "Authenticated users can upload report photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');