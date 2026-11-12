-- Migration 002: give audit_no_update the same purge-mode exemption
-- audit_no_delete already had. The v1 trigger aborted every update
-- unconditionally, which also blocked the privileged bypass the
-- tamper demo (task 8.6) needs. The append-only guarantee is
-- unchanged for every normal path: the purge flag is only on inside
-- withPurgeMode. Existing databases keep the old trigger unless
-- this migration runs, because CREATE TRIGGER IF NOT EXISTS never
-- replaces a trigger that already exists.
DROP TRIGGER IF EXISTS audit_no_update;
CREATE TRIGGER audit_no_update
BEFORE UPDATE ON audit_log
WHEN (SELECT active FROM purge_mode WHERE id = 1) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only: updates are forbidden');
END;
