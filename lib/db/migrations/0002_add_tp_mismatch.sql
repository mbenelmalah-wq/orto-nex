ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "tp_mismatch" boolean NOT NULL DEFAULT false;
ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "tp_mismatch_detail" text;
