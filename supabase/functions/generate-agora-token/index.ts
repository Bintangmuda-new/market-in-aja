// ============================================================
// Edge Function: generate-agora-token
// Generates temporary RTC tokens for secure Agora video calls.
// Tokens expire after 3600 seconds (1 hour).
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID')!;
const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token autentikasi diperlukan' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (!user) {
      return new Response(JSON.stringify({ error: 'Pengguna tidak terautentikasi' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify user is approved
    const { data: profile } = await supabase
      .from('users')
      .select('status')
      .eq('id', user.id)
      .single();

    if (profile?.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Akun belum diverifikasi oleh admin' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { channel_name, uid } = await req.json();

    if (!channel_name || !uid) {
      return new Response(JSON.stringify({ error: 'channel_name dan uid diperlukan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build Agora RTC token using Agora Token Builder
    // In production: use the official @agora-io/token-builder library
    const privilegeExpireTime = Math.floor(Date.now() / 1000) + 3600;
    
    // Placeholder: replace with actual Agora token generation logic
    // import { RtcTokenBuilder, RtcRole } from '@agora-io/token-builder';
    // const token = RtcTokenBuilder.buildTokenWithUid(
    //   AGORA_APP_ID, AGORA_APP_CERTIFICATE, channel_name,
    //   uid, RtcRole.PUBLISHER, privilegeExpireTime
    // );
    const token = `agora_token_${channel_name}_${uid}_${privilegeExpireTime}`;

    return new Response(
      JSON.stringify({
        token,
        app_id: AGORA_APP_ID,
        channel: channel_name,
        uid,
        expires_at: privilegeExpireTime,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Token generation error:', error);
    return new Response(JSON.stringify({ error: 'Gagal membuat token panggilan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
