-- Integrity rules that Prisma's schema language cannot express.

-- Emails are normalised by the application; enforce it so case-variant duplicates cannot exist.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- Usernames are stored lower-cased as well.
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_username_lowercase"
  CHECK ("username" IS NULL OR "username" = lower("username"));

-- Sessions must expire after they were created.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_after_creation" CHECK ("expires_at" > "created_at");

-- Audit logs are append-only. Users are anonymised rather than hard-deleted, so the
-- ON DELETE SET NULL path on actor_id is not exercised by the application.
CREATE OR REPLACE FUNCTION "audit_logs_prevent_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_prevent_mutation"();
