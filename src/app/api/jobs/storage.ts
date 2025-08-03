// Shared in-memory storage for jobs
// In production, this would be replaced with a database

interface Job {
  id: string;
  userId: string;
  videoUrl: string;
  videoId: string | null;
  platform: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  options: any;
  error: string | null;
  summaryPath?: string;
  summary?: string;
}

let jobs: Job[] = [];

export function getJobs(): Job[] {
  return jobs;
}

export function addJob(job: Job): void {
  jobs.push(job);
}

export function updateJob(jobId: string, updates: Partial<Job>): Job | null {
  const jobIndex = jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) return null;
  
  jobs[jobIndex] = {
    ...jobs[jobIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  return jobs[jobIndex];
}

export function getJob(jobId: string): Job | null {
  return jobs.find(j => j.id === jobId) || null;
}

export function getUserJobs(userId: string): Job[] {
  return jobs.filter(job => job.userId === userId);
}