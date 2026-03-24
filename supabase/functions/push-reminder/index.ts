// ═══════════════════════════════════════════════════════════
// PropMap — Supabase Edge Function: push-reminder
// Kirim Web Push Notification ke semua user Pro aktif
// Jadwal: setiap hari jam 07:00 WIB (00:00 UTC) via pg_cron
// ═══════════════════════════════════════════════════════════

import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';
import webpush           from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@propmap.id';
const CRON_SECRET   = Deno.env.get('CRON_SECRET')       ?? '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// ── KIRIM SATU NOTIFIKASI ─────────────────────────
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  title: string,
  body: string,
  konsumenId?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const payload = JSON.stringify({
      title,
      body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag:   'propmap-' + Date.now(),
      data:  { konsumenId: konsumenId ?? '' },
    });

    const result = await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      payload,
      { TTL: 86400 }
    );
    return { ok: true, status: result.statusCode };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    return { ok: false, status: err.statusCode, error: err.message };
  }
}

// ── MAIN ──────────────────────────────────────────
Deno.serve(async (req) => {
  // Verifikasi CRON_SECRET
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys belum diset di Supabase Secrets' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tom      = new Date(now); tom.setDate(now.getDate() + 1);
  const tomStr   = tom.toISOString().split('T')[0];

  // Ambil semua push subscriptions
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (subErr) {
    return new Response(
      JSON.stringify({ error: 'Gagal ambil subscriptions: ' + subErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!subs?.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: 'Tidak ada subscriber aktif' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Ambil konsumen yang status-nya aktif
  const { data: konsumens } = await supabase
    .from('konsumen')
    .select('id, nama, status, tgl_followup, tgl_booking, unit, owner_id, berkas')
    .in('status', ['cek-lokasi', 'booking', 'dp', 'berkas']);

  const allKons = konsumens ?? [];
  let sent = 0;
  let skipped = 0;
  const invalidSubs: string[] = [];
  const errs: string[] = [];

  for (const sub of subs) {
    const myKons = allKons.filter(k => k.owner_id === sub.user_id);
    const notifs: { title: string; body: string; konsumenId: string }[] = [];

    for (const k of myKons) {
      // Follow-up hari ini
      if (k.tgl_followup === todayStr) {
        notifs.push({
          title: '📅 Follow-up Hari Ini!',
          body:  `${k.nama}${k.unit ? ' · ' + k.unit : ''} — segera hubungi!`,
          konsumenId: k.id,
        });
      }
      // Follow-up besok
      if (k.tgl_followup === tomStr) {
        notifs.push({
          title: '📅 Reminder Follow-up Besok',
          body:  `${k.nama} — jadwal follow-up besok`,
          konsumenId: k.id,
        });
      }
      // Booking > 7 hari (tiap 7 hari)
      if (k.status === 'booking' && k.tgl_booking) {
        const days = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        if (days > 0 && days % 7 === 0) {
          notifs.push({
            title: '⏰ Booking Perlu Ditindaklanjuti',
            body:  `${k.nama} sudah booking ${days} hari — segera follow up!`,
            konsumenId: k.id,
          });
        }
      }
      // DP >= 14 hari (tiap 7 hari)
      if (k.status === 'dp' && k.tgl_booking) {
        const days = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        if (days >= 14 && days % 7 === 0) {
          notifs.push({
            title: '💰 Proses DP Masih Berlangsung',
            body:  `${k.nama} — Proses DP sudah ${days} hari`,
            konsumenId: k.id,
          });
        }
      }
      // Berkas belum lengkap >= 7 hari (tiap 7 hari)
      if (k.status === 'berkas' && k.tgl_booking) {
        const days  = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        const kurang = (Array.isArray(k.berkas) ? k.berkas : [])
          .filter((b: { done: boolean }) => !b.done).length;
        if (days >= 7 && kurang > 0 && days % 7 === 0) {
          notifs.push({
            title: '📁 Berkas Belum Lengkap',
            body:  `${k.nama} — ${kurang} berkas masih kurang`,
            konsumenId: k.id,
          });
        }
      }
    }

    if (!notifs.length) { skipped++; continue; }

    for (const n of notifs) {
      const res = await sendPush(sub.endpoint, sub.p256dh, sub.auth, n.title, n.body, n.konsumenId);
      if (res.ok) {
        sent++;
      } else if (res.status === 410 || res.status === 404) {
        invalidSubs.push(sub.user_id);
        break;
      } else {
        errs.push(`${sub.user_id}: ${res.error}`);
      }
    }
  }

  // Hapus subscription 410 Gone
  if (invalidSubs.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', invalidSubs);
  }

  return new Response(
    JSON.stringify({ sent, skipped, invalid_removed: invalidSubs.length, errors: errs.slice(0,5), timestamp: now.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
