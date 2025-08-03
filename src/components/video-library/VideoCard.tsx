'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  ExternalLink, 
  Trash2, 
  RefreshCw,
  Calendar,
  Tag,
  Eye
} from 'lucide-react';
import { Video } from '@/services/video-metadata';

interface VideoCardProps {
  video: Video;
  onView: (video: Video) => void;
  onDelete: (id: string) => void;
  onReprocess?: (id: string) => void;
}

export function VideoCard({ video, onView, onDelete, onReprocess }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(video.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
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

  const getThumbnailUrl = () => {
    if (imageError || !video.thumbnail) {
      return `https://via.placeholder.com/320x180/e2e8f0/64748b?text=YouTube`;
    }
    return video.thumbnail;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200 hover:border-gray-300">
      <CardHeader className="p-0">
        <div className="relative">
          <img
            src={getThumbnailUrl()}
            alt={video.title}
            className="w-full h-48 object-cover rounded-t-lg"
            onError={() => setImageError(true)}
          />
          <div className="absolute top-2 right-2">
            <Badge variant={getStatusColor(video.status)}>
              {video.status.toUpperCase()}
            </Badge>
          </div>
          {video.status === 'completed' && (
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-t-lg flex items-center justify-center">
              <Button
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onClick={() => onView(video)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Summary
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title */}
          <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight">
            {video.title}
          </h3>
          
          {/* Summary Preview */}
          {video.summary && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {video.summary}
            </p>
          )}
          
          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(video.createdAt)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>YouTube</span>
            </div>
          </div>
          
          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="flex items-start space-x-1">
              <Tag className="h-3 w-3 mt-1 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {video.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {video.tags.length > 3 && (
                  <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                    +{video.tags.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(video.url, '_blank')}
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Watch
              </Button>
              
              {video.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onView(video)}
                  className="text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Summary
                </Button>
              )}
            </div>
            
            <div className="flex space-x-1">
              {video.status === 'failed' && onReprocess && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReprocess(video.id)}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}