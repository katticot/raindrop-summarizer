'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Trash2, 
  RefreshCw,
  Calendar,
  Clock,
  Tag as TagIcon,
  Download,
  Copy,
  X
} from 'lucide-react';
import { Video } from '@/services/video-metadata';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface VideoDetailModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onReprocess?: (id: string) => void;
}

export function VideoDetailModal({
  video,
  isOpen,
  onClose,
  onDelete,
  onReprocess
}: VideoDetailModalProps) {
  const [fullSummary, setFullSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (video && isOpen) {
      fetchFullSummary();
    }
  }, [video?.id, isOpen]);

  const fetchFullSummary = async () => {
    if (!video) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/videos/${video.id}`);
      if (response.ok) {
        const data = await response.json();
        setFullSummary(data.video.fullSummary || '');
      } else {
        console.error('Failed to fetch full summary');
      }
    } catch (error) {
      console.error('Error fetching full summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!video) return;
    
    if (!confirm('Are you sure you want to delete this video summary? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(video.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = async () => {
    if (video?.url && navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(video.url);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  const handleExportSummary = () => {
    if (!fullSummary || !video || typeof window === 'undefined') return;

    try {
      const blob = new Blob([fullSummary], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.videoId}_summary.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export summary:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'pending': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl leading-tight pr-8">
                {video.title}
              </DialogTitle>
              <DialogDescription className="mt-2 space-y-2">
                <div className="flex items-center space-x-4">
                  <Badge variant={getStatusColor(video.status)}>
                    {video.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    YouTube
                  </span>
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Video Metadata */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Created:</span>
                <span>{formatDate(video.createdAt)}</span>
              </div>
              
              {video.processedAt && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Processed:</span>
                  <span>{formatDate(video.processedAt)}</span>
                </div>
              )}
              
              {video.metadata.wordCount && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Word Count:</span>
                  <span>{video.metadata.wordCount.toLocaleString()}</span>
                </div>
              )}
              
              {video.metadata.fileSize && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">File Size:</span>
                  <span>{(video.metadata.fileSize / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <TagIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-sm">Tags:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Content */}
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Summary</h3>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportSummary}
                  disabled={!fullSummary}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
            
            <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-white">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading summary...</div>
                </div>
              ) : fullSummary ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {fullSummary}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-gray-500">No summary content available</div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => window.open(video.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Watch Video
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCopyLink}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>

            <div className="flex space-x-2">
              {video.status === 'failed' && onReprocess && (
                <Button
                  variant="outline"
                  onClick={() => onReprocess(video.id)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocess
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
              
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}