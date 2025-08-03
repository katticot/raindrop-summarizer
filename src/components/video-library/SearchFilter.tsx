'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  X, 
  SortAsc, 
  SortDesc,
  Calendar,
  Tag as TagIcon
} from 'lucide-react';
import { VideoFilters, SortOption } from '@/services/video-metadata';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilter: (filters: VideoFilters) => void;
  onSort: (sort: SortOption) => void;
  availableTags: string[];
  totalVideos: number;
  filteredCount: number;
}

export function SearchFilter({
  onSearch,
  onFilter,
  onSort,
  availableTags,
  totalVideos,
  filteredCount
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<VideoFilters>({});
  const [sortOption, setSortOption] = useState<SortOption>({
    field: 'date',
    direction: 'desc'
  });

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const handleFilterChange = (key: keyof VideoFilters, value: any) => {
    const newFilters = { ...activeFilters };
    
    if (value === null || value === undefined || value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    setActiveFilters(newFilters);
    onFilter(newFilters);
  };

  const handleSortChange = (field: string) => {
    const newSort: SortOption = {
      field: field as any,
      direction: sortOption.field === field && sortOption.direction === 'desc' ? 'asc' : 'desc'
    };
    setSortOption(newSort);
    onSort(newSort);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveFilters({});
    setSortOption({ field: 'date', direction: 'desc' });
    onSearch('');
    onFilter({});
    onSort({ field: 'date', direction: 'desc' });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchQuery) count++;
    if (activeFilters.status?.length) count++;
    if (activeFilters.platform?.length) count++;
    if (activeFilters.tags?.length) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      {/* Search and Primary Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search videos by title, tags, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {getActiveFilterCount() > 0 && (
            <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
              {getActiveFilterCount()}
            </Badge>
          )}
        </Button>

        {/* Sort Controls */}
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortChange('date')}
            className={sortOption.field === 'date' ? 'bg-blue-50' : ''}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Date
            {sortOption.field === 'date' && (
              sortOption.direction === 'desc' ? 
              <SortDesc className="h-3 w-3 ml-1" /> : 
              <SortAsc className="h-3 w-3 ml-1" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortChange('title')}
            className={sortOption.field === 'title' ? 'bg-blue-50' : ''}
          >
            Title
            {sortOption.field === 'title' && (
              sortOption.direction === 'desc' ? 
              <SortDesc className="h-3 w-3 ml-1" /> : 
              <SortAsc className="h-3 w-3 ml-1" />
            )}
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredCount} of {totalVideos} videos
          {searchQuery && (
            <span className="ml-1">
              for "{searchQuery}"
            </span>
          )}
        </span>
        
        {getActiveFilterCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select
                value={activeFilters.status?.[0] || ''}
                onValueChange={(value) => 
                  handleFilterChange('status', value ? [value] : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Platform Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform
              </label>
              <Select
                value={activeFilters.platform?.[0] || ''}
                onValueChange={(value) => 
                  handleFilterChange('platform', value ? [value] : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All platforms</SelectItem>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                  <SelectItem value="Vimeo">Vimeo</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <Select
                value={activeFilters.tags?.[0] || ''}
                onValueChange={(value) => 
                  handleFilterChange('tags', value ? [value] : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tags</SelectItem>
                  {availableTags.slice(0, 20).map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {Object.keys(activeFilters).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active Filters
              </label>
              <div className="flex flex-wrap gap-2">
                {activeFilters.status?.map((status) => (
                  <Badge key={status} variant="secondary" className="flex items-center">
                    Status: {status}
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer" 
                      onClick={() => handleFilterChange('status', null)}
                    />
                  </Badge>
                ))}
                {activeFilters.platform?.map((platform) => (
                  <Badge key={platform} variant="secondary" className="flex items-center">
                    Platform: {platform}
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer" 
                      onClick={() => handleFilterChange('platform', null)}
                    />
                  </Badge>
                ))}
                {activeFilters.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center">
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer" 
                      onClick={() => handleFilterChange('tags', null)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}