# Prompt: Odoo "004" Export → TFS Dashboard 2.0 Upload Workbook

Use this prompt (or the iterative loop version below) when asking Claude — or any assistant/developer — to build the workbook pipeline. Replace anything in `[square brackets]` with your real details before sending.

---

## One-shot prompt (recommended starting point)

> **Context**
>
> - **Source:** Our Odoo system produces a timesheet export we call **"004"** (`[exact report name / menu path in Odoo]`). It contains logged time entries: `[list the actual columns, e.g. Employee, Project, Task, Date, Hours, Description]`. Format: `[.xlsx / .csv]`. Attached is a sample export.
> - **Destination:** The **TFS Dashboard v2.0** (challenge app) is our reporting dashboard. It accepts data uploads in this format: `[attach the dashboard's upload template or describe its required columns/sheets]`.
>
> **Goal**
>
> Build a **workbook** (Excel) that transforms the raw Odoo 004 export into a file ready to upload to the TFS Dashboard — with **no manual reshaping** each time.
>
> **Requirements**
>
> 1. **Time allocation vs. actuals, per staff per project.** For every staff member working on a project or program, the workbook must have a column for their **allocated (planned) hours** alongside the **actual hours** from the Odoo timesheet export. Allocations come from `[where allocations live — a planning sheet, Odoo planning module, manual entry tab]`. When uploaded, each person's profile dashboard should show allocation matched against timesheet actuals.
> 2. **Repeatable refresh workflow.** The workbook must be built so that when we pull a fresh 004 export from Odoo, the update process is: **paste/import the new export → workbook recalculates → upload to the dashboard**. No re-writing formulas, no manual copy-editing of rows.
> 3. **Upload-ready output.** The output sheet must exactly match the TFS Dashboard 2.0 upload format (column names, order, data types, date formats) so it syncs on upload without errors.
>
> **Suggested structure** (adjust if you have a better design)
>
> - `RAW_004` — paste-target tab for the untouched Odoo export.
> - `ALLOCATIONS` — one row per staff × project with allocated hours per `[week/month]`.
> - `MAPPING` — lookup tables for anything that differs between systems (project names, employee IDs, program groupings).
> - `UPLOAD` — the formula-driven output tab, formatted exactly for TFS Dashboard upload, combining actuals (from RAW_004) and allocations.
>
> **Deliverables**
>
> 1. The workbook file with formulas/Power Query built in.
> 2. A short step-by-step refresh guide (export from Odoo → update workbook → upload to dashboard).
> 3. A note on any assumptions you made about column mappings so we can correct them.
>
> **Validation**
>
> Before finishing, verify with the attached sample export that: totals per employee in `UPLOAD` equal totals in `RAW_004`; every project in the export is mapped (flag unmapped ones, don't silently drop them); and allocation and actual columns align per staff per project.

---

## Loop version (iterate until the upload works)

If you're working interactively, run this as a cycle instead of one big ask:

1. **Round 1 — Understand the data.** "Here is a sample Odoo 004 export and the TFS Dashboard 2.0 upload template. List every column in each, propose a mapping between them, and tell me what's missing or ambiguous. Don't build anything yet."
2. **Round 2 — Confirm the design.** "Here are my answers to your questions. Now propose the workbook structure (tabs, formulas or Power Query, where allocations are entered) and the refresh workflow. Wait for my sign-off."
3. **Round 3 — Build.** "Approved. Build the workbook against the sample export."
4. **Round 4 — Test the upload.** "I uploaded the output to the TFS Dashboard. Here's what happened: `[errors / mismatches / screenshot]`. Fix and regenerate."
5. **Repeat round 4** until an upload syncs cleanly and profile dashboards show allocation vs. actuals correctly.
6. **Final round — Document.** "Write the one-page refresh guide for whoever runs this monthly."

---

## Why the original prompt underperformed (what was added)

- **Named the unknowns explicitly.** "Extract 004" and "TFS Dashboard 2.0" mean nothing without samples — the rewritten prompt demands the sample export and upload template up front, which is the single biggest quality lever.
- **Separated allocation from actuals.** The original mixed them mid-sentence; the rewrite makes "allocated hours per staff per project, matched against timesheet actuals" a numbered requirement with a defined data source.
- **Made repeatability a requirement, not a wish.** "Just upload to sync" is now a concrete workflow: paste new export → recalculate → upload, with no formula edits.
- **Added validation criteria.** Totals reconciliation and unmapped-project flagging catch the silent errors that make dashboard numbers untrustworthy.
- **Offered a loop.** Data-mapping work almost always needs a question round before the build round; the loop version bakes that in.
