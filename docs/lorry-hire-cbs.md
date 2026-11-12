# Lorry Hire CBS

Open **Finance & Accounts → CBS → Lorry Hire CBS**. Search for a challan or lorry and select **Add Advance** or **Add Balance** to open the payment dialog with the challan details prefilled. Select **Payments** for CBS history, or click the challan number to open the full challan details modal. Admins can record payments; other authenticated users can view records within their branch access.

Apply `supabase/migrations/20261111000100_lorry_hire_cbs.sql` before using this screen. This migration adds the payment journal and transactional validation. It does not backfill cash vouchers for advances already entered on challans.

Balance is hire plus extra hire, less the original challan advance, TDS and recorded payments. CBS advances count as recorded payments. Broker CBS vouchers atomically create a receipt in the existing broker challan ledger; the same payment is counted once. Existing broker receipts also reduce the CBS balance. Direct hires use the CBS journal directly. Additional-only payments with zero hire allocation also stay in CBS and do not create a second hire settlement in the broker ledger.

The dialog opens on the selected Advance or Balance tab. Advance hides adjustment fields. Balance payments can settle all or part of the remaining balance, or record extra payments after the hire balance is cleared by leaving the hire allocation at zero. Optional additions and deductions require a description and positive amount. Final cash paid is the amount applied plus additions minus deductions; the amount applied reduces the challan balance. This matches the existing broker ledger calculation. Payment date, paid-to name, mode, amount and description are required; non-cash payments also require bank and reference. Each addition/deduction is stored in `lorry_hire_payment_adjustments`, linked to its payment with a type, description and amount. The payment retains immutable JSON snapshots for compatibility with the broker ledger. No POD confirmation is required.

Vouchers cannot be edited or deleted. Broker receipts can be reversed through the existing broker ledger; their CBS vouchers then show as reversed and stop reducing the balance. Direct-hire reversals are not provided in this release.

Validation: `npx tsc --noEmit`, ESLint for the new TypeScript files, and `scripts/test-lorry-hire.sql` against an empty disposable PostgreSQL database. The SQL test creates a minimal prerequisite schema, runs the migration, tests broker/direct advances, adjustments, mandatory payment details and overpayment rejection, and rolls back all changes.
