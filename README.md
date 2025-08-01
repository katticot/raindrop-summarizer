# Raindrop Video Summarizer

This project provides a convenient way to summarize videos from your Raindrop.io bookmarks using Google Cloud's Vertex AI (Gemini model). It features a modular TypeScript/Deno orchestrator with an enhanced CLI interface and a robust Python script for AI-powered video summarization.

## Features

* **Enhanced Configuration Management**: Interactive setup wizard, validation, and error handling
* **Robust API Integration**: Rate limiting, connection testing, and comprehensive error handling
* **Smart Video Detection**: Platform-specific ID extraction and URL validation
* **Intelligent Python Integration**: Auto-detects pipx, conda, and system Python installations
* **Rich CLI Experience**: Colorized output, progress bars, detailed help, and verbose/quiet modes
* **Comprehensive Logging**: Multiple log levels, formatted output, and error tracking
* **AI-Powered Tag Generation**: Automatically generates relevant tags from video content analysis
* **YAML Front Matter**: Rich metadata in structured YAML format with video details and tags
* **Automatic Bookmark Updates**: Updates Raindrop bookmarks with AI-generated tags
* **Vertex AI Integration**: Utilizes Google Cloud Vertex AI Gemini model for structured summaries
* **Markdown Output**: Saves well-formatted summaries with comprehensive metadata and clear sections
* **Flexible Filtering**: Collection-based filtering, tag filtering, and dry-run capabilities

## Prerequisites

Before you begin, ensure you have the following installed and configured:

  * **Deno**: The JavaScript/TypeScript runtime. If you don't have it, follow the installation instructions on the [Deno website](https://deno.land/).
  * **Python 3.x**: The Python interpreter.
  * **pipx**: Recommended for installing Python applications in isolated environments. Install it via `pip install pipx` or your system's package manager.
  * **Google Cloud Project**: A Google Cloud project with the Vertex AI API enabled. You'll need a service account key or appropriate credentials configured for your environment.
  * **Raindrop.io Account**: With an API token.

## Setup

### 1\. Environment Variables

Create a `.env` file in the root directory of your project with the following environment variables:

```dotenv
RAINDROP_TOKEN="your_raindrop_api_token"
GOOGLE_CLOUD_PROJECT_ID="your_google_cloud_project_id"
RAINDROP_COLLECTION_ID="optional_raindrop_collection_id" # Default to 0 (All bookmarks)
MAX_VIDEOS=5 # Optional: Maximum number of videos to process, defaults to 5
```

  * **`RAINDROP_TOKEN`**: Obtain this from your Raindrop.io settings (Integrations -\> Create new application).
  * **`GOOGLE_CLOUD_PROJECT_ID`**: Your Google Cloud project ID.
  * **`RAINDROP_COLLECTION_ID`**: The ID of the Raindrop collection you want to summarize videos from. If omitted or set to `0`, it will fetch from "All bookmarks."
  * **`MAX_VIDEOS`**: The maximum number of video bookmarks to process in a single run. Defaults to `5`.

### 2\. Python Dependencies

The Python script uses the `google-cloud-aiplatform` library and `PyYAML` for YAML front matter generation. It's recommended to install these in an isolated environment using `pipx`.

```bash
pipx install "google-cloud-aiplatform[vertexai]"
pipx inject google-cloud-aiplatform pyyaml
```

If you prefer not to use `pipx`, you can use `pip`:

```bash
pip install "google-cloud-aiplatform[vertexai]" pyyaml
```

The application will automatically detect your Python installation from:
- pipx environments
- conda environments  
- system Python installations

### 3\. Google Cloud Authentication

Ensure your environment is authenticated to access Google Cloud. The Python script relies on the `GOOGLE_CLOUD_PROJECT_ID` environment variable. You might need to set up Google Cloud credentials, for example, by running `gcloud auth application-default login` or by setting the `GOOGLE_APPLICATION_CREDENTIALS` environment variable if you're using a service account key file.

## Usage

Navigate to the project's root directory in your terminal.

```bash
cd your-repo-name
```

### Basic Run

The easiest way to run the summarizer is using the provided shell script:

```bash
./run.sh
```

Alternative methods:
```bash
# Using Deno tasks
deno task start

# Direct Deno command
deno run --allow-all main.ts
```

This command will:

1.  Load your configuration from `.env`.
2.  Fetch bookmarks from your specified Raindrop collection (or all bookmarks).
3.  Identify video links.
4.  For each video (up to `MAX_VIDEOS`):
    - Generate AI-powered tags based on video content analysis
    - Create a comprehensive summary using Vertex AI
    - Generate YAML front matter with metadata and tags
    - Update the Raindrop bookmark with generated tags
5.  Save the enriched summaries as Markdown files in the `./summaries` directory.

### Options

You can customize the behavior using command-line arguments:

  * **`--help`**: Show the detailed help message with examples.
    ```bash
    ./run.sh --help
    ```
  * **`--tag=<tag>`**: Only process bookmarks with a specific tag.
    ```bash
    ./run.sh --tag=youtube
    ```
  * **`--collection=<id>`**: Specify a Raindrop collection ID.
    ```bash
    ./run.sh --collection=123456789
    ```
  * **`--max-videos=<num>`**: Set maximum number of videos to process.
    ```bash
    ./run.sh --max-videos=10
    ```
  * **`--dry-run`**: Fetch URLs but do not perform summarization.
    ```bash
    ./run.sh --dry-run --verbose
    ```
  * **`--verbose`**: Enable detailed logging.
    ```bash
    ./run.sh --verbose
    ```
  * **`--quiet`**: Suppress non-error output.
    ```bash
    ./run.sh --quiet
    ```

## Output

Summarized videos will be saved as Markdown (`.md`) files in the `./summaries` directory, with filenames derived from the video URL (e.g., `youtube_video_id-summary.md`). Each summary includes:

* **YAML Front Matter**: Comprehensive metadata including video details, timestamps, and tags
* **AI-Generated Tags**: Automatically generated tags based on content analysis
* **Structured Summary**: Both short and exhaustive versions with clear formatting
* **Automatic Tag Updates**: Generated tags are automatically added to your Raindrop bookmarks

### Example Output Format

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
  - programming
  - tutorial
  - javascript
  - ai-generated-tag
original_tags: ["programming"]
generated_tags: ["tutorial", "javascript", "ai-generated-tag"]
---

# 📹 Video Summary

> **Video URL**: https://youtube.com/watch?v=...
> **Platform**: YouTube
> **Generated**: 2025-01-25

## 🔍 Quick Summary
[AI-generated short summary]

## 📝 Detailed Summary
[AI-generated comprehensive summary]
```

## Project Structure

```
raindrop-agent/
├── main.ts                     # Main application orchestrator
├── video_summarizer.py         # Python AI summarization script
├── src/                        # Modular TypeScript source code
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── config/
│   │   └── config.ts          # Configuration management
│   ├── utils/
│   │   └── logger.ts          # Enhanced logging utilities
│   ├── api/
│   │   └── raindrop.ts        # Raindrop.io API integration
│   ├── video/
│   │   ├── detector.ts        # Video URL detection
│   │   └── python-integration.ts # Python environment integration
│   └── cli/
│       └── cli.ts             # Command-line interface
├── deno.json                   # Deno configuration and tasks
├── run.sh                      # Convenient shell script
├── .env                        # Environment variables (not in git)
└── summaries/                  # Generated video summaries
```

## Architecture

The application follows a modular architecture:

1. **Enhanced Configuration Management**: Validation, interactive setup wizard, error handling
2. **Robust API Integration**: Rate limiting, error handling, connection testing
3. **Smart Video Detection**: Platform-specific ID extraction, URL validation
4. **Intelligent Python Integration**: Auto-detects pipx, conda, system Python installations
5. **Rich CLI Experience**: Colorized output, progress bars, detailed help, verbose/quiet modes
6. **Comprehensive Logging**: Multiple log levels, formatted output, error tracking

## Data Flow

1. Parse CLI arguments with enhanced validation
2. Load and validate configuration (with interactive prompts if needed)
3. Test API connections and Python environment
4. Fetch bookmarks with pagination and rate limiting
5. Filter and detect YouTube videos with detailed breakdown
6. Process videos with progress tracking and error handling
7. Generate comprehensive statistics and results

---
