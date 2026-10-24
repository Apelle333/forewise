import { NextRequest, NextResponse } from 'next/server';
import { database } from './db';
import { digest, sessionCookie } from './auth';
import { BodyTooLargeError } from './body';

export class JobError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function jobSession(req: NextRequest) {
  const token = req.cookies.get(sessionCookie)?.value;
  if (!token) throw new JobError(401, 'Please sign in to continue.');
  const db = await database();
  const session = await db.query<{ user_id: string }>(
    'SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',
    [digest(token)],
  );
  if (!session.rows[0]) throw new JobError(401, 'Your session expired. Please sign in.');
  return { db, userId: session.rows[0].user_id };
}
export function jobError(error: unknown) {
  if (error instanceof JobError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof BodyTooLargeError)
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  console.error(
    'Forecast job request failed',
    error instanceof Error ? error.name : 'UnknownError',
  );
  return NextResponse.json({ error: 'Unable to process this job request.' }, { status: 500 });
}
