// supabase/functions/signup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

async function sendWelcomeEmail(to: string, name: string) {
  try {
    const emailBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h1 style="color:#22c55e">Welcome to RPM, ${name}!</h1>
        <p>Your account has been created successfully. You can now log in and start investing.</p>
        <a href="https://remaprofitmachine.com/login"
           style="display:inline-block;background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
          Log In Now
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:14px">
          If you did not create this account, please ignore this email.
        </p>
      </div>
    `;

    // Fetch local send-email function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to,
        subject: "Welcome to RPM!",
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Welcome email failed:", errText);
    } else {
      const data = await res.json();
      console.log(`Welcome email sent to ${to} (via ${data.via})`);
    }
  } catch (err: any) {
    console.error("Welcome email sending error:", err.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { email, password, full_name, ref_code } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "email, password, and full_name are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Create auth user via direct REST call (bypasses AuthRetryableFetchError)
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      }),
    });

    const userData = await createUserRes.json();

    if (!createUserRes.ok) {
      const errorMsg =
        userData.msg ||
        userData.message ||
        userData.error_description ||
        userData.error ||
        `Auth error (${createUserRes.status})`;
      console.error("Create user failed:", errorMsg, JSON.stringify(userData));
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const user = userData;
    if (!user?.id) throw new Error("No user ID returned from auth API");

    // 2. Upsert profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          name: full_name,
          email,
          referral_code: Math.random().toString(36).substring(2, 10),
          wallet_balance: 0,
          is_admin: false,
          banned: false,
          can_withdraw: true,
          can_invest: true,
          can_stake: true,
          can_property: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("Profile upsert error:", profileError.message, profileError.code);
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
      });
      return new Response(
        JSON.stringify({ error: "Failed to create profile: " + (profileError.message || profileError.code) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 3. Process referral
    if (ref_code) {
      const { data: referrer } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", ref_code)
        .maybeSingle();

      if (referrer) {
        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrer.id,
          referee_id: user.id,
          status: "pending",
        });
        await supabaseAdmin
          .from("profiles")
          .update({ referred_by: referrer.id })
          .eq("id", user.id);
      }
    }

    // 4. Send welcome email (non-blocking — failure doesn't break signup)
    await sendWelcomeEmail(email, full_name);

    return new Response(
      JSON.stringify({ user: { id: user.id, email: user.email }, message: "Signup successful" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message || err.name : String(err);
    console.error("Unhandled error:", msg);
    return new Response(
      JSON.stringify({ error: msg || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
