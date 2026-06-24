// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export default async (req: Request) => {
  try {
    const now = new Date().toISOString();

    // Get all active orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'active');

    if (ordersError) throw ordersError;

    let processed = 0;
    for (const order of orders || []) {
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

      // If compounding, we would create a new order here (you can add logic later)
      processed++;
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};