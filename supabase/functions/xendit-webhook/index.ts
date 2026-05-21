// ============================================================
// Edge Function: xendit-webhook
// Handles Xendit payment callbacks and manages escrow state.
// Triggers split payment disbursement when order is completed.
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const XENDIT_WEBHOOK_TOKEN = Deno.env.get('XENDIT_WEBHOOK_VERIFICATION_TOKEN')!;
const XENDIT_SECRET_KEY = Deno.env.get('XENDIT_SECRET_KEY')!;

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify Xendit webhook signature
  const webhookToken = req.headers.get('x-callback-token');
  if (webhookToken !== XENDIT_WEBHOOK_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const payload = await req.json();
    const { event, data } = payload;

    if (event === 'invoice.paid') {
      const orderId = data.external_id;
      const amountPaid = data.amount;

      // Update order status to paid_to_escrow
      const { data: order } = await supabase
        .from('orders')
        .update({
          status: 'paid_to_escrow',
          xendit_invoice_id: data.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select('farmer_id, distributor_id, total_amount, logistics_fee, platform_fee')
        .single();

      if (order) {
        // Notify farmer via database notification
        await supabase.from('notifications').insert({
          user_id: order.farmer_id,
          title: 'Pembayaran Masuk ke Escrow',
          body: `Dana sebesar Rp ${amountPaid.toLocaleString('id-ID')} telah ditahan oleh platform. Siapkan barang untuk pengiriman.`,
          type: 'order_paid',
          reference_id: orderId,
        });
      }
    }

    if (event === 'order.completed') {
      // Triggered when Pengepul taps "Pesanan Diterima"
      const orderId = data.order_id;

      const { data: order } = await supabase
        .from('orders')
        .select('farmer_id, distributor_id, total_amount, logistics_fee, platform_fee')
        .eq('id', orderId)
        .single();

      if (order) {
        const farmerAmount = order.total_amount - order.logistics_fee - order.platform_fee;

        // Xendit xenplatform: split payment disbursement
        // Disburse to Farmer
        await fetch('https://api.xendit.co/disbursements', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(XENDIT_SECRET_KEY + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            external_id: `farmer_payout_${orderId}`,
            amount: farmerAmount,
            bank_code: data.farmer_bank_code,
            account_holder_name: data.farmer_name,
            account_number: data.farmer_account_number,
            description: `Pembayaran panen - Order ${orderId}`,
          }),
        });

        // Disburse to Distributor
        if (order.distributor_id && order.logistics_fee > 0) {
          await fetch('https://api.xendit.co/disbursements', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(XENDIT_SECRET_KEY + ':')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              external_id: `distributor_payout_${orderId}`,
              amount: order.logistics_fee,
              bank_code: data.distributor_bank_code,
              account_holder_name: data.distributor_name,
              account_number: data.distributor_account_number,
              description: `Biaya logistik - Order ${orderId}`,
            }),
          });
        }

        // Update order to completed
        await supabase
          .from('orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Xendit webhook error:', error);
    return new Response(JSON.stringify({ error: 'Kesalahan pemrosesan webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
