import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type UserIdentity = {
  id: string;
  email: string | null;
  lastActive: string | null;
};

async function collectTableIdentities(client: any) {
  const identities = new Map<string, UserIdentity>();

  const { data: leaseData } = await client
    .from('leases')
    .select('user_id, created_at')
    .order('created_at', { ascending: false });

  for (const lease of leaseData ?? []) {
    if (!lease.user_id) continue;
    const existing = identities.get(lease.user_id);
    if (!existing) {
      identities.set(lease.user_id, {
        id: lease.user_id,
        email: null,
        lastActive: lease.created_at ?? null,
      });
    }
  }

  const { data: profilesData } = await client
    .from('profiles')
    .select('id, email, updated_at, created_at');

  for (const profile of profilesData ?? []) {
    const existing = identities.get(profile.id);
    if (existing) {
      identities.set(profile.id, {
        ...existing,
        email: profile.email ?? existing.email,
        lastActive: profile.updated_at ?? profile.created_at ?? existing.lastActive,
      });
    }
  }

  const { data: usersInfoData } = await client
    .from('users_info')
    .select('id, email, updated_at, created_at');

  for (const row of usersInfoData ?? []) {
    const existing = identities.get(row.id);
    if (existing) {
      identities.set(row.id, {
        ...existing,
        email: row.email ?? existing.email,
        lastActive: row.updated_at ?? row.created_at ?? existing.lastActive,
      });
    }
  }

  return Array.from(identities.values());
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon) {
      return NextResponse.json(
        { success: false, error: 'Supabase env not configured' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    const sessionClient = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // read-only in route handler
        },
      },
    });

    const { data: sessionData } = await sessionClient.auth.getUser();

    const roleFromMetadata = sessionData.user?.user_metadata?.role;
    const roleFromAppMetadata = sessionData.user?.app_metadata?.role;
    const isAdmin = roleFromMetadata === 'admin' || roleFromAppMetadata === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    if (!service) {
      const users = await collectTableIdentities(sessionClient);
      return NextResponse.json({
        success: true,
        users,
        warning: 'Service role key missing. Returned fallback users from table data only.',
      });
    }

    const adminClient = createClient(url, service);

    const identities = new Map<string, UserIdentity>();

    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      const users = await collectTableIdentities(sessionClient);
      return NextResponse.json({
        success: true,
        users,
        warning: `Auth admin listUsers failed: ${usersError.message}. Returned fallback users from table data only.`,
      });
    }

    for (const user of usersData.users ?? []) {
      identities.set(user.id, {
        id: user.id,
        email: user.email ?? user.user_metadata?.email ?? null,
        lastActive: user.last_sign_in_at ?? user.updated_at ?? user.created_at ?? null,
      });
    }

    const fallbackUsers = await collectTableIdentities(adminClient);
    for (const user of fallbackUsers) {
      const existing = identities.get(user.id);
      if (!existing) {
        identities.set(user.id, user);
      } else {
        identities.set(user.id, {
          ...existing,
          email: user.email ?? existing.email,
          lastActive: user.lastActive ?? existing.lastActive,
        });
      }
    }

    const users = Array.from(identities.values());
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
