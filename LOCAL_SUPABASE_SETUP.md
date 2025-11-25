Local Supabase development setup
================================

This document explains how to run Supabase locally and configure the project to test the Supabase-based authentication flows on your machine before pushing changes to production.

1) Install Supabase CLI
---
- With npm (recommended):
  ```bash
  npm install -g supabase
  ```
- With Homebrew (macOS):
  ```bash
  brew install supabase/tap/supabase
  ```

2) Initialize a local supabase project
---
- Create a directory for your local supabase project (e.g., `supabase-local`) and run:
  ```bash
  mkdir supabase-local && cd supabase-local
  supabase init
  ```
- When the CLI asks, accept defaults. A `supabase` folder with `config.toml` will be created.

3) Start the Supabase dev stack
---
Run:
```bash
supabase start
```

This spins up a local Postgres DB, Auth, ~and additional services. The CLI will print or expose the anon and service role keys.

4) Get keys and configure the project
---
- In `supabase-local/config.toml` or via `supabase` CLI, retrieve `anon` and `service_role` keys. If not present, check the `docker-compose` logs printed by the CLI.
- Set these values in your locals:
  - Frontend: `frontend/src/environments/environment.ts` — `supabaseUrl` (http://localhost:54321), `supabaseAnonKey` (use the anon key), set `useSupabaseAuth: true`.
  - Backend: Add `SUPABASE_URL=http://localhost:54321` and `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>` to `backend/.env`.

5) Option A — Real Supabase local flow
---
- With Supabase running locally, frontend login is handled by Supabase. After login, Supabase returns a session token — `AuthService.syncWithBackend()` sends this token to `/api/auth/supabase/sync` in the backend. The backend will call `GET {SUPABASE_URL}/auth/v1/user` with the token and return a backend JWT.

6) Option B — Fast dev path with `TEST_BYPASS_SUPABASE`
---
If you quickly want to try the backend logic without running Supabase locally, set `TEST_BYPASS_SUPABASE=true` in `backend/.env` (already set by default in this repo's `backend/.env`). Then call the sync endpoint with a mock user as explained in `SUPABASE_AUTH.md`.

7) Start services
---
- Start the backend:
  ```bash
  cd backend
  npm install
  npm run dev
  ```
- Start the frontend:
  ```bash
  cd frontend
  npm install
  npm run start
  ```

8) Test your flows
---
- Login using the frontend UI (Supabase auth) or create a user using `supabase` CLI.
- If using the local Supabase service, use proper client keys and sign in from frontend. Then `AuthService.syncWithBackend()` should call `/api/auth/supabase/sync` and receive a backend JWT.
- Verify that the backend returns a backend token and that subsequent API calls for protected endpoints include `Authorization: Bearer <backend-token>`.

Invite flow testing
---
Once Supabase is running (or if `SUPABASE_SERVICE_ROLE_KEY` is set in backend .env), you can test the invite endpoint that we added to the backend:

```bash
curl -X POST http://localhost:3005/api/auth/invite \
 -H "Content-Type: application/json" \
 -d '{"email":"user@example.com","redirectTo":"http://localhost:4200/auth/login"}'
```

If your backend has `SUPABASE_SERVICE_ROLE_KEY` configured, Supabase will send an invite email to the address, otherwise you will get an error indicating the service key missing. If you're on the local Supabase stack, `supabase start` prints a Mailpit URL where you can see the outgoing invitation emails captured by Mailpit.

UI Upload flow test
---
1. Log in from the frontend using the Supabase flow or using the bypass mock user with the `admin` role.
2. With a token returned from the backend, visit the dashboard and confirm that the `Upload` menu or button is visible (requires `user_type: 'admin'` or `role: 'admin'`).
3. Go to the upload page, select a file and click `Enviar` (upload). The frontend will call the `POST /api/documents/upload` or the upload endpoint you configured. Check backend logs for Google Drive folder creation and file upload success.
4. You can inspect `uploads` volume or container logs to confirm files were saved/transferred.


Developer shortcuts for local testing (bypass)
---
If you enabled `TEST_BYPASS_SUPABASE=true` in `backend/.env`, you can simulate a Supabase user using a header or body to call the sync endpoint. Example `curl` to simulate a `admin` user and receive a backend token:

```bash
curl -X POST http://localhost:3005/api/auth/supabase/sync \
  -H "X-SUPABASE-MOCK-USER: $(echo -n '{\"id\": \"dev-001\", \"email\": \"admin.local@example.com\", \"user_metadata\": {\"name\": \"Local Admin\", \"role\": \"admin\", \"user_type\": \"admin\"}}' | base64)" \
  -H "Content-Type: application/json"
```

You should receive a backend response containing the new backend token and user payload in `data.token` and `data.user`. Use that backend token in `Authorization: Bearer <token>` to make protected API calls.


Security note: Never commit your `service_role` key or `SUPABASE_SERVICE_ROLE_KEY` to the repository. Treat it as a secret used only on the backend.
