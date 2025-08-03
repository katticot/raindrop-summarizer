'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Settings, 
  Video, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

interface SystemStatus {
  server: 'online' | 'offline';
  configured: boolean;
}

interface Job {
  id: string;
  title: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
}

export default function Home() {
  const [status, setStatus] = useState<SystemStatus>({
    server: 'offline',
    configured: false
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkSystemStatus();
    // Set up polling for job updates
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkSystemStatus = async () => {
    try {
      const [healthRes, configRes] = await Promise.all([
        fetch('/api/health').catch(() => null),
        fetch('/api/config/status').catch(() => null)
      ]);

      setStatus({
        server: healthRes?.ok ? 'online' : 'offline',
        configured: configRes?.ok ? (await configRes.json())?.configured ?? false : false
      });
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const fetchJobs = async () => {
    
    try {
      const res = await fetch('/api/jobs');
      if (res?.ok) {
        const data = await res.json();
        setJobs(data?.jobs || []);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e?.preventDefault();
    if (!videoUrl?.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });

      if (res?.ok) {
        setVideoUrl('');
        fetchJobs();
      } else {
        const error = await res?.json();
        alert(`Error: ${error?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StatusIndicator = ({ status: s, label }: { status: boolean | string, label: string }) => (
    <div className="flex items-center space-x-2">
      {s === true || s === 'online' ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : s === 'offline' ? (
        <AlertCircle className="h-5 w-5 text-red-500" />
      ) : (
        <Clock className="h-5 w-5 text-yellow-500" />
      )}
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={s === true || s === 'online' ? 'default' : 'destructive'}>
        {s === true ? 'Ready' : s === 'online' ? 'Online' : s === false ? 'Not Ready' : 'Offline'}
      </Badge>
    </div>
  );

  const JobStatusBadge = ({ status: s }: { status: string }) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      completed: 'outline',
      failed: 'destructive'
    } as const;
    
    return <Badge variant={variants[s as keyof typeof variants] || 'secondary'}>{s.toUpperCase()}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            🌧️ Raindrop Video Summarizer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Transform your video bookmarks into intelligent summaries with AI-powered insights
          </p>
        </header>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-beam">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <StatusIndicator status={status.server} label="Server" />
                <StatusIndicator status={status.configured} label="Configuration" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Video className="h-4 w-4 mr-2" />
                Processing Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Jobs</span>
                  <span className="font-semibold">{jobs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="font-semibold text-green-600">
                    {jobs.filter(j => j.status === 'completed').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Processing</span>
                  <span className="font-semibold text-blue-600">
                    {jobs.filter(j => j.status === 'processing').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  size="sm" 
                  className="w-full" 
                  onClick={() => window.location.href = '/videos'}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Video Library
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full" 
                  onClick={checkSystemStatus}
                  disabled={status.server === 'offline'}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
                <Button size="sm" variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
            <TabsTrigger value="create">➕ Create Job</TabsTrigger>
            <TabsTrigger value="jobs">🎬 Jobs</TabsTrigger>
            <TabsTrigger value="results">📚 Results</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Welcome to Raindrop Video Summarizer</CardTitle>
                <CardDescription>
                  Get started by processing your first video or explore your existing summaries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="font-semibold">🚀 Quick Start</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                    <li><strong>Configure:</strong> Set up environment variables in .env file</li>
                    <li><strong>Submit Video:</strong> Enter a YouTube video URL for processing</li>
                    <li><strong>Monitor Progress:</strong> Watch real-time processing updates</li>
                    <li><strong>View Results:</strong> Access your AI-generated summaries</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Processing Job</CardTitle>
                <CardDescription>
                  Submit a YouTube video URL to generate an AI-powered summary.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVideoSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="video-url" className="block text-sm font-medium mb-2">
                      YouTube Video URL
                    </label>
                    <Input
                      id="video-url"
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full magic-gradient"
                    disabled={isSubmitting || !status.configured}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4 mr-2" />
                        Process Video
                      </>
                    )}
                  </Button>
                  {!status.configured && (
                    <p className="text-sm text-red-600">Please configure the application first (check environment variables).</p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Jobs</CardTitle>
                <CardDescription>
                  Monitor your video processing jobs and their progress.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No jobs found. Create your first processing job to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <Card key={job.id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 mr-4">
                            <h4 className="font-medium truncate">{job.title || 'Video Processing'}</h4>
                            <p className="text-sm text-gray-500 truncate">{job.url}</p>
                          </div>
                          <JobStatusBadge status={job.status} />
                        </div>
                        
                        {job.status === 'processing' && (
                          <div className="space-y-2">
                            <Progress value={job.progress} className="h-2" />
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>Processing...</span>
                              <span>{job.progress}% complete</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                          <span>Created: {new Date(job.createdAt).toLocaleString()}</span>
                          {job.status === 'completed' && (
                            <Button size="sm" variant="outline">
                              View Summary
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Summaries</CardTitle>
                <CardDescription>
                  Browse and manage your AI-generated video summaries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Summary management interface coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}