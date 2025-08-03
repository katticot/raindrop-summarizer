import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      server: 'Next.js'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}