# Local Auth Setup

## Fixed local origin

Use `http://localhost:3000` as the only local testing origin for Google login.

## Why

Google OAuth and Supabase redirect back to the same origin that started login. Mixing `3000` and `5500` causes redirect failures.

## Required dashboard settings

### Supabase

- `Authentication -> URL Configuration`
- `Site URL`: `https://it-class-tcwu.netlify.app`
- `Redirect URLs`:
  - `https://it-class-tcwu.netlify.app/*`
  - `http://localhost:3000/*`

### Google Cloud OAuth Client

- `Authorized JavaScript origins`:
  - `https://it-class-tcwu.netlify.app`
  - `http://localhost:3000`
- `Authorized redirect URIs`:
  - `https://upxgyusodibaqcrocdzj.supabase.co/auth/v1/callback`

## Local run

From the project root, run a local server on port `3000`, then open:

`http://localhost:3000/grade3/week05.html`

## Rule

If login starts from `localhost:3000`, the app must also finish on `localhost:3000`.
