# 🎯 MarketPro — CRM Tim Marketing Properti

> Aplikasi web real-time untuk monitoring dan pengelolaan data konsumen properti, dirancang khusus untuk tim marketing. Dapat diinstall di HP (PWA) dan mendukung multi-user dengan sinkronisasi data secara langsung.

![MarketPro](https://img.shields.io/badge/MarketPro-v2.0-3b82f6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeT0iMjAiIGZvbnQtc2l6ZT0iMjAiPvCfjq88L3RleHQ+PC9zdmc+)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Demo & Screenshot](#-demo--screenshot)
- [Teknologi](#-teknologi)
- [Cara Setup](#-cara-setup)
- [Struktur File](#-struktur-file)
- [Panduan Penggunaan](#-panduan-penggunaan)
- [FAQ](#-faq)
- [Kontribusi](#-kontribusi)

---

## ✨ Fitur Utama

### 🔐 Autentikasi Multi-user
- Login dan registrasi dengan email & password
- Dua level akses: **Marketing** dan **Admin**
- Sesi login persisten (tidak perlu login ulang)
- Keamanan data di level database (Row Level Security)

### 📊 Dashboard Real-time
- Statistik langsung: total konsumen, booking, proses DP, akad selesai
- Pipeline visual 5 tahap yang interaktif
- Feed aktivitas terbaru
- **Khusus Admin:** kartu performa per anggota tim

### 👥 Manajemen Konsumen Lengkap
- CRUD data konsumen (tambah, lihat, edit, hapus)
- Data yang dikelola: nama, HP, tipe unit, kavling, harga, DP, tanggal booking, tipe KPR, sumber leads, catatan
- Pencarian real-time berdasarkan nama / HP / unit / kavling
- Filter berdasarkan 5 status pipeline
- **Khusus Admin:** filter data per marketing

### 📋 Pipeline 5 Tahap

| Status | Keterangan |
|--------|-----------|
| 📋 Booking | Konsumen sudah booking unit |
| 💰 Proses DP | Pembayaran uang muka sedang berjalan |
| 📁 Kumpul Berkas | Pengumpulan dokumen untuk KPR |
| ✅ Selesai | Akad kredit sudah dilaksanakan |
| ❌ Batal | Konsumen membatalkan pembelian |

### 📁 Checklist Berkas Otomatis
- 6 item berkas yang bisa dicentang per konsumen
- KTP / e-KTP, Kartu Keluarga, Slip Gaji / SK Kerja, Rekening Tabungan 3 Bulan, NPWP, Surat Keterangan Lainnya
- Progress berkas tampil langsung di kartu konsumen

### 📌 Log Aktivitas Otomatis
- Setiap perubahan status tercatat otomatis dengan timestamp
- Setiap perubahan checklist berkas tercatat
- Bisa tambah catatan manual kapan saja

### 🔔 Notifikasi & Pengingat
- Pengingat follow-up booking yang sudah lebih dari 7 hari
- Alert konsumen dengan berkas belum lengkap
- Pengingat proses DP yang belum selesai
- Badge angka di ikon notifikasi

### 📈 Laporan & Analitik
- Total nilai penjualan dan DP masuk
- Progress bar per tahap pipeline
- Tracking target penjualan bulanan
- **Khusus Admin:** ranking performa seluruh tim marketing

### ⚙️ Panel Admin
- Kelola role anggota tim (Marketing ↔ Admin) dari dalam aplikasi
- Export semua data konsumen tim ke JSON
- Lihat dan filter data konsumen seluruh tim

### 📲 Progressive Web App (PWA)
- Install di HP Android dan iPhone seperti aplikasi native
- Tampilan tetap muncul saat koneksi lambat (offline-ready)
- Sinkronisasi data otomatis saat koneksi kembali

---

## 🛠 Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime (WebSocket) |
| Hosting | [Vercel](https://vercel.com) / [Netlify](https://netlify.com) (gratis) |
| PWA | Service Worker + Web App Manifest |
| Font | Syne + DM Sans + JetBrains Mono |

---

## 🚀 Cara Setup

### Prasyarat
- Akun [Supabase](https://supabase.com) (gratis)
- Akun [Vercel](https://vercel.com) atau [Netlify](https://netlify.com) untuk hosting (gratis)

### Langkah 1 — Clone Repository

```bash
git clone https://github.com/username/marketpro.git
cd marketpro
```

### Langkah 2 — Setup Database Supabase

1. Buka [supabase.com](https://supabase.com) → buat project baru
2. Pergi ke **SQL Editor**
3. Jalankan seluruh isi file [`setup.sql`](./setup.sql)

Script akan membuat:
- Tabel `profiles` — data pengguna & role
- Tabel `konsumen` — data konsumen properti
- Row Level Security policies
- Auto-update timestamp trigger

### Langkah 3 — Aktifkan Realtime

Di Supabase Dashboard:
```
Table Editor → konsumen → ⚡ Realtime → Enable
```

Atau via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE konsumen;
```

### Langkah 4 — Konfigurasi Aplikasi

Buka file `index.html`, temukan bagian berikut dan ganti dengan kredensial dari **Supabase → Project Settings → API**:

```javascript
// ⚙️ KONFIGURASI SUPABASE — GANTI DI SINI
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Langkah 5 — Upload ke Hosting

**Opsi A — Vercel (Rekomendasi):**
```bash
npm install -g vercel
vercel deploy
```
Atau drag & drop folder ke [vercel.com/new](https://vercel.com/new)

**Opsi B — Netlify:**
Drag & drop folder ke [app.netlify.com/drop](https://app.netlify.com/drop)

Anda akan mendapatkan URL seperti: `https://marketpro-tim.vercel.app`

### Langkah 6 — Setup Akun Admin Pertama

1. Buka aplikasi → daftar akun baru
2. Buka Supabase → **Table Editor** → tabel `profiles`
3. Cari baris dengan email Anda → ubah kolom `role` dari `marketing` menjadi `admin`
4. Refresh aplikasi → Anda sekarang Admin ✅

Selanjutnya, penambahan admin berikutnya bisa dilakukan langsung dari dalam aplikasi (**Pengaturan → Panel Admin → Kelola Pengguna**).

> **Alternatif via SQL:**
> ```sql
> UPDATE profiles SET role = 'admin' WHERE email = 'email_anda@contoh.com';
> ```

---

## 📁 Struktur File

```
marketpro/
├── index.html      # Aplikasi utama (satu file lengkap)
├── manifest.json   # Konfigurasi PWA
├── sw.js           # Service Worker (offline support)
├── setup.sql       # Script SQL untuk setup Supabase
└── README.md       # Dokumentasi ini
```

---

## 📖 Panduan Penggunaan

### Untuk Marketing

| Aksi | Cara |
|------|------|
| Tambah konsumen | Tab Konsumen → tombol **＋** (biru, kanan bawah) |
| Edit konsumen | Buka detail konsumen → tombol **✏️ Edit Data** |
| Centang berkas | Buka detail konsumen → bagian **Checklist Berkas** |
| Tambah catatan | Buka detail konsumen → tombol **📝 Tambah Log** |
| Hubungi konsumen | Buka detail konsumen → tombol **📞 Telepon** atau **💬 WhatsApp** |
| Lihat pengingat | Tap ikon **🔔** di header |

### Untuk Admin

| Aksi | Cara |
|------|------|
| Lihat semua data | Tab Konsumen → data seluruh tim tampil otomatis |
| Filter per marketing | Tab Konsumen → dropdown **Filter Marketing** |
| Lihat ranking tim | Tab Laporan → bagian **Ranking Tim Marketing** |
| Ubah role anggota | Pengaturan → **Panel Admin** → **Kelola Pengguna** |
| Export data | Pengaturan → **Panel Admin** → **Export Semua Data** |

### Install di HP

**Android (Chrome):**
1. Buka URL aplikasi di Chrome
2. Tap menu ⋮ → **Tambahkan ke layar utama**
3. Tap **Tambahkan**

**iPhone (Safari):**
1. Buka URL aplikasi di Safari
2. Tap ikon **Berbagi** (kotak dengan panah ke atas)
3. Pilih **Tambahkan ke Layar Utama**
4. Tap **Tambahkan**

---

## ❓ FAQ

**Q: Apakah data aman jika satu marketing login di HP yang berbeda?**
A: Ya. Setiap marketing hanya bisa melihat dan mengedit data konsumen miliknya sendiri, dijamin oleh Row Level Security di level database PostgreSQL.

**Q: Berapa banyak pengguna yang bisa pakai aplikasi ini?**
A: Supabase free tier mendukung hingga 50.000 baris data dan 500MB storage. Untuk tim 6–20 orang ini lebih dari cukup. Jika sudah besar, upgrade ke Supabase Pro ($25/bulan).

**Q: Apakah bisa dipakai tanpa internet?**
A: Tampilan aplikasi akan tetap muncul (cached oleh Service Worker), namun data tidak bisa dimuat atau disimpan tanpa koneksi internet karena database ada di Supabase cloud.

**Q: Bagaimana jika dua marketing mengedit data yang sama bersamaan?**
A: Data terakhir yang disimpan akan menang (last-write-wins). Semua perubahan tersinkronisasi real-time ke semua perangkat yang sedang membuka aplikasi.

**Q: Bisakah aplikasi ini dipakai di laptop/komputer?**
A: Ya, tampilan responsif dan berfungsi penuh di browser desktop maupun mobile.

**Q: Bagaimana cara reset password?**
A: Saat ini reset password dilakukan melalui Supabase Dashboard → Authentication → Users → pilih user → Send Password Recovery. Fitur reset password mandiri bisa ditambahkan sebagai pengembangan berikutnya.

---

## 🗺 Roadmap Pengembangan

- [ ] Fitur reset password mandiri dari dalam aplikasi
- [ ] Notifikasi push ke HP (Web Push Notification)
- [ ] Export laporan ke PDF / Excel
- [ ] Upload foto dokumen / berkas
- [ ] Kalender jadwal follow-up
- [ ] Integrasi WhatsApp Business API
- [ ] Dark/Light mode toggle
- [ ] Multi-proyek (untuk marketing yang handle beberapa proyek)

---

## 🤝 Kontribusi

Kontribusi sangat disambut! Silakan:

1. Fork repository ini
2. Buat branch baru: `git checkout -b fitur/nama-fitur`
3. Commit perubahan: `git commit -m 'Tambah fitur: nama-fitur'`
4. Push ke branch: `git push origin fitur/nama-fitur`
5. Buat Pull Request

---

## 📄 Lisensi

Didistribusikan di bawah [MIT License](LICENSE). Bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan pribadi maupun komersial.

---

<div align="center">
  <p>Dibuat dengan ❤️ untuk tim marketing properti Indonesia</p>
  <p>
    <strong>MarketPro v2.0</strong> · Supabase + PWA · Real-time Multi-user
  </p>
</div>
