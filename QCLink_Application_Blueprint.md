# QCLink — Application Blueprint

**App name: QCLink**
A play on the fact that the whole system is a *linked chain* — an Item in Store
Master links to its QC spec in QC Master, which links to every Incoming
Inspection Report performed against it. The name should double as the product
name in the UI (logo/header text), page titles, and email/notification copy.

This document is the single reference spec for building the app in Antigravity.
It consolidates everything decided so far: the 3 core modules, the database
schema already created in MySQL (`Vezapp`), and the new requirements around
auth, admin control, field-level edit permissions, audit history, and
cross-module sync.

---

## 1. What this app replaces

Three existing Clappia apps become one cohesive web application:

| Clappia App | Becomes |
|---|---|
| Store Master | Item Master module |
| Incoming QC Master | QC Specification module |
| Incoming Inspection Report | Inspection module |

They are not independent — they form a pipeline:

```
Store Master (Item)
      │  1-to-1 (per item, one active QC template)
      ▼
QC Master (Spec Template, up to 30 parameter rows)
      │  copied/snapshotted at inspection time
      ▼
Inspection Report (Transaction, up to 30 result rows)
```

---

## 2. Users, Roles & Authentication

### 2.1 Signup & Approval Flow
- Signup form collects only: **Name, Email, Password**.
- New accounts are created with status `Pending` and **cannot log in** until an
  Admin approves them.
- On approval, status becomes `Active`. Admin can also `Reject` (status
  `Rejected`) or later `Deactivate` an active user.
- Passwords are hashed (bcrypt/argon2) — never stored in plain text.

### 2.2 Roles
Two roles for now, kept simple and extensible later:
- **Admin** — full access, see Section 4.
- **User** — normal app usage: create/view/edit submissions across the 3
  modules, subject to field-level edit rules (Section 5).

(The Responsibility dropdown values like "LAB INCHARGE" / "QC HEAD" are just
data values in a form field — not login roles. Don't conflate the two.)

### 2.3 Session Behavior — "stay logged in until logout"
- On successful login, issue a JWT (or session token) stored in an **HttpOnly,
  Secure cookie** with a long expiry (e.g. 30–90 days).
- Use a **sliding session**: each authenticated request quietly refreshes the
  token's expiry, so an active user is effectively never logged out on their
  own device.
- Explicit **Logout** button clears the cookie/token server-side (token
  blacklist or short-lived refresh-token rotation) and client-side.
- No "remember me" checkbox needed — persistence is the default behavior per
  your requirement.

### 2.4 `Users` and `UserSessions` tables — created

```
Users
- UserID (PK, auto)
- Name
- Email (unique)
- PasswordHash
- Role (ENUM: 'Admin','User')
- Status (ENUM: 'Pending','Active','Rejected','Deactivated')
- CreatedAt, UpdatedAt

UserSessions
- SessionID (PK, auto)
- UserID (FK -> Users)
- TokenHash          -- sha256 hash of the session/refresh token; never store
                         the raw token, so a DB leak doesn't leak usable tokens
- CreatedAt, ExpiresAt
- RevokedAt          -- set on logout; NULL = still valid
```

`UserSessions` exists specifically so **Logout can actually invalidate a
token server-side** — a bare stateless JWT can't be revoked on demand, which
would conflict with the "stay logged in until Logout is clicked" requirement.
Login flow: verify credentials → check `Status = 'Active'` → issue a token →
insert a `UserSessions` row → set the HttpOnly cookie. Every authenticated
request checks the session is not revoked and not expired, and slides
`ExpiresAt` forward. Logout sets `RevokedAt = NOW()` and clears the cookie.

Both tables are already created in the `Vezapp` database
(`vezapp_migration_002_users_and_ownership.sql`), along with converting the
`Owner` / `ChangedBy` text columns on `Items`, `QCMaster`,
`InspectionReports`, and `AuditLog` into proper `OwnerUserID` /
`ChangedByUserID` foreign keys pointing at `Users` — see Section 3 note
below.

---

## 3. The 3 Core Modules (recap, now with permission behavior)

Each module has:
- A **list view**: searchable/filterable/sortable table of all submissions.
- A **detail view**: opens one submission. System fields (UID, Submission ID,
  Owner, Created At, Updated At) are always **read-only/disabled**. Business
  fields follow the edit rules in Section 5.
- A **History** button on every submission (Section 6).

> **Owner is now `OwnerUserID`**, a foreign key into `Users` (not free text).
> The UI should display the resolved user's Name (join on read), and list
> views should support "filter by submitted-by-me" using the logged-in
> user's ID. Same applies to `AuditLog.ChangedByUserID`.

### 3.1 Store Master (Items)
List → Item UID, Item Name, Category, Current Stock, Min Level, Owner, Updated At.
Detail → all fields from the schema; validation on (Item Name + Category)
uniqueness still applies on edit, not just create.

### 3.2 QC Master
List → QCUID, Item Name, number of spec rows, Owner, Updated At.
Detail → header fields + editable repeating spec grid (add/remove rows up to
30, SrNo auto-managed).

### 3.3 Incoming Inspection Report
List → IIRUID, Item Name, Inspection Date, GRN No, Inspection Status, Owner.
Detail → header fields + repeating results grid (each row: copied spec fields
+ Actual + row Result). Actual input is conditionally shown/hidden based on
that row's Specification Criteria (hidden when "Other").

---

## 4. Admin Panel

A separate section (visible only to Admin role) with:

1. **User Approvals** — pending signups list, Approve/Reject actions; also a
   full user directory with Deactivate/Reactivate and role change.
2. **Master Data Manager** — CRUD screens for every dropdown/lookup table:
   Categories, Unit of Stock, Sub Categories, Specification Criteria, Method
   of Inspection, Frequency, Responsibility, Reaction Plan, Result Status.
   - Editing here should **never hard-delete** an option that's already in
     use — use the existing `IsActive` flag to retire options instead, so
     historical submissions referencing them still render correctly.
3. **Audit Log Viewer** — a global, filterable view over the `AuditLog` table
   (by module, by user, by date range) — useful for admin oversight beyond
   the per-submission History button.
4. **System Overview** (optional, nice-to-have) — dashboard counts: total
   items, active QC templates, inspections this month, pending user approvals.

---

## 5. Field-Level Edit Permissions

Rule for v1 (simple, deterministic — no per-field config UI needed yet):

- **Always locked** (system-managed, shown disabled in the UI): the UID
  (ItemUID/QCUID/IIRUID), Submission ID, Owner, Created At, Updated At.
- **Always editable** by the record's users: every business field entered at
  creation (Item Name, Category, Make, Size, Stock levels; QC spec rows;
  Inspection header + result rows).
- Saving a record only writes the fields that actually changed, and only
  those changed fields get logged to `AuditLog` (not a blanket "record
  updated" entry) — this keeps history genuinely useful.

*(If down the line you want per-role or per-field-configurable edit rules —
e.g. only Admin can edit Current Stock — that's a natural v2 addition once
the base app is working. Flagging as a future enhancement, not building it
into v1 unless you want to add it now.)*

---

## 6. History / Audit Trail

- Every submission detail view has a **History** button.
- Clicking it opens a modal/timeline showing all `AuditLog` rows for that
  record: **Field changed → Old value → New value → Changed by → When**,
  newest first.
- For child-row tables (QCSpecifications, InspectionResults), the history
  view should also surface row-level add/remove events, not just field edits.
- Cascaded updates (Section 7) also appear in history, attributed to the
  triggering user, with a note that it was a cascade (e.g. *"ItemName updated
  — cascaded from Store Master edit"*) so nothing looks like a mystery change.

---

## 7. Cross-Module Sync

**Requirement:** editing Item Name in Store Master must automatically update
the denormalized Item Name copies in QC Master and Inspection Report.

**Design:**
- This is implemented as an application-layer service function (not a raw DB
  trigger, so it can also write proper audit log entries) — e.g.
  `propagateItemNameChange(itemUID, newName, changedByUserID)`.
- Runs in the same DB transaction as the Store Master save:
  1. Update `Items.ItemName`.
  2. Update `QCMaster.ItemName` where `ItemUID` matches.
  3. Update `InspectionReports.ItemName` where `ItemUID` matches.
  4. Write one `AuditLog` row per table touched.
- **Important scope boundary:** this only syncs the *display label*
  (ItemName). It deliberately does **not** touch `InspectionResults` spec
  snapshots — those remain frozen at the time of inspection by design (see
  the schema notes), because a QC spec value used in Ammendment inspection
  months ago shouldn't silently change if today's QC Master template is
  edited. Only the human-readable Item Name — a label, not a compliance
  value — is safe to keep in sync everywhere.
- If ItemUID itself ever needs to change (unlikely, since it's the immutable
  primary key), that's a much bigger migration and out of scope for v1.

---

## 8. Suggested Tech Stack

Given the target is MySQL on AWS RDS and this will be built via Antigravity:

- **Frontend + Backend:** Next.js (App Router) — one codebase, React UI +
  API routes for the backend, easy to scaffold cleanly with an AI coding
  agent.
- **Database access:** `mysql2/promise` or Prisma ORM against the existing
  `Vezapp` MySQL database on AWS RDS.
- **Auth:** JWT in an HttpOnly cookie, or NextAuth with a Credentials
  provider wired to the `Users` table + bcrypt.
- **Styling/UI:** Tailwind CSS + a component library (shadcn/ui) for a clean,
  modern, consistent look with minimal custom CSS — sidebar navigation, card
  based dashboards, data tables with search/sort/pagination out of the box.
- **File uploads** (QC Master image, Inspection invoice): store on disk
  (`/uploads`) for MVP, or AWS S3 if you want it production-grade from day
  one since you're already on AWS.

---

## 9. Screen Inventory (for the Antigravity prompt)

1. Login
2. Signup
3. Pending-Approval notice screen (shown to users awaiting admin approval)
4. Dashboard (post-login landing page)
5. Store Master — List
6. Store Master — Create/Edit Detail
7. QC Master — List
8. QC Master — Create/Edit Detail (with repeating spec grid)
9. Inspection Report — List
10. Inspection Report — Create/Edit Detail (with repeating results grid,
    conditional Actual field)
11. History Modal (shared component, used from #6, #8, #10)
12. Admin — User Approvals
13. Admin — User Directory
14. Admin — Master Data Manager (tabbed by lookup table)
15. Admin — Audit Log Viewer

---

## 10. UI/UX Direction

- Clean, minimal, professional — not playful. This is an internal QC/ops
  tool, so clarity and speed of data entry matter more than decoration.
- Persistent left sidebar: Dashboard, Store Master, QC Master, Inspection
  Report, and (Admin-only) Admin Panel — with a small badge/count for
  pending user approvals if the logged-in user is an Admin.
- Tables: sticky header, search box, column sort, pagination, row click →
  opens detail view.
- Forms: grouped into labeled sections (matching the Clappia layout you
  already have — "Item Details", "QC Item", "Specification Details", etc.)
  so the transition feels familiar to existing users.
- Repeating grids (QC spec rows, inspection result rows): inline
  add-row/remove-row controls, SrNo auto-numbered, max 30 enforced with a
  clear message when hit.
- Disabled/locked fields should be visually distinct (greyed background) so
  users immediately understand why they can't type in them.
- Toast notifications for save success/failure, validation errors inline
  under each field.
- Fully responsive — should be usable on tablet at minimum, since QC/store
  staff may use it on the shop floor.

---

## 11. Open Items / Assumptions to Confirm Before Build

- ~~`Users` table~~ — done: `Users` + `UserSessions` created with just
  Name/Email/Password(+Role/Status) as scoped. If you later want phone
  number or department captured at signup, that's a simple additive column.
- File storage approach for Image/Invoice uploads — local disk vs. S3 — not
  yet decided.
- Whether Admin approval should trigger an email notification to the admin,
  or admin simply checks the panel periodically — not yet decided.
- No password-reset / forgot-password flow has been discussed yet — worth
  deciding before build since it's awkward to retrofit auth flows later.

---

## 12. Next Step

Once you confirm/adjust anything above, the next deliverable is the full,
detailed Antigravity build prompt — covering exact page-by-page requirements,
API endpoint list, validation rules, and the `Users` table DDL — generated
directly from this blueprint so nothing gets lost in translation.
