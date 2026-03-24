# Setup Push Notification Server — PropMap

Push notification PropMap menggunakan **Supabase Edge Functions** + **Web Push VAPID**.
Setelah setup ini, notifikasi masuk ke HP meski browser/app ditutup.

---

## LANGKAH 1 — Generate VAPID Keys

Buka browser → **https://vapidkeys.com** → klik **Generate**

Simpan:
- **Public Key** → dipakai di `js/push.js` dan Supabase Secrets
- **Private Key** → hanya di Supabase Secrets, jangan share

---

## LANGKAH 2 — Isi VAPID Public Key di Aplikasi

Edit `js/push.js`, cari dan ganti:
```js
const VAPID_PUBLIC_KEY = 'GANTI_DENGAN_VAPID_PUBLIC_KEY_ANDA';
```
Ganti dengan Public Key dari vapidkeys.com. Deploy ulang ke Netlify.

---

## LANGKAH 3 — Deploy Edge Function via Supabase Dashboard

1. Buka **supabase.com** → pilih project
2. Klik menu **Edge Functions** di sidebar kiri
3. Klik **Create a new function**
4. Nama: `push-reminder`
5. Copy seluruh isi file `supabase/functions/push-reminder/index.ts`
6. Paste ke editor → klik **Deploy**

---

## LANGKAH 4 — Set Secrets di Supabase

Buka **Edge Functions → push-reminder → Secrets** lalu tambahkan:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Public Key dari vapidkeys.com |
| `VAPID_PRIVATE_KEY` | Private Key dari vapidkeys.com |
| `VAPID_SUBJECT` | `mailto:email_anda@gmail.com` |
| `CRON_SECRET` | Password bebas, contoh: `propmap2026` |

---

## LANGKAH 5 — Aktifkan Extensions di Supabase

1. Supabase → **Database → Extensions**
2. Aktifkan **pg_cron**
3. Aktifkan **pg_net**

---

## LANGKAH 6 — Buat Cron Job (Jadwal Harian)

Supabase → **SQL Editor** → jalankan:

```sql
-- Kirim reminder setiap hari jam 07:00 WIB (00:00 UTC)
SELECT cron.schedule(
  'push-reminder-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://[PROJECT_REF].supabase.co/functions/v1/push-reminder',
    headers := '{"Content-Type":"application/json","x-cron-secret":"propmap2026"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
```

Ganti `[PROJECT_REF]` dengan Reference ID project (ada di Project Settings → General).
Ganti `propmap2026` dengan CRON_SECRET yang sama di Langkah 4.

---

## LANGKAH 7 — Jalankan RLS push_subscriptions

Supabase → **SQL Editor** → jalankan:

```sql
DROP POLICY IF EXISTS "User kelola subscription sendiri" ON push_subscriptions;

CREATE POLICY "User insert subscription"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "User update subscription"
  ON push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "User delete subscription"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service baca semua subscription"
  ON push_subscriptions FOR SELECT
  USING (true);
```

---

## CARA TEST

### Test 1 — Notifikasi lokal (aplikasi terbuka)
Buka PropMap → F12 Console → ketik:
```js
showNotif('🔔 Test PropMap', 'Notifikasi berhasil!')
```

### Test 2 — Edge Function manual
Buka Supabase → **Edge Functions → push-reminder → Test/Invoke**
Tambahkan header: `x-cron-secret: propmap2026`
Klik Send → response harus `{"sent": N}`

### Test 3 — End-to-end lengkap
1. Login PropMap sebagai user Pro → aktifkan notifikasi
2. Cek **Supabase → Table Editor → push_subscriptions** — pastikan ada data
3. Edit konsumen → set Jadwal Follow-up ke hari ini
4. Trigger manual via SQL Editor:
```sql
SELECT net.http_post(
  url     := 'https://[PROJECT_REF].supabase.co/functions/v1/push-reminder',
  headers := '{"Content-Type":"application/json","x-cron-secret":"propmap2026"}'::jsonb,
  body    := '{}'::jsonb
);
```
5. Tunggu 5-10 detik → notifikasi masuk ke HP

---

## JADWAL NOTIFIKASI

| Kondisi | Waktu Kirim |
|---|---|
| Follow-up hari ini | 07:00 WIB setiap hari |
| Follow-up besok | 07:00 WIB setiap hari |
| Booking > 7 hari | Tiap kelipatan 7 hari |
| DP ≥ 14 hari | Tiap kelipatan 7 hari |
| Berkas belum lengkap ≥ 7 hari | Tiap kelipatan 7 hari |

---

## TROUBLESHOOTING

**`push_subscriptions` kosong setelah aktifkan notifikasi:**
→ VAPID Public Key di `push.js` belum diisi / masih placeholder
→ RLS policy belum dijalankan (Langkah 7)

**Edge Function error `VAPID keys belum diset`:**
→ Cek Secrets di Supabase sudah terisi semua

**Notif tidak masuk meski `sent > 0`:**
→ Cek izin notifikasi di HP — pastikan tidak diblokir di pengaturan browser
→ Cek Service Worker aktif: F12 → Application → Service Workers

**Response `401 Unauthorized` dari Edge Function:**
→ CRON_SECRET di SQL tidak sama dengan di Supabase Secrets

*PropMap v4.2 · Push Notification Setup Guide*
