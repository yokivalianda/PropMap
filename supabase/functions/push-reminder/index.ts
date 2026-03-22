// ═══════════════════════════════════════════════════════════
// PropMap — Supabase Edge Function: push-reminder
// Kirim Web Push Notification ke semua user Pro yang aktif
// Jadwal: Setiap hari jam 07:00 WIB via Supabase Cron
// ═══════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── VAPID Helper (Web Push tanpa library eksternal) ────────
// VAPID keys dibuat sekali, simpan di Supabase Secrets
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')     || 'mailto:admin@propmap.id';

// Base64url encode
function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Decode base64url
function decodeBase64url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// Buat JWT untuk VAPID Authorization header
async function makeVapidJWT(audience: string): Promise<string> {
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const enc  = new TextEncoder();
  const toSign = base64url(enc.encode(JSON.stringify(header))) + '.' +
                 base64url(enc.encode(JSON.stringify(payload)));

  // Import private key
  const rawKey = decodeBase64url(VAPID_PRIVATE);
  const key = await crypto.subtle.importKey(
    'raw', rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(toSign)
  );

  return toSign + '.' + base64url(new Uint8Array(sig));
}

// Enkripsi payload push (AES-GCM + ECDH)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array }> {
  const enc   = new TextEncoder();
  const salt  = crypto.getRandomValues(new Uint8Array(16));

  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  ) as CryptoKeyPair;

  const serverPubRaw  = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  );
  const clientPubRaw  = decodeBase64url(p256dhKey);
  const authSecretBuf = decodeBase64url(authSecret);

  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPubKey }, serverKeys.privateKey, 256
  );

  // HKDF PRK
  const hkdfKey = await crypto.subtle.importKey(
    'raw', sharedBits, { name: 'HKDF' }, false, ['deriveBits']
  );

  // Content-Encoding: aes128gcm
  const payloadBuf = enc.encode(payload);
  const padding    = new Uint8Array(2); // no padding
  const plaintext  = new Uint8Array([...payloadBuf, 2, ...padding]);

  const prk = await crypto.subtle.deriveBits(
    {
      name: 'HKDF', hash: 'SHA-256', salt: authSecretBuf,
      info: enc.encode('Content-Encoding: auth\0'),
    },
    hkdfKey, 256
  );

  const prkKey = await crypto.subtle.importKey(
    'raw', prk, { name: 'HKDF' }, false, ['deriveBits']
  );

  const cekInfo = new Uint8Array([
    ...enc.encode('Content-Encoding: aes128gcm\0'),
    0, 1,
    ...clientPubRaw,
    ...serverPubRaw,
  ]);

  const cek = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey, 128
  );

  const nonceInfo = new Uint8Array([
    ...enc.encode('Content-Encoding: nonce\0'),
    0, 1,
    ...clientPubRaw,
    ...serverPubRaw,
  ]);

  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey, 96
  );

  const aesKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey, plaintext
    )
  );

  return { ciphertext, salt };
}

// Kirim satu push notification
async function sendPush(subscription: {
  endpoint: string; p256dh: string; auth: string;
}, title: string, body: string, data: Record<string, unknown> = {}) {
  const url      = new URL(subscription.endpoint);
  const audience = url.origin;
  const jwt      = await makeVapidJWT(audience);

  const payload = JSON.stringify({ title, body, icon: '/manifest.json', data });
  const { ciphertext, salt } = await encryptPayload(
    payload, subscription.p256dh, subscription.auth
  );

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      'Content-Type':  'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: ciphertext,
  });

  return res.status;
}

// ── MAIN HANDLER ──────────────────────────────────
Deno.serve(async (req) => {
  // Verifikasi request dari Supabase Cron (pakai secret header)
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Ambil semua push subscriptions dari user Pro/Business yang aktif
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }));
  }

  // Ambil semua konsumen yang relevan
  const { data: konsumens } = await supabase
    .from('konsumen')
    .select('id, nama, status, tgl_followup, tgl_booking, unit, owner_id, berkas')
    .in('status', ['cek-lokasi', 'booking', 'dp', 'berkas']);

  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    const myKons = (konsumens || []).filter(k => k.owner_id === sub.user_id);

    for (const k of myKons) {
      // ── Follow-up hari ini
      if (k.tgl_followup === todayStr) {
        try {
          const status = await sendPush(sub,
            '📅 Follow-up Hari Ini!',
            `${k.nama}${k.unit ? ' · ' + k.unit : ''} — ${k.status}`,
            { konsumenId: k.id }
          );
          if (status < 300) sent++;
        } catch(e) { errors.push(String(e)); }
      }

      // ── Follow-up besok
      if (k.tgl_followup === tomorrowStr) {
        try {
          const status = await sendPush(sub,
            '📅 Reminder Follow-up Besok',
            `${k.nama} — jadwal besok ${tomorrowStr}`,
            { konsumenId: k.id }
          );
          if (status < 300) sent++;
        } catch(e) { errors.push(String(e)); }
      }

      // ── Booking > 7 hari belum naik status
      if (k.status === 'booking' && k.tgl_booking) {
        const days = Math.floor((today.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        if (days > 0 && days % 7 === 0) {
          try {
            const status = await sendPush(sub,
              '⏰ Booking Perlu Ditindaklanjuti',
              `${k.nama} sudah booking ${days} hari — segera follow up!`,
              { konsumenId: k.id }
            );
            if (status < 300) sent++;
          } catch(e) { errors.push(String(e)); }
        }
      }

      // ── Berkas belum lengkap > 7 hari
      if (k.status === 'berkas' && k.tgl_booking) {
        const days   = Math.floor((today.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        const kurang = (Array.isArray(k.berkas) ? k.berkas : []).filter((b: {done:boolean}) => !b.done).length;
        if (days >= 7 && kurang > 0 && days % 7 === 0) {
          try {
            const status = await sendPush(sub,
              '📁 Berkas Belum Lengkap',
              `${k.nama} — ${kurang} berkas masih kurang`,
              { konsumenId: k.id }
            );
            if (status < 300) sent++;
          } catch(e) { errors.push(String(e)); }
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, errors: errors.slice(0, 5) }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
