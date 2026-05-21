// ============================================================
// Edge Function: location-tracker
// Receives GPS coordinates from Distributor app,
// applies 50-meter threshold filter to prevent DB bloat,
// then broadcasts via Supabase Realtime.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MINIMUM_DISTANCE_METERS = 50;

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { order_id, distributor_id, latitude, longitude, accuracy, speed, heading } =
      await req.json();

    if (!order_id || !distributor_id || latitude === undefined || longitude === undefined) {
      return new Response(JSON.stringify({ error: 'Parameter tidak lengkap' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newPoint = `SRID=4326;POINT(${longitude} ${latitude})`;

    // Fetch last known location from distributor_profiles
    const { data: profile } = await supabase
      .from('distributor_profiles')
      .select('current_location, last_location_update')
      .eq('user_id', distributor_id)
      .single();

    if (profile?.current_location) {
      // Use PostGIS ST_DistanceSphere to compute distance from last position
      const { data: distanceData } = await supabase.rpc('calculate_distance_meters', {
        point_a: profile.current_location,
        point_b: newPoint,
      });

      const distanceMeters = distanceData as number;

      // Anti-spam: skip update if distributor hasn't moved enough
      if (distanceMeters < MINIMUM_DISTANCE_METERS) {
        return new Response(
          JSON.stringify({
            skipped: true,
            message: `Lokasi belum berubah signifikan (${distanceMeters.toFixed(1)}m < ${MINIMUM_DISTANCE_METERS}m)`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update distributor's current location
    await supabase
      .from('distributor_profiles')
      .update({
        current_location: newPoint,
        last_location_update: new Date().toISOString(),
      })
      .eq('user_id', distributor_id);

    // Insert breadcrumb into location_tracking table
    await supabase.from('location_tracking').insert({
      order_id,
      distributor_id,
      location: newPoint,
      accuracy,
      speed,
      heading,
    });

    // Broadcast via Supabase Realtime to Petani & Pengepul watching this order
    await supabase.channel(`order-tracking-${order_id}`).send({
      type: 'broadcast',
      event: 'location_update',
      payload: {
        distributor_id,
        latitude,
        longitude,
        speed,
        heading,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Location tracker error:', error);
    return new Response(JSON.stringify({ error: 'Kesalahan server internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
