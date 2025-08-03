import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const hasRaindropToken = !!process.env.RAINDROP_TOKEN;
    const hasGoogleProject = !!process.env.GOOGLE_CLOUD_PROJECT_ID;
    
    return NextResponse.json({
      configured: hasRaindropToken && hasGoogleProject,
      raindropConfigured: hasRaindropToken,
      googleCloudConfigured: hasGoogleProject,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check configuration' },
      { status: 500 }
    );
  }
}