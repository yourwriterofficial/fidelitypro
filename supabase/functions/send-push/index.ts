// Edge function: send a Web Push notification to one or more users.
// Payload: { user_ids: string[], title: string, body: string, url?: string, tag?: string, notification_type?: 'info'|'warning'|'success'|'alert' }
//
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY must be set as Supabase Edge Function
// secrets (Dashboard -> Edge Functions -> Secrets, or `supabase secrets set`).
// No hardcoded fallback on purpose: a real private key baked into source is
// permanently readable by anyone with repo access, including in git history.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY must be set as Supabase Edge Function secrets.');
}

const VAPID_SUBJECT       = 'mailto:noreply@remaprofitmachine.com';

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function buildVapidJwt(audience: string): Promise<string> {
  const keyData = base64urlDecode(VAPID_PRIVATE_KEY);
  const privKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  const header  = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const toSign  = `${header}.${payload}`;
  const sig     = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(toSign)
  );
  return `${toSign}.${base64urlEncode(sig)}`;
}

// ── Send one subscription ─────────────────────────────────────────────────────
async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, body: BodyInit) {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/octet-stream',
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Crypto-Key':    `p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body,
  });

  return { ok: res.ok || res.status === 201, gone: res.status === 404 || res.status === 410 };
}

// ── Encrypt payload (Web Push encryption — RFC 8291 / 8188) ──────────────────
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<ArrayBuffer> {
  const receiverKey = await crypto.subtle.importKey(
    'raw', base64urlDecode(p256dhBase64),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  );
  const senderPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeyPair.publicKey));

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, senderKeyPair.privateKey, 256
  );

  const authSecret = base64urlDecode(authBase64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey', 'deriveBits']);

  const receiverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', receiverKey));
  const info = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\x00'),
    ...receiverPubRaw, ...senderPublicRaw,
  ]);
  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info }, prk, 256
  );

  const ikmKey = await crypto.subtle.importKey('raw', ikmBits, 'HKDF', false, ['deriveBits']);

  const cekInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aes128gcm\x00')]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\x00')]);

  const [cekBits, nonceBits] = await Promise.all([
    crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, ikmKey, 128),
    crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, ikmKey, 96),
  ]);

  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const nonce = new Uint8Array(nonceBits);

  const pt = new Uint8Array([...new TextEncoder().encode(payload), 0x02]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, pt));

  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  const dv = new DataView(header.buffer);
  dv.setUint32(16, rs, false);
  header[20] = 65;
  header.set(senderPublicRaw, 21);

  const result = new Uint8Array(header.byteLength + ct.byteLength);
  result.set(header, 0);
  result.set(ct, header.byteLength);
  return result.buffer;
}

// Preference column per notification type (matches notification_preferences table)
const PREF_KEY: Record<string, string> = {
  info:    'push_info',
  warning: 'push_warning',
  success: 'push_success',
  alert:   'push_alert',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { user_ids, title, body, url = '/app', tag = 'rpm', notification_type } = await req.json();

  if (!user_ids?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: cors });

  // Filter users who haven't disabled this notification type (default = enabled), respecting admin locks
  let filteredIds: string[] = [...new Set(user_ids as string[])];
  const prefKey = notification_type ? PREF_KEY[notification_type] : undefined;
  if (prefKey) {
    const [prefsRes, lockRes] = await Promise.all([
      adminClient
        .from('notification_preferences')
        .select(`user_id, ${prefKey}`)
        .in('user_id', filteredIds),
      adminClient
        .from('settings')
        .select('value')
        .eq('key', 'locked_notifications')
        .maybeSingle()
    ]);

    let isLocked = false;
    if (lockRes?.data?.value) {
      try {
        const lockedConfig = JSON.parse(lockRes.data.value);
        isLocked = lockedConfig[prefKey] === true;
      } catch (e) {
        console.error('Failed to parse locked_notifications in edge function:', e);
      }
    }

    if (!isLocked) {
      const disabled = new Set((prefsRes?.data || []).filter((p: any) => p[prefKey] === false).map((p: any) => p.user_id));
      filteredIds = filteredIds.filter(id => !disabled.has(id));
    }
  }

  if (!filteredIds.length) return new Response(JSON.stringify({ sent: 0, skipped: user_ids.length }), { status: 200, headers: cors });

  const { data: subs } = await adminClient
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', filteredIds);

  // Delivery log: lets an admin diagnose "push isn't arriving" from a table
  // instead of re-investigating the whole notification pipeline each time.
  const deliveries: { notification_title: string; user_id: string; channel: string; status: string; error: string | null }[] = [];
  const subscribedUserIds = new Set((subs || []).map((s) => s.user_id));
  for (const id of filteredIds) {
    if (!subscribedUserIds.has(id)) {
      deliveries.push({ notification_title: title, user_id: id, channel: 'push', status: 'no_subscription', error: null });
    }
  }

  if (!subs?.length) {
    if (deliveries.length) await adminClient.from('notification_deliveries').insert(deliveries);
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: cors });
  }

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0;
  const toDelete: string[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      const encBody = await encryptPayload(payload, s.p256dh, s.auth);
      const { ok, gone } = await sendOne({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, encBody);
      if (ok) sent++;
      if (gone) toDelete.push(s.id);
      deliveries.push({
        notification_title: title,
        user_id: s.user_id,
        channel: 'push',
        status: ok ? 'sent' : 'failed',
        error: ok ? null : 'Push service rejected the request',
      });
    } catch (e) {
      console.error('Push send error', e);
      deliveries.push({ notification_title: title, user_id: s.user_id, channel: 'push', status: 'failed', error: String(e) });
    }
  }));

  if (toDelete.length) {
    await adminClient.from('push_subscriptions').delete().in('id', toDelete);
  }

  if (deliveries.length) {
    await adminClient.from('notification_deliveries').insert(deliveries);
  }

  return new Response(JSON.stringify({ sent }), { status: 200, headers: cors });
});
