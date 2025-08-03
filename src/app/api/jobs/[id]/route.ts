import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getJob } from '../storage';

function getAuthSession() {
  const cookieStore = cookies();
  const authCookie = cookieStore.get('auth-session');
  
  if (!authCookie?.value) {
    return null;
  }
  
  try {
    return JSON.parse(authCookie.value);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getAuthSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const job = getJob(params.id);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user owns this job
    if (job.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({ job });

  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Failed to get job' },
      { status: 500 }
    );
  }
}