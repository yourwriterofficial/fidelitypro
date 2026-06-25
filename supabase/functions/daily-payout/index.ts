// deno-lint-ignore-file
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// FIX: replaced `export default async (req) =>` with serve() so Supabase
// Deno runtime can bind this function to an HTTP endpoint.
serve(async (_req: Request) => {
  try {
    // Get all active orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'active');

    if (ordersError) throw ordersError;

    let processed = 0;
    for (const order of orders ?? []) {
      const dailyReturn = order.amount * (order.daily_return / 100);

      // Credit wallet
      await supabase.rpc('add_wallet_balance', {
        user_id: order.user_id,
        amount: dailyReturn,
      });

      // Transaction record
      await supabase.from('transactions').insert({
        user_id: order.user_id,
        type: 'return',
        amount: dailyReturn,
        description: `Daily return from ${order.product_name}`,
        status: 'completed',
      });

      processed++;
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
