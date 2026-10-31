-- Migration: statement_print_requests
-- Creates a table for users to request printed account statements,
-- with admin approval workflow and print-fee tracking.

-- ─────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statement_print_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  print_fee        numeric     NOT NULL DEFAULT 1000,
  payment_proof_url text,
  statement_type   text        NOT NULL DEFAULT 'original'
                               CHECK (statement_type IN ('original', 'stamped_copy')),
  admin_note       text,
  approved_by      uuid        REFERENCES profiles(id),
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. Auto-update updated_at trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_statement_print_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_statement_print_requests_updated_at
  BEFORE UPDATE ON statement_print_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_statement_print_requests_updated_at();

-- ─────────────────────────────────────────────
-- 3. Settings row for print fee
-- ─────────────────────────────────────────────
INSERT INTO settings (key, value)
VALUES ('statement_print_fee', '1000')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE statement_print_requests ENABLE ROW LEVEL SECURITY;

-- Users: insert their own requests
CREATE POLICY "Users can insert own statement print requests"
  ON statement_print_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users: view their own requests
CREATE POLICY "Users can select own statement print requests"
  ON statement_print_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins: view all requests
CREATE POLICY "Admins can select all statement print requests"
  ON statement_print_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Admins: update any request (approve / reject / add notes)
CREATE POLICY "Admins can update all statement print requests"
  ON statement_print_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
