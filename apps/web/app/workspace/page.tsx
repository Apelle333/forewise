import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { database } from '@/lib/db';
import { digest, sessionCookie } from '@/lib/auth';
import { Workspace } from '@/components/workspace';
export const metadata = { title: 'Your workspace — Forewise' };
export const dynamic = 'force-dynamic';
export default async function WorkspacePage() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect('/login');
  const db = await database();
  const session = await db.query(
    'SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',
    [digest(token)],
  );
  if (!session.rows.length) redirect('/login');
  return <Workspace />;
}
