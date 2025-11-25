New: /api/auth/invite
--------------------
We added a backend endpoint to programmatically invite a user from your application UI:
- `POST /api/auth/invite` with `{ email, redirectTo? }` in request body.
- Requires `SUPABASE_SERVICE_ROLE_KEY` in the backend env. This will call `admin.inviteUserByEmail` and send an invitation email.
Example backend usage (already wired to the frontend):
- Frontend: `AuthService.invite(email)` will call `POST /api/auth/invite` using a backend JWT if present.

Invite a user
--------------
To invite a user, you can use the following code snippet:
```javascript
const { data, error } = await supabase.auth.admin.inviteUserByEmail('email@example.com');
```

Make sure to replace `email@example.com` with the actual email address of the user you want to invite.

This will send an invitation email to the specified address.
Supabase authentication integration
================================

Overview
--------
This project now supports Supabase Auth for the frontend. When `environment.useSupabaseAuth` is set to `true`, the login and register flows use Supabase's authentication. After a successful login or signup, the client will call the backend endpoint `/api/auth/supabase/sync` to sync or create a local backend user and obtain a backend token used by the backend API.

Frontend changes
-----------------
- Added the Supabase client at `frontend/src/app/shared/supabase/supabase.client.ts`.
- The frontend's `AuthService` will use Supabase auth when `environment.useSupabaseAuth` is `true`.
- `AuthService.login()` and `AuthService.register()` now support Supabase flows.
- New environment variables were added to `frontend/src/environments`:
  - `supabaseUrl`
  - `supabaseAnonKey`
  - `useSupabaseAuth`

Backend changes
---------------
- New API route `POST /api/auth/supabase/sync` was added to sync a Supabase token with local backend user records. The backend will call the Supabase user endpoint to retrieve user data and create a local user if not present.
- Environment variable `SUPABASE_URL` must be configured in backend env (e.g., `.env` or Docker environment). Example in `.env.example` and `docker-compose.yml`.

How it works
------------
1. User signs up or logs in on frontend (Supabase).
2. Supabase returns a session with an access token.
3. The frontend stores token and user data in localStorage and calls `/api/auth/supabase/sync` with the Supabase token in an Authorization header.
4. The backend validates the Supabase token by calling `GET {SUPABASE_URL}/auth/v1/user` with the token.
5. If user doesn't exist in the backend DB, it creates the user and returns the backend JWT for this user. The frontend stores the backend token if returned.

What you need to configure for production
------------------------------------------
1. Set frontend build envs on Vercel for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `USE_SUPABASE_AUTH`.
2. Set backend `SUPABASE_URL` environment variable and ensure the backend can reach the Supabase endpoint.
3. Optionally set up the backend to use Supabase service role (for admin operations). If you need to verify tokens using a supabase admin key, configure `SUPABASE_SERVICE_ROLE_KEY` in env and update the `auth.supabase.controller.js` to use it.

Note: With a `SUPABASE_SERVICE_ROLE_KEY` configured, the backend will include the `apikey` header when calling `GET {SUPABASE_URL}/auth/v1/user`. This does not mean the service role key is *used to verify* the token — it's still the user session validation endpoint. For production-grade verification you should implement JWKS token validation or a robust server-side inspection flow.

Security notes
--------------
- Be careful with `SUPABASE_SERVICE_ROLE_KEY` — treat as a secret only on the backend.
- Review authentication flows to ensure that user permissions and roles are synchronized across the frontend and backend.

Next steps and considerations
-----------------------------
- Implement more robust token verification on the backend using Supabase's JWKS (if you prefer token verification instead of calling the user endpoint).
- Implement a webhook on Supabase user creation to create or update backend users automatically.
- Add an Admin flow to manage users and roles in Supabase and mirror them in the backend.

Local development & testing
---------------------------
If you don't want to run a local Supabase instance to test integration, the backend includes a development bypass to help test flows locally (behind a flag):

- Set `TEST_BYPASS_SUPABASE=true` in `backend/.env`.
- Call `POST /api/auth/supabase/sync` with either a header `X-SUPABASE-MOCK-USER` containing a JSON or base64-encoded JSON with the user payload, or with a body `{ "mock_user": { ... } }`.
- Example mock user JSON:

  {
    "id": "dev-1234",
    "email": "admin.local@example.com",
    "user_metadata": {
      "name": "Local Admin",
      "role": "admin",
      "user_type": "admin",
      "municipality": "LocalCity"
    }
  }

This is strictly for local development and debugging — do not enable `TEST_BYPASS_SUPABASE` in production.
