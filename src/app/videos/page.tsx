'use client';

import { useState, useEffect, useCallback } from 'react';
import { VideoCard } from '@/components/video-library/VideoCard';
import { SearchFilter } from '@/components/video-library/SearchFilter';
import { VideoDetailModal } from '@/components/video-library/VideoDetailModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoFilters, 
  SortOption 
} from '@/services/video-metadata';
import { 
  ChevronLeft, 
  ChevronRight, 
  Grid3X3, 
  List,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface PaginatedResponse {
  success: boolean;
  videos: Video[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const limit = 20;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<VideoFilters>({});
  const [sortOption, setSortOption] = useState<SortOption>({
    field: 'date',
    direction: 'desc'
  });

  const fetchVideos = useCallback(async (
    page: number = 1,
    search: string = '',
    currentFilters: VideoFilters = {},
    sort: SortOption = { field: 'date', direction: 'desc' }
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sort.field,
        sortOrder: sort.direction
      });

      if (search) params.append('search', search);
      if (currentFilters.status?.[0]) params.append('status', currentFilters.status[0]);
      if (currentFilters.platform?.[0]) params.append('platform', currentFilters.platform[0]);

      const response = await fetch(`/api/videos?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data: PaginatedResponse = await response.json();
      
      setVideos(data.videos);
      setTotalVideos(data.total);
      setCurrentPage(data.page);
      setHasNext(data.hasNext);
      setHasPrev(data.hasPrev);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const fetchTags = async () => {
    try {
      // Extract tags from current videos for now
      // In a real implementation, this could be a separate API endpoint
      const allTags = videos.flatMap(video => video.tags);
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  useEffect(() => {
    fetchVideos(currentPage, searchQuery, filters, sortOption);
  }, [fetchVideos, currentPage]);

  useEffect(() => {
    fetchTags();
  }, [videos]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    fetchVideos(1, query, filters, sortOption);
  }, [filters, sortOption, fetchVideos]);

  const handleFilter = useCallback((newFilters: VideoFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    fetchVideos(1, searchQuery, newFilters, sortOption);
  }, [searchQuery, sortOption, fetchVideos]);

  const handleSort = useCallback((newSort: SortOption) => {
    setSortOption(newSort);
    setCurrentPage(1);
    fetchVideos(1, searchQuery, filters, newSort);
  }, [searchQuery, filters, fetchVideos]);

  const handleViewVideo = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      // Refresh the current page
      fetchVideos(currentPage, searchQuery, filters, sortOption);
      
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video. Please try again.');
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchVideos(newPage, searchQuery, filters, sortOption);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Videos</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchVideos(currentPage, searchQuery, filters, sortOption)}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Video Library
          </h1>
          <p className="text-gray-600">
            Browse and manage your processed video summaries
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <SearchFilter
            onSearch={handleSearch}
            onFilter={handleFilter}
            onSort={handleSort}
            availableTags={availableTags}
            totalVideos={totalVideos}
            filteredCount={videos.length}
          />
        </div>

        {/* View Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">View:</span>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Results Summary */}
          <div className="text-sm text-gray-600">
            {isLoading ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <span>
                Page {currentPage} of {Math.ceil(totalVideos / limit)} 
                ({totalVideos} total videos)
              </span>
            )}
          </div>
        </div>

        {/* Videos Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              {searchQuery || Object.keys(filters).length > 0 
                ? 'No videos found matching your criteria' 
                : 'No videos found'}
            </div>
            {(searchQuery || Object.keys(filters).length > 0) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilters({});
                  fetchVideos(1, '', {}, sortOption);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onView={handleViewVideo}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalVideos > limit && (
          <div className="flex items-center justify-center space-x-4 mt-8">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!hasPrev || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(5, Math.ceil(totalVideos / limit)) }, (_, i) => {
                const pageNum = currentPage - 2 + i;
                if (pageNum < 1 || pageNum > Math.ceil(totalVideos / limit)) return null;
                
                return (
                  <Button
                    key={pageNum}
                    size="sm"
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                );
              }).filter(Boolean)}
            </div>
            
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasNext || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Video Detail Modal */}
        <VideoDetailModal
          video={selectedVideo}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVideo(null);
          }}
          onDelete={handleDeleteVideo}
        />
      </div>
    </div>
  );
}