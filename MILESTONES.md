# TaskFlow Production Milestone Plan

## 1. Project Summary

This project is a full-stack task management web application built with a React frontend, a FastAPI backend, and MongoDB as the primary database.

The application is designed for team-based task management with separate admin and staff roles. Based on the current repository state, the product already includes the following major modules:

- Authentication and role-based access control
- Staff/user management
- Task creation, assignment, filtering, and completion
- Subtasks
- Labels
- Comments
- Attachments / file upload
- Notifications
- Dashboard and reporting views
- Audit/activity logs
- Theme and profile/settings pages

The codebase is already feature-rich and close to MVP completeness, but it still requires environment setup, controlled testing, production hardening, deployment work, and launch validation before it should be considered production-ready.

## 2. Current Status

### Completed or largely implemented

- Separate frontend and backend application structure is already present.
- Backend API includes authentication, user management, tasks, labels, comments, attachments, activity logs, notifications, dashboard, and WebSocket support.
- Frontend includes protected routes, login, task list pages, task detail pages, staff management, dashboard, notifications, labels, audit logs, and user-focused task views.
- MongoDB connection and startup indexes are already implemented.
- Admin seeding is already implemented on backend startup.
- Core admin/staff task assignment and visibility logic appears to be implemented in backend task querying and task creation.
- Backend integration tests are present and previously reported as passing for core role-based task flows.

### Incomplete, risky, or production-blocking

- No usable root-level project setup documentation is present.
- No confirmed shared `.env` files or `.env.example` files are included.
- Frontend requires `REACT_APP_BACKEND_URL`; if this is missing or wrong, API communication fails.
- Backend depends on environment variables for MongoDB, JWT, and runtime configuration.
- File upload depends on Cloudflare R2 configuration; without it, attachment functionality will fail.
- Authentication cookies are not yet production-safe because cookie security settings are currently development-oriented.
- CORS configuration is not production-safe as currently written.
- Refresh token issuance exists, but refresh-token renewal flow is not implemented.
- Frontend and backend integration still need real environment validation using actual runtime settings.
- Deployment configuration files are not present for common production platforms.
- Some pages exist but remain lightweight from a production usage perspective, especially settings/profile management.
- WebSocket notifications should be validated carefully in deployment because real-time behavior is sensitive to hosting and origin configuration.

## 3. Milestone Plan

## Milestone 1: Environment Setup and Local Project Bootstrapping

**Objective**

Establish a working local development environment for both frontend and backend using fresh environment configuration and a working MongoDB instance.

**Scope of Work**

- Review and confirm required runtime tools and versions
- Create working backend and frontend environment files
- Provision a MongoDB database connection
- Install backend and frontend dependencies
- Start backend locally
- Start frontend locally
- Perform first smoke test of login, route protection, and API communication

**Deliverables**

- Working local backend server
- Working local frontend server
- Initial `.env` configuration for local development
- Verified database connection
- Initial smoke-test confirmation

**Dependencies**

- Access to required environment values or approval to create new local values
- MongoDB instance, local or Atlas
- Python runtime
- Node.js runtime
- Package manager support for frontend

**Risks / Blockers**

- Missing frontend/backend environment variables
- Missing or invalid MongoDB connection string
- Missing storage credential if attachment testing is required
- Local machine missing Yarn or package manager support

**Estimated Time**

`1 to 2 working days`

## Milestone 2: Database Setup and Backend Connection

**Objective**

Stabilize backend runtime against a reliable MongoDB database and verify all primary collections, indexes, and seeded admin behavior.

**Scope of Work**

- Confirm whether MongoDB local or MongoDB Atlas will be used
- Validate backend connection, database selection, and collection creation
- Verify startup indexes and admin seeding behavior
- Check user, tasks, labels, comments, activity, notifications, and attachment metadata writes
- Confirm safe approach for development/test data separation

**Deliverables**

- Verified backend-to-database connectivity
- Confirmed collection behavior and indexes
- Documented environment requirements for database
- Recommendation for dev/staging/production database separation

**Dependencies**

- Milestone 1 completion
- MongoDB instance with valid connection string

**Risks / Blockers**

- Production database access may be unavailable or unsafe for test writes
- Existing client database may contain live data and require a dedicated test database

**Estimated Time**

`1 working day`

## Milestone 3: Backend Testing, Validation, and Stabilization

**Objective**

Validate the backend API against actual runtime conditions and close stability gaps before broader frontend verification and deployment.

**Scope of Work**

- Run backend integration tests against the chosen environment
- Verify auth, user management, task assignment, task visibility, subtasks, comments, notifications, and dashboards
- Validate error handling and role restrictions
- Review attachment behavior if storage credentials are available
- Resolve backend defects discovered during live testing

**Deliverables**

- Backend test execution report
- List of backend defects found and resolved
- Stable backend environment suitable for frontend integration testing

**Dependencies**

- Milestone 1 and 2 completion
- Testable database
- Storage key if attachments are in scope

**Risks / Blockers**

- Existing tests may require environment adjustment
- Storage-dependent flows may remain blocked without client credentials
- Real deployment issues may expose auth/cors/session defects not visible locally

**Estimated Time**

`1 to 2 working days`

## Milestone 4: Frontend-Backend Integration and User Flow Testing

**Objective**

Validate that the React frontend correctly communicates with the FastAPI backend across all critical user flows.

**Scope of Work**

- Verify frontend API connectivity using actual `REACT_APP_BACKEND_URL`
- Test admin login and staff login
- Test admin creates staff user
- Test admin assigns task to staff
- Test staff can view assigned tasks
- Test staff can create own task
- Test admin can view all tasks including staff-created tasks
- Validate task detail, comments, labels, subtasks, notifications, and dashboard flows
- Identify UI/API mismatches or route issues

**Deliverables**

- Confirmed end-to-end user flow validation for core business requirements
- Frontend/backend integration issue list
- Fixes for broken or inconsistent flows

**Dependencies**

- Milestone 3 completion
- Running backend and frontend environments

**Risks / Blockers**

- Misconfigured frontend env values
- Session/cookie issues across frontend/backend origins
- WebSocket behavior may differ from standard REST behavior

**Estimated Time**

`1 to 2 working days`

## Milestone 5: Bug Fixing, Edge-Case Handling, and Production Hardening

**Objective**

Fix defects discovered during testing and address the most important production-readiness gaps in security, stability, and runtime behavior.

**Scope of Work**

- Fix auth and session issues
- Fix CORS and cookie configuration for deployment
- Verify admin/staff access restrictions under edge cases
- Validate user deletion and task ownership behavior
- Review file upload failure cases and fallback behavior
- Validate task filtering and data visibility rules
- Address production-sensitive issues such as default credentials, missing environment protection, and deployment-specific integration risks

**Deliverables**

- Resolved defect list
- Hardened runtime configuration for production
- Verified stable user-role behavior across key flows

**Dependencies**

- Milestone 4 completion
- Clear deployment target and domain plan

**Risks / Blockers**

- Hidden integration issues may appear only after deployment
- Attachment storage may require vendor-specific setup
- Some issues may require scope decisions from the owner

**Estimated Time**

`2 to 4 working days`

## Milestone 6: Deployment Setup and Production Release

**Objective**

Deploy the application to a production-ready environment and connect the full stack using live configuration.

**Scope of Work**

- Choose production hosting stack for frontend, backend, and database
- Configure environment variables in deployment platform(s)
- Deploy backend service
- Deploy frontend application
- Connect frontend to deployed backend
- Configure production database
- Validate storage/integration credentials if attachments are required
- Perform release smoke test on live deployment

**Deliverables**

- Live deployed backend
- Live deployed frontend
- Working production environment configuration
- Initial release validation checklist

**Dependencies**

- Milestone 5 completion
- Production hosting accounts
- Production environment values
- Final database decision

**Risks / Blockers**

- CORS/session/cookie issues in live domains
- Hosting limitations for WebSockets or long-lived connections
- Missing storage/service credentials
- DNS or domain availability delays

**Estimated Time**

`1 to 2 working days`

## Milestone 7: Post-Deployment Verification and Handover

**Objective**

Verify the live environment after deployment and hand over the project in a maintainable state.

**Scope of Work**

- Test live admin/staff flows end to end
- Verify login, task assignment, visibility, dashboard, notifications, and attachments if included
- Document run/deploy basics
- Deliver environment/config guidance to owner
- Capture known limitations and recommended next improvements

**Deliverables**

- Post-deployment validation report
- Handover notes
- Known issues / next-step recommendations

**Dependencies**

- Milestone 6 completion

**Risks / Blockers**

- Late-stage live issues may require a short stabilization pass
- Missing client-side documentation expectations may expand scope

**Estimated Time**

`1 working day`

## 4. Detailed Milestone 1 Breakdown

Milestone 1 is the foundation milestone and should be completed before any feature-level commitments are made.

### Step 1: Confirm Required Software and Tools

Install or confirm the following are available on the working machine:

- `Python 3.11.x`
- `pip`
- `virtualenv` or Python `venv`
- `Node.js` (preferably LTS, confirm compatibility with current frontend dependencies)
- `Yarn 1.x` or a compatible package-manager approach for this repository
- Git

Current repository notes:

- Python runtime hint exists in [runtime.txt](./runtime.txt)
- Frontend package manager is declared as Yarn 1 in [frontend/package.json](./frontend/package.json)

### Step 2: Decide Database Approach

Recommended option for Milestone 1:

- Use **MongoDB Atlas** instead of local MongoDB unless there is a strong reason to stay fully local.

Why Atlas is recommended for this project:

- Faster setup for a fresh environment
- Easier migration path toward staging/production
- Avoids local MongoDB installation complexity
- Useful when client does not already provide a local database

Alternative:

- Use local MongoDB only if local-first development is a strict requirement or internet access is constrained.

### Step 3: Create MongoDB Atlas Account and Cluster

If Atlas is used:

1. Create a MongoDB Atlas account
2. Create a free cluster for development/testing
3. Create a database user
4. Allow access from the working IP address, or temporarily allow broader access for development if necessary
5. Copy the MongoDB connection string
6. Choose a development database name, for example `taskflow_dev`

### Step 4: Create Backend Environment File

Create `backend/.env` with at minimum:

```env
MONGO_URL=<mongodb-connection-string>
DB_NAME=taskflow_dev
JWT_SECRET=<long-random-secret>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<temporary-admin-password>
CORS_ORIGINS=http://localhost:3000
APP_NAME=taskflow
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_REGION=auto
MAX_ATTACHMENT_SIZE_BYTES=104857600
```

Notes:

- `MONGO_URL`, `DB_NAME`, and `JWT_SECRET` are required by the backend
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` control the seeded admin account
- R2 variables are required if attachment upload/download is expected in local testing

### Step 5: Create Frontend Environment File

Create `frontend/.env` with:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

This value is required because the frontend builds its API base URL from this environment variable.

### Step 6: Install Backend Dependencies

From the `backend` directory:

1. Create a Python virtual environment
2. Activate it
3. Install dependencies from `requirements.txt`

Expected result:

- Backend dependencies install without unresolved package errors

### Step 7: Start Backend Locally

Run the FastAPI backend with auto-reload.

Expected result:

- Backend starts successfully
- MongoDB connection succeeds
- Startup indexes are created
- Admin account is seeded if not already present

Primary checks:

- API server responds
- No immediate environment-variable startup failure
- No immediate MongoDB connection failure

### Step 8: Install Frontend Dependencies

From the `frontend` directory:

1. Install packages using Yarn-compatible setup
2. Resolve any local package manager issues before continuing

Expected result:

- Frontend dependencies install successfully

### Step 9: Start Frontend Locally

Run the React application locally.

Expected result:

- Frontend opens in the browser
- Login page renders
- Frontend attempts API calls to the configured backend

### Step 10: Perform First Smoke Test

Minimum smoke test for Milestone 1:

1. Open the frontend login page
2. Log in using the seeded admin account
3. Confirm that the protected app shell loads
4. Confirm task list page renders without a backend connectivity error
5. Open staff management or dashboard page
6. Confirm backend data can be read from the frontend

Optional smoke test if enough time remains:

1. Create one staff user
2. Create one task from admin account
3. Confirm task appears in task list

### Expected Output at the End of Milestone 1

Milestone 1 should end with the following outcome:

- The backend runs locally
- The frontend runs locally
- The frontend can communicate with the backend
- MongoDB is connected and writable
- Admin login works
- The app is ready for controlled backend and user-flow testing in Milestone 2 and beyond

## 5. Production Readiness Notes

### Security fixes needed

- Move auth cookies to production-safe settings
- Replace permissive/default CORS behavior with explicit production origins
- Remove any dependence on default admin credentials in live environments
- Review token/session handling and implement or finalize refresh-token strategy
- Review query-token based attachment access usage and confirm acceptable production policy

### Deployment prerequisites

- Final decision on hosting stack for frontend, backend, and database
- Final production environment variables
- Final database connection and access policy
- Storage credential availability if attachments must work
- Domain/origin planning for frontend-backend communication

### Testing gaps

- Real environment testing with final deployment domains
- Live WebSocket validation
- Attachment validation with real storage credentials
- Frontend regression testing for critical user flows
- Session expiry and re-login handling

### Documentation gaps

- Root project setup documentation
- Environment variable documentation
- Deployment instructions
- Runbook for local development and basic maintenance

### Infrastructure decisions still needed

- MongoDB local vs Atlas for non-production work
- Production backend hosting platform
- Production frontend hosting platform
- Production file storage strategy if current storage dependency is unavailable or unsuitable
- Staging environment requirement or direct production deployment approach

## 6. Estimated Total Timeline

### Basic MVP Launch

For a launch focused on the main business flow only:

- Admin login
- Staff login
- Admin creates staff
- Admin assigns tasks
- Staff views tasks
- Staff creates own tasks
- Admin sees all tasks

Estimated total:

`5 to 8 working days`

### Proper Production-Ready Launch

For a safer launch that includes stronger validation, production hardening, and a clean handover:

Estimated total:

`8 to 14 working days`

This second estimate is more realistic if deployment, security adjustments, storage validation, and live issue resolution are included in scope.

## 7. Quote Guidance

This project is well suited to milestone-based quoting rather than a single blanket estimate.

Recommended commercial structure:

- **Milestone-based engagement**
  - Useful when environment setup, deployment choices, and hidden defects are still uncertain

- **MVP launch hardening package**
  - Covers setup, testing, bug fixing, integration validation, and launch of the core admin/staff workflow

- **Deployment and handover as a separate milestone**
  - Recommended when live infrastructure, storage credentials, domain setup, or post-launch checks are expected to vary

Suggested pricing structure approach:

- Milestone 1 and Milestone 2 can be quoted as setup and technical discovery
- Milestone 3 to Milestone 5 can be quoted as stabilization and launch preparation
- Milestone 6 and Milestone 7 can be quoted as deployment and handover

This structure protects both execution quality and budget predictability, especially if hidden integration or infrastructure issues are discovered after first runtime setup.
