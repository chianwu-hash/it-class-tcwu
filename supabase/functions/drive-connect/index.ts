import { createHandler } from './handler.mjs';

// JWT verification is performed against Supabase Auth inside the handler.
// This supports the project's publishable key and asymmetric user JWTs.
Deno.serve(createHandler({ env: (name: string) => Deno.env.get(name) }));
