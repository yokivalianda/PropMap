-- ════════════════════════════════════════════════
-- MULTI-PROYEK — MarketPro v4.1
-- Jalankan seluruh blok ini di Supabase SQL Editor
-- ════════════════════════════════════════════════

-- ── STEP 1: Buat tabel proyek (tanpa policy dulu) ─
CREATE TABLE IF NOT EXISTS proyek (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nama        text NOT NULL,
  deskripsi   text DEFAULT '',
  warna       text DEFAULT '#6366f1',
  owner_id    uuid REFERENCES auth.users ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE proyek ENABLE ROW LEVEL SECURITY;

-- ── STEP 2: Buat tabel proyek_members ────────────
CREATE TABLE IF NOT EXISTS proyek_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proyek_id   uuid REFERENCES proyek ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE,
  role        text DEFAULT 'marketing',
  joined_at   timestamptz DEFAULT now(),
  UNIQUE (proyek_id, user_id)
);

ALTER TABLE proyek_members ENABLE ROW LEVEL SECURITY;

-- ── STEP 3: Policy proyek (setelah proyek_members ada) ─
CREATE POLICY "Admin kelola proyek"
  ON proyek FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Member baca proyek"
  ON proyek FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM proyek_members
      WHERE proyek_id = proyek.id AND user_id = auth.uid()
    )
  );

-- ── STEP 4: Policy proyek_members ────────────────
CREATE POLICY "Admin kelola members"
  ON proyek_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "User lihat member proyek sendiri"
  ON proyek_members FOR SELECT
  USING (user_id = auth.uid());

-- ── STEP 5: Tambah kolom proyek_id ke konsumen ───
ALTER TABLE konsumen
  ADD COLUMN IF NOT EXISTS proyek_id uuid REFERENCES proyek ON DELETE SET NULL;

-- ── STEP 6: Index untuk performa ─────────────────
CREATE INDEX IF NOT EXISTS idx_konsumen_proyek ON konsumen(proyek_id);
CREATE INDEX IF NOT EXISTS idx_members_proyek  ON proyek_members(proyek_id);
CREATE INDEX IF NOT EXISTS idx_members_user    ON proyek_members(user_id);
