const { webcrypto } = require('crypto');

// Fallback VAPID keys (same as send-push edge function)
const VAPID_PUBLIC_KEY = 'BA8RM3ej0pbVl5vx_DBKyv7GECKHji3F6oCCbzUjola1Uf0tLuh8nuDqwURDkJ_cgK8zhhNM-kq_-pAkLYtS3Y4';
const VAPID_PRIVATE_KEY = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8LRAd6aBCe4TBl561gE5dvTYdanVgaWL-wj8wGmN83GhRANCAAQPETN3o9KW1Zeb8fwwSsr-xhAih44txeqAgm81I6JWtVH9LS7ofJ7g6sFEQ5Cf3ICvM4YTTPpKv_qQJC2LUt2O';
const VAPID_SUBJECT = 'mailto:noreply@remaprofitmachine.com';

function base64urlEncode(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function buildVapidJwt(audience) {
  const keyData = base64urlDecode(VAPID_PRIVATE_KEY);
  const privKey = await webcrypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const toSign = `${header}.${payload}`;
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(toSign)
  );
  return `${toSign}.${base64urlEncode(new Uint8Array(sig))}`;
}

async function encryptPayload(payload, p256dhBase64, authBase64) {
  const receiverKey = await webcrypto.subtle.importKey(
    'raw', base64urlDecode(p256dhBase64),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );
  const senderKeyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  );
  const senderPublicRaw = new Uint8Array(await webcrypto.subtle.exportKey('raw', senderKeyPair.publicKey));

  const sharedBits = await webcrypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, senderKeyPair.privateKey, 256
  );

  const authSecret = base64urlDecode(authBase64);
  const salt = webcrypto.getRandomValues(new Uint8Array(16));

  const prk = await webcrypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey', 'deriveBits']);

  const receiverPubRaw = new Uint8Array(await webcrypto.subtle.exportKey('raw', receiverKey));
  const info = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\x00'),
    ...receiverPubRaw, ...senderPublicRaw,
  ]);
  const ikmBits = await webcrypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info }, prk, 256
  );

  const ikmKey = await webcrypto.subtle.importKey('raw', ikmBits, 'HKDF', false, ['deriveBits']);

  const cekInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aes128gcm\x00')]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\x00')]);

  const [cekBits, nonceBits] = await Promise.all([
    webcrypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, ikmKey, 128),
    webcrypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, ikmKey, 96),
  ]);

  const cek = await webcrypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const nonce = new Uint8Array(nonceBits);

  const pt = new Uint8Array([...new TextEncoder().encode(payload), 0x02]);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, pt));

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
  return result;
}

async function sendPush(endpoint, p256dh, auth, title, body, url = '/app') {
  console.log(`Encrypting payload for push...`);
  const payload = JSON.stringify({ title, body, url, tag: 'test-push' });
  const encBody = await encryptPayload(payload, p256dh, auth);

  console.log(`Sending push to endpoint: ${endpoint}`);
  const destUrl = new URL(endpoint);
  const audience = `${destUrl.protocol}//${destUrl.host}`;
  const jwt = await buildVapidJwt(audience);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Crypto-Key': `p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: encBody,
  });

  console.log(`Response Status: ${res.status}`);
  const text = await res.text();
  console.log(`Response Body:`, text);
  if (res.status === 201 || res.status === 200) {
    console.log(`⚡ Push notification successfully sent!`);
  } else {
    console.log(`❌ Failed to send push.`);
  }
}

// Read args
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node send-test-push-direct.js <endpoint> <p256dh> <auth> [title] [body]');
  console.log('\nExample:');
  console.log('  node send-test-push-direct.js "https://fcm.googleapis.com/fcm/send/..." "BM..." "eX..." "Test Title" "Hello world!"');
  process.exit(1);
}

const [endpoint, p256dh, auth, title = 'Hello from Antigravity!', body = 'This is a real-time web push!'] = args;
sendPush(endpoint, p256dh, auth, title, body);
