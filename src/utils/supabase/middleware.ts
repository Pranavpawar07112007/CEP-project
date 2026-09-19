import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;

  // Public routes (no auth needed)
  const publicRoutes = ['/sign-in', '/sign-up', '/pending-approval', '/auth'];
  if (publicRoutes.some(r => pathname.startsWith(r)) || pathname === '/') {
    // If logged in and trying to access sign-in/sign-up, redirect to dashboard
    if (user && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // No user → redirect to sign-in
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Super Admin bypass: super admin can access /super-admin routes
  if (user.email === SUPER_ADMIN_EMAIL) {
    return supabaseResponse;
  }

  // For /super-admin routes, only super admin allowed
  if (pathname.startsWith('/super-admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check user profile status for dashboard access
  if (pathname.startsWith('/dashboard')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, society_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.status === 'PENDING') {
      const url = request.nextUrl.clone()
      url.pathname = '/pending-approval'
      url.searchParams.set('type', 'member')
      return NextResponse.redirect(url)
    }

    if (profile.status === 'REJECTED') {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }

    // Check if their society is active
    if (profile.society_id) {
      const { data: society } = await supabase
        .from('societies')
        .select('status, onboarding_completed')
        .eq('id', profile.society_id)
        .single();

      if (society && society.status !== 'ACTIVE') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending-approval'
        url.searchParams.set('type', 'society')
        return NextResponse.redirect(url)
      }

      // Check onboarding
      if (society && !society.onboarding_completed && pathname !== '/dashboard/setup') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/setup'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
