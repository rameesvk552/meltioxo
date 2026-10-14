\pset pager off
\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Keep the tenant's journals and cached accounts unchanged while balances are rebuilt.
LOCK TABLE accounts, journal_entries, journal_entry_lines IN SHARE ROW EXCLUSIVE MODE;
SELECT pg_advisory_xact_lock(hashtext('311c7e34-41f0-4059-b620-a331d14a6141:account-balance-rebuild'));

DO $$
DECLARE
  matching_users integer;
  tenant_name text;
BEGIN
  SELECT count(*), min(t.name)
    INTO matching_users, tenant_name
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
    AND lower(replace(u.email, ' ', '')) = 'zaiqueperfume@gmail.com';

  IF matching_users <> 1 OR lower(trim(tenant_name)) <> 'zaique perfume' THEN
    RAISE EXCEPTION 'Zaique tenant guard failed (users %, tenant %)', matching_users, tenant_name;
  END IF;
END $$;

CREATE TEMP TABLE balance_rebuild ON COMMIT DROP AS
SELECT
  a.id,
  a.code,
  a.name,
  a.type,
  a.balance::numeric(15,2) AS old_balance,
  round(CASE
    WHEN a.type IN ('asset', 'expense')
      THEN coalesce(sum(jel.debit - jel.credit) FILTER (WHERE je.status = 'posted'), 0)
    ELSE coalesce(sum(jel.credit - jel.debit) FILTER (WHERE je.status = 'posted'), 0)
  END, 2)::numeric(15,2) AS journal_balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je
  ON je.id = jel.journal_entry_id
 AND je.tenant_id = a.tenant_id
WHERE a.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
GROUP BY a.id, a.code, a.name, a.type, a.balance;

SELECT code, name, type, old_balance, journal_balance,
       (old_balance - journal_balance)::numeric(15,2) AS stale_difference
FROM balance_rebuild
WHERE old_balance <> journal_balance
ORDER BY code;

UPDATE accounts a
SET balance = b.journal_balance,
    updated_at = now()
FROM balance_rebuild b
WHERE a.id = b.id
  AND a.balance IS DISTINCT FROM b.journal_balance;

DO $$
DECLARE
  mismatch_count integer;
  unbalanced_journals integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM accounts a
  JOIN balance_rebuild b ON b.id = a.id
  WHERE a.balance IS DISTINCT FROM b.journal_balance;

  SELECT count(*) INTO unbalanced_journals
  FROM journal_entries
  WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
    AND (round(total_debit::numeric, 2) <> round(total_credit::numeric, 2));

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'Cached balance rebuild left % mismatches', mismatch_count;
  END IF;
  IF unbalanced_journals <> 0 THEN
    RAISE EXCEPTION 'Tenant has % unbalanced journal headers', unbalanced_journals;
  END IF;
END $$;

SELECT count(*) AS corrected_accounts
FROM balance_rebuild
WHERE old_balance <> journal_balance;

SELECT code, name, balance
FROM accounts
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND type = 'revenue'
ORDER BY code;

SELECT
  coalesce(sum(CASE WHEN type IN ('asset', 'expense') THEN balance ELSE -balance END), 0)::numeric(15,2)
    AS cached_trial_difference
FROM accounts
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

COMMIT;
