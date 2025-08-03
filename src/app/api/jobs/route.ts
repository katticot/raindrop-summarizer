import { NextRequest, NextResponse } from 'next/server';
import { getUserJobs } from './storage';

export async function GET() {
  try {
    // Check if Raindrop token is configured
    if (!process.env.RAINDROP_TOKEN) {
      return NextResponse.json(
        { error: 'Raindrop token not configured' },
        { status: 500 }
      );
    }

    // Get jobs for default user (single user mode)
    const userJobs = getUserJobs('default');
    
    return NextResponse.json({
      jobs: userJobs,
      batchJobs: [], // For compatibility
      total: userJobs.length
    });

  } catch (error) {
    console.error('List jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to list jobs' },
      { status: 500 }
    );
  }
}