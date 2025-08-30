import { supabase } from '@/integrations/supabase/client';

export interface SampleReport {
  type: string;
  severity: number;
  lat: number;
  lng: number;
  notes: string;
  status: string;
}

export const sampleHazards: SampleReport[] = [
  // Critical hazards (severity 4-5) - Red zones
  {
    type: 'oil_spill',
    severity: 5,
    lat: 37.7749,
    lng: -122.4194,
    notes: 'Major oil spill detected in San Francisco Bay. Immediate cleanup required.',
    status: 'verified'
  },
  {
    type: 'chemical_leak',
    severity: 4,
    lat: 37.7849,
    lng: -122.4094,
    notes: 'Chemical leak from industrial facility. Evacuation recommended.',
    status: 'verified'
  },
  {
    type: 'tsunami_warning',
    severity: 5,
    lat: 37.7649,
    lng: -122.4294,
    notes: 'Tsunami warning issued. Seek higher ground immediately.',
    status: 'pending'
  },

  // High risk hazards (severity 3) - Orange zones
  {
    type: 'strong_currents',
    severity: 3,
    lat: 37.7949,
    lng: -122.3994,
    notes: 'Strong ocean currents detected. Dangerous for swimming and boating.',
    status: 'verified'
  },
  {
    type: 'storm_warning',
    severity: 3,
    lat: 37.7549,
    lng: -122.4394,
    notes: 'Severe storm approaching. High winds and rough seas expected.',
    status: 'pending'
  },
  {
    type: 'debris_field',
    severity: 3,
    lat: 37.8049,
    lng: -122.3894,
    notes: 'Large debris field in shipping lane. Navigation hazard.',
    status: 'verified'
  },

  // Medium risk hazards (severity 2) - Blue zones
  {
    type: 'floating_debris',
    severity: 2,
    lat: 37.8149,
    lng: -122.3794,
    notes: 'Floating debris spotted. Minor navigation concern.',
    status: 'pending'
  },
  {
    type: 'rough_seas',
    severity: 2,
    lat: 37.7449,
    lng: -122.4494,
    notes: 'Rough sea conditions. Exercise caution.',
    status: 'verified'
  },
  {
    type: 'low_visibility',
    severity: 2,
    lat: 37.8249,
    lng: -122.3694,
    notes: 'Fog and low visibility conditions.',
    status: 'pending'
  },

  // Low risk hazards (severity 1) - No zones
  {
    type: 'minor_wave',
    severity: 1,
    lat: 37.8349,
    lng: -122.3594,
    notes: 'Minor wave activity. Normal conditions.',
    status: 'pending'
  },
  {
    type: 'seaweed_patch',
    severity: 1,
    lat: 37.7349,
    lng: -122.4594,
    notes: 'Seaweed patch observed. No immediate danger.',
    status: 'verified'
  }
];

export const addSampleData = async (userId: string) => {
  try {
    const reportsToAdd = sampleHazards.map(hazard => ({
      ...hazard,
      user_id: userId,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('reports')
      .insert(reportsToAdd)
      .select();

    if (error) {
      console.error('Error adding sample data:', error);
      throw error;
    }

    console.log('Sample data added successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to add sample data:', error);
    throw error;
  }
};

export const clearSampleData = async () => {
  try {
    const { error } = await supabase
      .from('reports')
      .delete()
      .in('type', sampleHazards.map(h => h.type));

    if (error) {
      console.error('Error clearing sample data:', error);
      throw error;
    }

    console.log('Sample data cleared successfully');
  } catch (error) {
    console.error('Failed to clear sample data:', error);
    throw error;
  }
};