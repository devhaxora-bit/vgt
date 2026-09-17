# Ops notes — FY cutoff purge & bill number uniqueness

Quick reference so these commands and fixes are not forgotten.

---

## 1. Purge records through 31 March 2026

Script: `scripts/purge-through-fy-cutoff.ts`

Deletes transactional data with date **≤ 2026-03-31** (inclusive):

| Table | Date field |
|---|---|
| `party_payment_receipts` | `receipt_date` |
| `broker_challan_payment_receipts` | `receipt_date` |
| `party_billing_records` | `billing_date` |
| `broker_challan_billing_records` | `billing_date` |
| `challans` | `date_from` |
| `consignments` | `bkg_date` |
| `ledger_audit_logs` | related entities + `occurred_at` |

**Not deleted:** parties, brokers, branches, vehicles, users, CN ranges.

### Safety rule (important)

Bills dated **after** the cutoff are **never** deleted or modified.  
Any CNs still covered by those post-cutoff bills are **kept**, even if their `bkg_date` is ≤ cutoff.

Example: bill `VZM/26-27/1954` (30 Jun 2026) keeps CNs `5025` and `5060`.

### Commands

```bash
# Dry run (default) — counts only, no deletes
npm run purge:fy-cutoff

# Same with explicit cutoff
npx tsx scripts/purge-through-fy-cutoff.ts --cutoff=2026-03-31

# Actually delete (destructive — requires both flags)
npx tsx scripts/purge-through-fy-cutoff.ts --cutoff=2026-03-31 --execute --confirm=YES
```

Requires in `.env.local`:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

### Notes from last dry run

- Typo dates like `0026-07-20` / `0026-05-05` sort before 2026 and are included in the delete set.
- Always run dry run first and read the “Protected by post-cutoff bills” section.

---

## 2. Bill number uniqueness (DB fix)

Migration: `supabase/migrations/20260917130000_bill_ref_no_db_uniqueness.sql`

### Problem

`bill_ref_no` was only checked in the app (`findDuplicateGlobalBillRefNo`).  
Existing data already had **duplicate** bill numbers (e.g. `VZM/26-27/1892` × 2+), so a plain unique index failed with:

```text
Cannot enforce bill_ref_no uniqueness: N duplicate bill reference number group(s)...
```

Also an earlier guard query failed with `GROUP BY` / aggregate error — fixed by using `MIN(bill_ref_no) AS sample_ref`.

### What the migration does

1. **Auto-renames** duplicate rows inside `party_billing_records` (and broker bills if needed).
   - Keeps one canonical row per number: `ACTIVE` first, then oldest `created_at`.
   - Extra rows become: `{original}-D{6 hex from id}`  
     e.g. `VZM/26-27/1892` → `VZM/26-27/1892-Da1b2c3`
2. Renames broker refs that collide with party refs.
3. Creates case-insensitive unique indexes:
   - `uix_pbr_bill_ref_no_upper` on `party_billing_records`
   - `uix_bcbr_bill_ref_no_upper` on `broker_challan_billing_records`
4. Adds cross-table trigger `fn_validate_bill_ref_no_cross_table` so the same number cannot exist in both party and broker billing tables.

Temporarily disables integrity/protect triggers while renaming so bills with linked payments can still be fixed.

### After running the migration

Find renamed (deduped) bills:

```sql
SELECT bill_ref_no, billing_date, status, party_id
FROM party_billing_records
WHERE bill_ref_no LIKE '%-D%'
ORDER BY bill_ref_no;
```

Preview remaining duplicates (should return 0 rows after migration):

```sql
SELECT UPPER(TRIM(bill_ref_no)) AS ref_key, COUNT(*) AS n
FROM party_billing_records
WHERE bill_ref_no IS NOT NULL
GROUP BY UPPER(TRIM(bill_ref_no))
HAVING COUNT(*) > 1;
```

### App layer (already in place)

- Create/edit bill APIs use `findDuplicateGlobalBillRefNo` in `lib/server/billRefDuplicates.ts`.
- Dead per-party helper `findDuplicateBillRefNo` was removed from `lib/server/billingSnapshot.ts`.

---

## Checklist

- [ ] Run `npm run purge:fy-cutoff` and review dry-run output
- [ ] Run execute only when dry-run looks correct
- [ ] Apply `20260917130000_bill_ref_no_db_uniqueness.sql` in Supabase SQL editor / migrate
- [ ] Spot-check any `%-D%` renamed bill refs and fix manually if a real duplicate should be cancelled instead
