import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  let keepSignedIn = true;
  if (typeof window !== 'undefined') {
    keepSignedIn = localStorage.getItem('keepSignedIn') !== 'false';
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // If keepSignedIn is true, maxAge is set to 1 year (in seconds)
        // If false, it's undefined, which makes it a session cookie (cleared when browser closes)
        maxAge: keepSignedIn ? 365 * 24 * 60 * 60 : undefined,
      }
    }
  )
}
