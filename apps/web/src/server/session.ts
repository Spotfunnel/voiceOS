import { cookies } from 'next/headers';

export type UserRole = 'customer' | 'operator';

export interface ServerSession {
  role: UserRole;
  tenantId: string | null;
  activeTenantId: string | null;
  tenantName: string | null;
  userId: string | null;
}

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || null;
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME || null;
const DEFAULT_ROLE = (process.env.DEFAULT_ROLE as UserRole | undefined) || 'customer';

function safeJsonParse<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getServerSession(): ServerSession {
  const cookieStore = cookies();
  const rawSession = cookieStore.get('sf_session')?.value || cookieStore.get('session')?.value;
  const session = safeJsonParse<Partial<ServerSession> & { tenantId?: string; activeTenantId?: string }>(rawSession);

  const role = (session?.role as UserRole | undefined) || DEFAULT_ROLE;
  const tenantId = session?.tenantId || DEFAULT_TENANT_ID;
  const activeTenantId = session?.activeTenantId || null;

  return {
    role,
    tenantId,
    activeTenantId,
    tenantName: session?.tenantName || DEFAULT_TENANT_NAME,
    userId: session?.userId || null,
  };
}

export function getDashboardTenant(session: ServerSession): string | null {
  if (session.role === 'operator') {
    return session.activeTenantId || session.tenantId || null;
  }
  return session.tenantId;
}
