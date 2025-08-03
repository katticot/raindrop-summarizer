import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { addJob, updateJob } from '../storage';

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

function validateVideoUrl(url: string): boolean {
  const youtubePatterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\//,
    /^https?:\/\/(www\.)?m\.youtube\.com\/watch\?v=/
  ];
  
  return youtubePatterns.some(pattern => pattern.test(url));
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /m\.youtube\.com\/watch\?v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

async function processVideoAsync(jobId: string, videoUrl: string) {
  try {
    // Update job status to processing
    updateJob(jobId, {
      status: 'processing',
      progress: 10
    });

    // Find Python executable
    const pythonPath = await findPythonExecutable();
    if (!pythonPath) {
      throw new Error('Python executable not found');
    }

    // Update progress
    updateJob(jobId, { progress: 25 });

    // Run Python summarizer
    const summaryResult = await runPythonSummarizer(pythonPath, videoUrl);
    
    // Update progress
    updateJob(jobId, { progress: 80 });

    // Save summary to file
    const outputDir = path.join(process.cwd(), 'summaries');
    await fs.mkdir(outputDir, { recursive: true });
    
    const videoId = extractVideoId(videoUrl);
    const summaryPath = path.join(outputDir, `${videoId}-summary.md`);
    await fs.writeFile(summaryPath, summaryResult);

    // Complete job
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      summaryPath,
      summary: summaryResult
    });

  } catch (error) {
    console.error('Video processing error:', error);
    updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function findPythonExecutable(): Promise<string | null> {
  const candidates = [
    path.join(process.env.HOME || '', '.local/pipx/venvs/google-cloud-aiplatform/bin/python'),
    'python3',
    'python'
  ];

  for (const candidate of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(candidate, ['--version'], { stdio: 'pipe' });
        child.on('close', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`Exit code ${code}`));
        });
        child.on('error', reject);
      });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function runPythonSummarizer(pythonPath: string, videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'video_summarizer.py');
    const child = spawn(pythonPath, [scriptPath, videoUrl], {
      stdio: 'pipe',
      env: { ...process.env }
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Python script failed with code ${code}: ${error}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check if Raindrop token is configured
    if (!process.env.RAINDROP_TOKEN) {
      return NextResponse.json(
        { error: 'Raindrop token not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { videoUrl, options = {} } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    if (!validateVideoUrl(videoUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube video URL' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(videoUrl);
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      userId: 'default', // Single user mode
      videoUrl,
      videoId,
      platform: 'YouTube',
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: `YouTube Video ${videoId}`,
      options,
      error: null
    };

    addJob(job);

    // Start actual video processing with Python summarizer
    processVideoAsync(jobId, videoUrl);

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        videoUrl: job.videoUrl,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt
      }
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}