-- ═══════════════════════════════════════════════════════════════
-- MarketPro v4 — SQL Schema: Workspace + Subscription + Plans
-- Jalankan di Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. ENUM PLAN ─────────────────────────────────────────────
CREATE TYPE plan_type AS ENUM ('free', 'pro', 'bisnis');
CREATE TYPE sub_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- ── 2. TABEL WORKSPACES ──────────────────────────────────────
-- Satu workspace = satu tim = satu billing
CREATE TABLE IF NOT EXISTS workspaces (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,                        -- nama tim / perusahaan
  slug         text UNIQUE,                          -- untuk white-label URL nanti
  owner_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  plan         plan_type NOT NULL DEFAULT 'free',
  -- white-label fields (Bisnis plan)
  brand_name   text,                                 -- nama kustom (ganti "MarketPro")
  brand_color  text DEFAULT '#6366f1',               -- warna brand kustom
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── 3. TABEL SUBSCRIPTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id        uuid REFERENCES workspaces ON DELETE CASCADE NOT NULL,
  plan                plan_type NOT NULL DEFAULT 'free',
  status              sub_status NOT NULL DEFAULT 'trialing',
  -- Xendit fields
  xendit_invoice_id   text,
  xendit_customer_id  text,
  -- billing cycle
  billing_cycle       text DEFAULT 'monthly',        -- 'monthly' | 'yearly'
  amount              bigint DEFAULT 0,              -- dalam Rupiah
  -- dates
  trial_ends_at       timestamptz DEFAULT (now() + interval '14 days'),
  current_period_start timestamptz DEFAULT now(),
  current_period_end  timestamptz DEFAULT (now() + interval '30 days'),
  canceled_at         timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── 4. TABEL WORKSPACE_MEMBERS ───────────────────────────────
-- Relasi user ↔ workspace (satu user bisa di banyak workspace)
CREATE TABLE IF NOT EXISTS workspace_members (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role         text NOT NULL DEFAULT 'marketing',    -- 'owner' | 'admin' | 'marketing'
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- ── 5. UPDATE TABEL PROFILES (tambah workspace_id) ───────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  active_workspace_id uuid REFERENCES workspaces ON DELETE SET NULL;

-- ── 6. UPDATE TABEL KONSUMEN (tambah workspace_id) ───────────
ALTER TABLE konsumen ADD COLUMN IF NOT EXISTS
  workspace_id uuid REFERENCES workspaces ON DELETE CASCADE;

-- ── 7. PLAN LIMITS VIEW ──────────────────────────────────────
-- Helper view untuk cek batas per plan
CREATE OR REPLACE VIEW plan_limits AS
SELECT
  'free'::plan_type    AS plan,
  1                    AS max_members,
  30                   AS max_konsumen,
  false                AS realtime_sync,
  false                AS laporan_tim,
  false                AS export_data,
  false                AS white_label,
  false                AS multi_proyek
UNION ALL
SELECT
  'pro'::plan_type,
  5, NULL, true, true, true, false, false
UNION ALL
SELECT
  'bisnis'::plan_type,
  20, NULL, true, true, true, true, true;

-- ── 8. ROW LEVEL SECURITY ────────────────────────────────────

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces: anggota bisa lihat workspace mereka
CREATE POLICY "Members can view their workspace"
  ON workspaces FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update workspace"
  ON workspaces FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "User can create workspace"
  ON workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Subscriptions: hanya owner workspace
CREATE POLICY "Owner can view subscription"
  ON subscriptions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = subscriptions.workspace_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update subscription"
  ON subscriptions FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = subscriptions.workspace_id
        AND owner_id = auth.uid()
    )
  );

-- Service role bisa insert subscription (untuk webhook Xendit)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL USING (auth.role() = 'service_role');

-- Workspace members
CREATE POLICY "Members can view other members"
  ON workspace_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin/Owner can manage members"
  ON workspace_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Update konsumen RLS — filter by workspace
DROP POLICY IF EXISTS "Marketing lihat konsumen sendiri, Admin lihat semua" ON konsumen;
DROP POLICY IF EXISTS "Marketing insert konsumen sendiri" ON konsumen;
DROP POLICY IF EXISTS "Marketing update konsumen sendiri, Admin update semua" ON konsumen;
DROP POLICY IF EXISTS "Marketing delete konsumen sendiri, Admin delete semua" ON konsumen;

CREATE POLICY "Workspace members see konsumen"
  ON konsumen FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = konsumen.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert konsumen in their workspace"
  ON konsumen FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = konsumen.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Marketing update own, Admin/Owner update all in workspace"
  ON konsumen FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = konsumen.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Marketing delete own, Admin/Owner delete all in workspace"
  ON konsumen FOR DELETE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = konsumen.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── 9. FUNGSI HELPER ─────────────────────────────────────────

-- Cek apakah workspace bisa tambah member baru
CREATE OR REPLACE FUNCTION can_add_member(p_workspace_id uuid)
RETURNS boolean AS $$
DECLARE
  v_plan plan_type;
  v_max  int;
  v_cnt  int;
BEGIN
  SELECT w.plan INTO v_plan FROM workspaces w WHERE id = p_workspace_id;
  SELECT max_members INTO v_max FROM plan_limits WHERE plan = v_plan;
  SELECT COUNT(*) INTO v_cnt FROM workspace_members WHERE workspace_id = p_workspace_id;
  IF v_max IS NULL THEN RETURN true; END IF;
  RETURN v_cnt < v_max;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cek apakah workspace bisa tambah konsumen
CREATE OR REPLACE FUNCTION can_add_konsumen(p_workspace_id uuid)
RETURNS boolean AS $$
DECLARE
  v_plan plan_type;
  v_max  int;
  v_cnt  int;
BEGIN
  SELECT w.plan INTO v_plan FROM workspaces w WHERE id = p_workspace_id;
  SELECT max_konsumen INTO v_max FROM plan_limits WHERE plan = v_plan;
  SELECT COUNT(*) INTO v_cnt FROM konsumen WHERE workspace_id = p_workspace_id;
  IF v_max IS NULL THEN RETURN true; END IF;
  RETURN v_cnt < v_max;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ambil info subscription aktif untuk workspace
CREATE OR REPLACE FUNCTION get_workspace_subscription(p_workspace_id uuid)
RETURNS TABLE(
  plan          plan_type,
  status        sub_status,
  trial_ends_at timestamptz,
  period_end    timestamptz,
  is_trial      boolean,
  is_active     boolean,
  days_left     int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.plan,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    (s.status = 'trialing' AND s.trial_ends_at > now()),
    (s.status IN ('trialing', 'active') AND
       (s.trial_ends_at > now() OR s.current_period_end > now())),
    CASE
      WHEN s.status = 'trialing' THEN EXTRACT(DAY FROM s.trial_ends_at - now())::int
      ELSE EXTRACT(DAY FROM s.current_period_end - now())::int
    END
  FROM subscriptions s
  WHERE s.workspace_id = p_workspace_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. TRIGGER: Auto-buat workspace saat user baru daftar ───
CREATE OR REPLACE FUNCTION create_default_workspace()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Buat workspace default
  INSERT INTO workspaces (name, owner_id, plan)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
    NEW.id,
    'free'
  )
  RETURNING id INTO v_workspace_id;

  -- Tambah user sebagai owner
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  -- Buat subscription trial 14 hari
  INSERT INTO subscriptions (workspace_id, plan, status, trial_ends_at, current_period_end)
  VALUES (
    v_workspace_id,
    'free',
    'trialing',
    now() + interval '14 days',
    now() + interval '14 days'
  );

  -- Set active workspace di profile
  UPDATE profiles SET active_workspace_id = v_workspace_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger ke auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_workspace();

-- ── 11. AUTO-UPDATE TIMESTAMP ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- MIGRASI DATA LAMA (jika sudah ada user di database sebelumnya)
-- Jalankan bagian ini SEKALI saja setelah schema di atas
-- ═══════════════════════════════════════════════════════════════

-- Buat workspace untuk user lama yang belum punya
DO $$
DECLARE
  r RECORD;
  v_wid uuid;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.email
    FROM profiles p
    WHERE p.active_workspace_id IS NULL
  LOOP
    INSERT INTO workspaces (name, owner_id, plan)
    VALUES (COALESCE(r.full_name, split_part(r.email,'@',1)) || '''s Workspace', r.id, 'free')
    RETURNING id INTO v_wid;

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_wid, r.id, 'owner')
    ON CONFLICT DO NOTHING;

    INSERT INTO subscriptions (workspace_id, plan, status, trial_ends_at, current_period_end)
    VALUES (v_wid, 'free', 'trialing', now() + interval '14 days', now() + interval '14 days')
    ON CONFLICT DO NOTHING;

    UPDATE profiles SET active_workspace_id = v_wid WHERE id = r.id;

    -- Assign konsumen lama ke workspace ini
    UPDATE konsumen SET workspace_id = v_wid
    WHERE owner_id = r.id AND workspace_id IS NULL;
  END LOOP;
END $$;
