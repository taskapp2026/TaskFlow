# TaskFlow — Todoist-inspired Enterprise Task Management

## Original Problem Statement
Build a modern, production-ready task management web application inspired by Todoist but designed for team collaboration, task tracking, and audit compliance.

## Architecture
- Frontend: React (CRA + craco) with Tailwind + Shadcn/UI, react-router-dom, sonner, recharts, framer-motion, date-fns
- Backend: FastAPI + Motor (Mongo async) + bcrypt + PyJWT + WebSockets
- Storage: Emergent object storage (attachments) with soft-delete
- Auth: JWT (httpOnly cookies + Bearer fallback), bcrypt hashing, admin auto-seed
- Realtime: WebSockets at /api/ws (token via cookie or ?token=)

## User Personas
- Admin: full control, RBAC-privileged; sees everything; can create/edit/disable staff, assign tasks, view audit trail and analytics.
- Staff: restricted to own tasks; can create/edit/complete personal tasks, upload attachments, comment, create labels.

## Core Requirements (static)
- Two roles: Admin, Staff with strict permission matrix.
- Task fields: name, description, assignee, priority (P1-P4), labels, due date/time, reminder.
- Global floating "+" create button always visible.
- Left sidebar with sections (per role).
- Task detail with tabs: Overview / Subtasks / Attachments / Comments / Activity Timeline.
- Immutable activity log (no delete/modify).
- Notifications (in-app + WebSocket real-time).
- Dashboards with charts and metrics.
- Dark & Light modes.

## What's Been Implemented (2026-02-09)
- JWT auth (login/logout/me), bcrypt hashing, admin seeding, httpOnly cookies.
- Users API (admin CRUD for staff).
- Tasks API (CRUD + filters: scope=today/upcoming/overdue/completed, priority, label, assignee, status, search, sort).
- Subtasks embedded in tasks.
- Labels CRUD (personal to owner).
- Comments (edit/delete by author or admin).
- Attachments via Emergent object storage (upload/download/soft-delete).
- Immutable activity/audit log per task and workspace-wide.
- Notifications (in-app + WS push, mark read/all read).
- Dashboards (personal + admin with per-user breakdown, priority chart).
- Real-time WebSocket for notifications.
- Full React UI: Login (split-screen), AppShell with sidebar & floating FAB, all pages, task detail with tabs, staff mgmt, audit logs, user-wise task view, settings/profile, theme toggle.
- Design system per /app/design_guidelines.json: Cabinet Grotesk + Satoshi + IBM Plex Mono fonts, Ultra-Marine primary, Swiss high-contrast palette.

## Backlog (P0/P1/P2)
### P1
- Rich text editor for description (currently plain textarea)
- Recurring reminders / custom recurring
- Drag-and-drop task reordering
- Global command bar (Cmd-K) & keyboard shortcuts
- User-wise Tasks: labels & recent comments columns polish
### P2
- @mentions in comments with linkification
- Bulk actions (multi-select, mass complete)
- CSV export / audit export
- Email/push notifications outside the app
- Rate limiting + lockout on /api/auth/login (currently no brute-force protection)
- CORS: replace `*` with explicit origins when using credentials
- Secure cookies (secure=True) driven by env for HTTPS prod
- Split server.py into routers for maintainability

## Test Credentials
See /app/memory/test_credentials.md
