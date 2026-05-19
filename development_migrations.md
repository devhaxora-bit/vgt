# Complete VGT Development Migrations (Since Branching)

This document contains a guide on how to update your main branch database with **all 19 database migrations** created since the `development` branch diverged from the `main` branch. 

To make this seamless, we have compiled all 19 migrations into a single, clean, chronological SQL script:
👉 **[all_development_migrations.sql](file:///Users/somnathkhadanga/code/freelance/vgt/vgt/all_development_migrations.sql)**

---

## What is included in this combined script?

The consolidated script contains the following 3 major database features in chronological order:

### 1. Party Ledger Hardening & Integrity (April 14 - April 21)
* **Hardens the accounting integrity**: Adds schema checks and strict constraints to guarantee child rows reference correct ledger accounts.
* **Adds Bill Allocation & Breakup support**: Allows billing records to have deduction items, settled amounts, and partial allocation receipts.
* **Historical Snapshots**: Creates JSON snapshots of consignments on the billing records.

### 2. Branch CN Range Management (April 27)
* **CN numbering**: Establishes the new range-based CN numbering system.
* **Physical copy exclusions**: Allows branches to reserve specific CN sub-ranges for physical books.
* **Helper functions**: Creates sequence auto-allocation and verification procedures (`next_available_branch_cn` and `advance_branch_cn_sequence`).

### 3. Challans, Brokers, and Vehicles Master Upgrade (May 9 - May 18)
* **Brokers Master**: Creates the new `brokers` table with Gin Indexes, RLS, and admin select controls.
* **Vehicles Master**: Creates the new `vehicles` table with full specifications, owner information, and TDS/ITDS details.
* **Challan Additions**: Alters the `challans` table to support loading/destination points, direct vs broker engagement styles, unloading charges, and truck reach date schedulers.
* **Consignment Additions**: Adds `traffic_challan_charges` to `consignments` table for tracking specific traffic challan expenses.

---

## How to Apply to Main/Production Database

1. Open the compiled **[all_development_migrations.sql](file:///Users/somnathkhadanga/code/freelance/vgt/vgt/all_development_migrations.sql)** in your editor.
2. Select all (`Cmd+A` or `Ctrl+A`) and copy it.
3. Paste the code into your **Supabase SQL Editor** on your main branch project.
4. Click **Run**.

Once it successfully executes, it will reload the PostgREST cache automatically via `NOTIFY pgrst, 'reload schema';` so your production dashboard functions seamlessly with all these updates!
