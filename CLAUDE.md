# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Raindrop.io YouTube video summarizer that fetches bookmarks from Raindrop.io, identifies YouTube video URLs, and generates AI-powered summaries using Google Cloud's Vertex AI (Gemini model). The project now also supports direct YouTube playlist processing for batch summarization. The project consists of multiple components:

- **TypeScript/Deno orchestrator** (`main.ts`) - Fetches bookmarks, filters YouTube video URLs, processes playlists, and manages the CLI workflow
- **Python summarizer** (`video_summarizer.py`) - Uses Vertex AI to generate video summaries with structured output
- **YouTube playlist processor** (`src/youtube/playlist.ts`) - Fetches and processes videos from YouTube playlists using YouTube Data API
- **Web interface** (`src/app/`) - Modern Next.js web dashboard for video library management
- **Database layer** (`src/db/`) - SQLite storage for job tracking and processed video metadata

## Development Commands

### Running the Application

You have multiple convenient ways to run the application:

#### Option 1: Using the Shell Script (Easiest)
```bash
./run.sh
```

#### Option 2: Using Deno Tasks
```bash
# CLI Application
deno task start    # Run the CLI application
deno task help     # Show help
deno task version  # Show version
deno task dry-run  # Dry run with verbose output
deno task dev      # Run CLI with file watching

# Web Interface
deno task web      # Start web server
deno task web-dev  # Start web server with file watching
```

#### Option 3: Direct Deno Commands
```bash
# CLI Application
deno run --allow-all main.ts

# Web Interface (Next.js)
npm run dev
```

#### Command Options
- `-h, --help` - Show detailed help message with examples
- `-v, --version` - Show version information
- `-t, --tag <tag>` - Only process bookmarks with specific tag
- `-c, --collection <id>` - Specify Raindrop collection ID
- `-n, --max-videos <num>` - Maximum videos to process (default: 5)
- `-o, --output <path>` - Output directory for summaries (default: ./summaries)
- `-p, --playlist <id>` - Process videos from a YouTube playlist
- `--list-playlist` - List videos in the specified playlist (requires --playlist)
- `--list-my-playlists` - Show information about listing your playlists (requires OAuth setup)
- `--config <file>` - Load configuration from file
- `--dry-run` - Show what would be processed without summarizing
- `--verbose` - Enable detailed logging
- `-q, --quiet` - Suppress non-error output

#### Examples
```bash
# Basic CLI usage with default settings
./run.sh

# Process YouTube videos with specific tag
./run.sh --tag programming --max-videos 10

# Process videos from a YouTube playlist
./run.sh --playlist PLrAXtmRdnEQy5cV5 --max-videos 15

# List videos in a playlist without processing
./run.sh --playlist PLrAXtmRdnEQy5cV5 --list-playlist

# Get help for listing your YouTube playlists
./run.sh --list-my-playlists

# Dry run to see what would be processed
./run.sh --dry-run --verbose

# Process from specific collection with custom output
./run.sh -c 123456 -o ./my-summaries

# Using deno tasks for CLI
deno task start --tag programming
deno task start --playlist PLrAXtmRdnEQy5cV5
deno task start --list-my-playlists
deno task dry-run

# Web interface (Next.js)
deno task web          # Start Next.js development server on http://localhost:3000
deno task web-dev      # Same as above
```

#### Development Commands
```bash
deno task check    # Type check without running
deno task fmt      # Format code
deno task lint     # Lint code
```

### Python Dependencies

Install Python dependencies using pipx (recommended):
```bash
pipx install "google-cloud-aiplatform[vertexai]"
pipx inject google-cloud-aiplatform pyyaml
```

Or with pip:
```bash
pip install "google-cloud-aiplatform[vertexai]" pyyaml
```

## Architecture

### Modular Structure

The codebase is now organized into focused modules:

- `src/types.ts` - Shared TypeScript interfaces and types
- `src/config/config.ts` - Configuration management with validation
- `src/utils/logger.ts` - Enhanced logging with colors and levels
- `src/utils/yaml-parser.ts` - YAML front matter parsing and generation
- `src/utils/tag-updater.ts` - Force update tag management for Raindrop bookmarks (max 10 tags)
- `src/api/raindrop.ts` - Raindrop.io API integration with rate limiting
- `src/video/detector.ts` - Video URL detection and platform identification
- `src/video/python-integration.ts` - Python environment auto-detection and integration
- `src/youtube/playlist.ts` - YouTube playlist processing and video extraction
- `src/cli/cli.ts` - Enhanced CLI interface with better UX
- `src/db/database.ts` - Database operations and storage management
- `src/app/` - Next.js web application with modern UI components
- `src/services/video-metadata.ts` - Video metadata service for web interface
- `src/components/` - React components for video library management
- `main.ts` - Main CLI application orchestrating all modules

### Core Components

1. **Enhanced Configuration Management**: Validation, interactive setup wizard, error handling
2. **Robust API Integration**: Rate limiting, error handling, connection testing for Raindrop and YouTube APIs
3. **Smart Video Detection**: Platform-specific ID extraction, URL validation
4. **YouTube Playlist Processing**: Direct playlist video extraction and batch processing
5. **Intelligent Python Integration**: Auto-detects pipx, conda, system Python installations
6. **Rich CLI Experience**: Colorized output, progress bars, detailed help, verbose/quiet modes
7. **Comprehensive Logging**: Multiple log levels, formatted output, error tracking
8. **YAML Processing**: Advanced YAML front matter generation and parsing
9. **Automatic Tag Management**: AI-powered tag generation and synchronization with Raindrop
10. **Database Integration**: Persistent storage for tracking processed videos and metadata
11. **Web Interface**: Modern dashboard with real-time updates and job management
12. **Job Queue System**: Background processing with retry logic and progress tracking
13. **Real-time Communication**: WebSocket-based live updates and notifications

### Data Flow

1. Parse CLI arguments with enhanced validation
2. Load and validate configuration (with interactive prompts if needed)
3. Test API connections (Raindrop, YouTube if needed) and Python environment
4. Handle playlist operations if specified, or fetch bookmarks with pagination and rate limiting
5. Filter and detect YouTube videos with detailed breakdown
6. Process videos with progress tracking and error handling
7. Generate comprehensive statistics and results

### Key Files

- `main.ts` - Enhanced CLI application with modular architecture
- `video_summarizer.py` - AI summarization using Vertex AI with YAML front matter generation
- `src/app/api/` - Next.js API routes for web interface
- `deno.json` - Deno configuration with tasks, formatting, and linting rules
- `run.sh` - Convenient shell script for easy CLI execution
- `.env` - Environment configuration (with setup wizard support)
- `src/` - Modular source code organization
- `summaries/` - Output directory for generated summaries
- `data/` - SQLite database storage for tracking processed videos and jobs

## Environment Configuration

Required environment variables in `.env`:
- `RAINDROP_TOKEN` - Raindrop.io API token
- `GOOGLE_CLOUD_PROJECT_ID` - Google Cloud project ID

Optional environment variables:
- `YOUTUBE_API_KEY` - YouTube Data API key (required for playlist functionality)
- `RAINDROP_COLLECTION_ID` - Collection ID (defaults to 0 for all bookmarks)
- `MAX_VIDEOS` - Maximum videos to process (defaults to 5)

## Python Script Integration

The enhanced system automatically detects Python installations in this order:
1. **pipx** - `~/.local/pipx/venvs/google-cloud-aiplatform/bin/python`
2. **conda** - Scans all conda environments for required packages
3. **system** - Standard `python3` or `python` commands

The Python script integration includes:
- Environment validation with dependency checking
- Helpful error messages for common issues
- Support for custom Python paths
- Automatic fallback between installation types

The Python script expects:
- Video URL as command-line argument
- `GOOGLE_CLOUD_PROJECT_ID` environment variable

## Video Platform Support

Supported video platforms:
- **YouTube** (youtube.com, youtu.be, m.youtube.com)
  - Individual video URLs from Raindrop bookmarks
  - Direct playlist processing via YouTube Data API
  - Automatic playlist ID extraction from various URL formats
  - **Note**: Listing personal playlists requires OAuth 2.0 setup (not currently implemented)

## YouTube Playlist Integration

The application now supports direct YouTube playlist processing, allowing you to:

### Playlist Operations
- **List playlist videos**: View all videos in a playlist without processing
- **Process playlist videos**: Automatically summarize all videos from a playlist
- **Playlist metadata**: Extract playlist title, description, and video information
- **Automatic tagging**: Videos from playlists are tagged with `playlist:PlaylistName` and `youtube`

### YouTube API Setup
1. Go to [Google Developers Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create API credentials (API Key)
5. Add `YOUTUBE_API_KEY="your_api_key"` to your `.env` file

### Playlist URL Formats Supported
- `https://www.youtube.com/playlist?list=PLrAXtmRdnEQy5cV5`
- `https://youtube.com/playlist?list=PLrAXtmRdnEQy5cV5`
- `PLrAXtmRdnEQy5cV5` (direct playlist ID)

### Playlist Processing Features
- **Pagination support**: Handles playlists of any size
- **Concurrent processing**: Respects the same concurrency settings as bookmark processing
- **Progress tracking**: Real-time progress updates during processing
- **Database integration**: Playlist videos are tracked in the same database as bookmark videos
- **Error handling**: Graceful handling of private videos, deleted videos, and API errors

## Output Format

Generated summaries are saved as Markdown files in `./summaries/` with filenames derived from YouTube video IDs (e.g., `{video_id}-summary.md`). Each summary now includes:

### YAML Front Matter Structure
```yaml
---
title: "Video Title"
url: "https://youtube.com/watch?v=..."
platform: "YouTube"
video_id: "dQw4w9WgXcQ"
generated: "2025-01-25T18:00:44.123456"
raindrop_created: "2024-01-15T10:30:00.000Z"
domain: "youtu.be"
tags:
  - original-tag
  - ai-generated-tag-1
  - ai-generated-tag-2
---
```

### Content Features
- **Comprehensive Metadata**: Video details, timestamps, platform information
- **Smart Tag Management**: Combines existing and AI-generated tags
- **Structured Summary**: Both short and exhaustive versions with clear formatting
- **Automatic Tag Sync**: Generated tags are automatically added to Raindrop bookmarks

## AI Tag Generation and YAML Front Matter
When running the summarization:
- The system automatically generates 5-10 relevant tags from video content
- YAML front matter includes comprehensive metadata and tag information
- Generated tags are automatically merged with existing Raindrop bookmark tags
- All summaries include structured metadata for better organization and searchability

## Web Interface
The Next.js web interface provides:
- **Video Library**: Browse and search through processed video summaries
- **Modern UI**: Built with React, Tailwind CSS, and shadcn/ui components
- **Real-time Data**: Dynamic loading of video metadata and summaries
- **Responsive Design**: Works on desktop and mobile devices
- **Advanced Filtering**: Filter by tags, date, platform, and status
- **API Integration**: RESTful API endpoints for data access

### Web Interface Usage
```bash
# Start the Next.js development server (default port 3000)
deno task web

# Or directly with npm
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

Access the web interface at `http://localhost:3000` for a modern video library experience.