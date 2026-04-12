import { supabase } from '@/lib/supabase';

export async function signOutWithRefresh(redirectPath = '/') {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } finally {
    // Force a hard navigation so auth state and UI are fully refreshed.
    window.location.replace(redirectPath);
  }
}
