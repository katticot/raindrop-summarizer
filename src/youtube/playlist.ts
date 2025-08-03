export interface YouTubePlaylistVideo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  position: number;
  videoId: string;
}

export interface YouTubePlaylistInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  itemCount: number;
  videos: YouTubePlaylistVideo[];
}

export interface YouTubeAPIConfig {
  apiKey: string;
  maxResults?: number;
}

export class YouTubePlaylistLister {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';
  private maxResults: number;

  constructor(config: YouTubeAPIConfig) {
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults || 50;
  }

  async getPlaylistInfo(playlistId: string): Promise<YouTubePlaylistInfo> {
    const url = `${this.baseUrl}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${this.apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist info: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    const playlist = data.items[0];
    return {
      id: playlist.id,
      title: playlist.snippet.title,
      description: playlist.snippet.description,
      channelTitle: playlist.snippet.channelTitle,
      publishedAt: playlist.snippet.publishedAt,
      itemCount: playlist.contentDetails.itemCount,
      videos: []
    };
  }

  async getPlaylistVideos(playlistId: string): Promise<YouTubePlaylistVideo[]> {
    const videos: YouTubePlaylistVideo[] = [];
    let nextPageToken: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/playlistItems`);
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('playlistId', playlistId);
      url.searchParams.set('maxResults', this.maxResults.toString());
      url.searchParams.set('key', this.apiKey);
      
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch playlist videos: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const item of data.items || []) {
        if (item.snippet.resourceId?.kind === 'youtube#video') {
          videos.push({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            channelTitle: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            position: item.snippet.position,
            videoId: item.snippet.resourceId.videoId
          });
        }
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return videos;
  }

  async getCompletePlaylist(playlistId: string): Promise<YouTubePlaylistInfo> {
    const [playlistInfo, videos] = await Promise.all([
      this.getPlaylistInfo(playlistId),
      this.getPlaylistVideos(playlistId)
    ]);

    return {
      ...playlistInfo,
      videos
    };
  }

  static extractPlaylistId(url: string): string | null {
    const patterns = [
      /[?&]list=([a-zA-Z0-9_-]+)/,
      /\/playlist\?list=([a-zA-Z0-9_-]+)/,
      /^([a-zA-Z0-9_-]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  static isValidPlaylistId(playlistId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(playlistId) && playlistId.length > 10;
  }

  async searchPlaylists(query: string, maxResults = 10): Promise<YouTubePlaylistInfo[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'playlist');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to search playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return (data.items || []).map((item: any) => ({
      id: item.id.playlistId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      itemCount: 0,
      videos: []
    }));
  }

  async listUserPlaylists(channelId?: string, mine = false, maxResults = 50): Promise<YouTubePlaylistInfo[]> {
    const playlists: YouTubePlaylistInfo[] = [];
    let nextPageToken: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/playlists`);
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('maxResults', Math.min(maxResults, 50).toString());
      url.searchParams.set('key', this.apiKey);
      
      if (mine) {
        url.searchParams.set('mine', 'true');
      } else if (channelId) {
        url.searchParams.set('channelId', channelId);
      } else {
        throw new Error('Either channelId or mine=true must be specified');
      }
      
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const item of data.items || []) {
        playlists.push({
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          itemCount: item.contentDetails.itemCount,
          videos: []
        });
      }

      nextPageToken = data.nextPageToken;
      
      if (playlists.length >= maxResults) {
        break;
      }
    } while (nextPageToken);

    return playlists.slice(0, maxResults);
  }
}

export async function listPlaylistVideos(
  playlistId: string, 
  apiKey: string, 
  options: { maxResults?: number } = {}
): Promise<YouTubePlaylistVideo[]> {
  const lister = new YouTubePlaylistLister({ apiKey, ...options });
  return lister.getPlaylistVideos(playlistId);
}

export async function getPlaylistDetails(
  playlistId: string, 
  apiKey: string, 
  options: { maxResults?: number } = {}
): Promise<YouTubePlaylistInfo> {
  const lister = new YouTubePlaylistLister({ apiKey, ...options });
  return lister.getCompletePlaylist(playlistId);
}

export async function listUserPlaylists(
  apiKey: string,
  options: { channelId?: string; mine?: boolean; maxResults?: number } = {}
): Promise<YouTubePlaylistInfo[]> {
  const lister = new YouTubePlaylistLister({ apiKey, maxResults: options.maxResults });
  return lister.listUserPlaylists(options.channelId, options.mine, options.maxResults);
}