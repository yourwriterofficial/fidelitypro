// Returns the VAPID public key so the frontend never needs it baked into the build.
// The actual key is stored as a Supabase secret (VAPID_PUBLIC_KEY) — safe to expose, it's public.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  if (!publicKey || publicKey.length !== 87) {
    publicKey = "BA8RM3ej0pbVl5vx_DBKyv7GECKHji3F6oCCbzUjola1Uf0tLuh8nuDqwURDkJ_cgK8zhhNM-kq_-pAkLYtS3Y4";
  }

  return new Response(JSON.stringify({ publicKey }), {
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
