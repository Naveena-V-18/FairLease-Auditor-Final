import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') ? next : '/'

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      const role = user?.user_metadata?.role

      // Google OAuth path does not pass through the signup form handler,
      // so we trigger welcome email once on first successful Google login.
      const provider = user?.app_metadata?.provider
      const welcomeSent = Boolean(user?.user_metadata?.google_welcome_sent)
      const userEmail = user?.email

      if (provider === 'google' && userEmail && !welcomeSent) {
        try {
          const extractedName = userEmail.split('@')[0] || 'User'
          const capitalizedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1)

          await fetch(`${origin}/api/send-welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              userName: capitalizedName,
            }),
          })

          await supabase.auth.updateUser({
            data: {
              ...user?.user_metadata,
              google_welcome_sent: true,
            },
          })
        } catch (welcomeError) {
          console.error('GOOGLE_WELCOME_MAIL_ERROR:', (welcomeError as Error).message)
        }
      }

      const targetPath = role === 'admin' ? '/admin' : safeNext
      const forwardTo = `${origin}${targetPath}`
      return NextResponse.redirect(forwardTo)
    }

    // LOG THE REAL ERROR TO YOUR TERMINAL
    console.error('AUTH_CALLBACK_ERROR:', error.message)
  }

  // If we reach here, something went wrong
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}