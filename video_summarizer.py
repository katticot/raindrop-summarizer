#!/usr/bin/env python3
"""Video Summarizer using Google Cloud Vertex AI Gemini.

This script takes a YouTube video URL and generates a comprehensive summary
using Google Cloud's Vertex AI Gemini model.
"""

import vertexai
from vertexai.generative_models import GenerativeModel, Part
import os
import sys
import argparse
import logging
from typing import Optional, Dict, List
from dotenv import load_dotenv
import json
import yaml

# --- Constants ---
DEFAULT_MODEL = "gemini-1.5-flash-002"
DEFAULT_LOCATION = "us-central1"
SUPPORTED_PLATFORMS = ["youtube.com", "youtu.be", "vimeo.com"]

# Enhanced prompt template for professional markdown output with tag generation
TAG_GENERATION_PROMPT = """Analyze this video and provide ONLY the following two items:

1. Generate 5-10 relevant tags as a JSON array:
["tag1", "tag2", "tag3"]

2. Create a professional markdown summary following the format below.

IMPORTANT: 
- Provide ONLY the JSON array and markdown content
- NO conversational text, introductions, or conclusions
- NO code blocks around the JSON
- Start directly with the JSON array, then the markdown
- Do not include phrases like "Here's", "Hope this helps", etc.

Tags should cover:
- Specific topics in the video
- Technologies/tools mentioned  
- Concepts/techniques discussed
- Industry/domain terms
- Content type (tutorial, review, etc.)

Format the response exactly as:
["tag1", "tag2", "tag3"]

[then the markdown content below]
"""

SUMMARY_PROMPT = """
# 📹 [Video title]

> **Video URL**: [Insert the video URL here]  
> **Generated**: [Current date]  
> **Platform**: [YouTube/Vimeo/etc.]

---

## 🎯 Executive Summary
*Write 2–3 sentences that capture the main topic, purpose, and key takeaway.*

---

## 📋 Key Information

| **Aspect** | **Details** |
|------------|-------------|
| **Duration** | [Video length or N/A] |
| **Speaker/Creator** | [Name or N/A] |
| **Main Topic** | [Primary subject] |
| **Content Type** | [Tutorial/Discussion/Review/etc.] |
| **Difficulty Level** | [Beginner/Intermediate/Advanced] |

---

## 📖 Detailed Content Breakdown

### 🔍 Main Topics Covered
- **Topic 1**: Brief explanation
- **Topic 2**: Brief explanation  
- **Topic 3**: Brief explanation

### 📚 Core Concepts Explained
1. **Concept Name** – definition · why it matters · application  
2. **Concept Name** – definition · why it matters · application

### 🛠️ Practical Examples & Demonstrations
- Example 1 – description & significance  
- Example 2 – description & significance  
- Example 3 – description & significance

---

## 💡 Key Takeaways & Insights

### ✅ Main Lessons
- **Lesson 1** – why it’s important  
- **Lesson 2** – why it’s important  
- **Lesson 3** – why it’s important

### 🎯 Actionable Advice
- [ ] **Action item 1** – specific steps  
- [ ] **Action item 2** – specific steps  
- [ ] **Action item 3** – specific steps

### ⚡ Notable Quotes or Insights
> *“Include up to three memorable quotes (≤ 25 words each).”*

---

## 🎯 Target Audience & Prerequisites

### 👥 Who Should Watch This
- Primary audience
- Secondary audience
- Experience level needed

### 📚 Background Knowledge Needed
- Prerequisite 1
- Prerequisite 2
- Prerequisite 3

---

## 🔗 Related Topics & Further Learning

### 📖 Related Concepts
- Related topic 1
- Related topic 2
- Related topic 3

### 🎓 Suggested Next Steps
- Next step 1
- Next step 2
- Next step 3

---

## 📊 Content Quality Assessment

| **Criteria** | **Rating** | **Notes** |
|--------------|------------|-----------|
| **Information Value** | ⭐⭐⭐⭐⭐ | concise note |
| **Presentation Quality** | ⭐⭐⭐⭐⭐ | concise note |
| **Practical Applicability** | ⭐⭐⭐⭐⭐ | concise note |

---

## 🗺️ Visual Flow Chart

```mermaid
graph TD
    A[Video Topic] --> B{Main Categories}
    
    B --> C[Core Concepts]
    B --> D[Tools/Technologies]
    B --> E[Key Takeaways]
    B --> F[Practical Applications]
    
    C --> C1[Concept 1]
    C --> C2[Concept 2]
    C --> C3[Concept 3]
    
    D --> D1[Tool/Tech 1]
    D --> D2[Tool/Tech 2]
    D --> D3[Tool/Tech 3]
    
    E --> E1[Main Lesson 1]
    E --> E2[Main Lesson 2]
    E --> E3[Actionable Advice]
    
    F --> F1[Use Case 1]
    F --> F2[Use Case 2]
    F --> F3[Implementation]
    
    C1 --> G[Target Audience]
    D1 --> G
    E1 --> G
    F1 --> G
    
    G --> H[Next Steps]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style G fill:#e8f5e8
    style H fill:#fff3e0

Replace with actual video content, tools, concepts, and outcomes.

"""

# --- Configuration Loading ---
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors by default
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


class VideoSummarizerError(Exception):
    """Base exception for video summarization errors."""
    pass


class ConfigurationError(VideoSummarizerError):
    """Raised when configuration is invalid."""
    pass


class VideoProcessingError(VideoSummarizerError):
    """Raised when video processing fails."""
    pass


def validate_environment() -> str:
    """Validate environment variables and return project ID.
    
    Returns:
        str: Google Cloud Project ID
        
    Raises:
        ConfigurationError: If required environment variables are missing
    """
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    
    if not project_id:
        raise ConfigurationError(
            "GOOGLE_CLOUD_PROJECT_ID environment variable is required. "
            "Please set it in your .env file."
        )
    
    return project_id


def validate_video_url(video_url: str) -> bool:
    """Validate if the URL is from a supported video platform.
    
    Args:
        video_url: URL to validate
        
    Returns:
        bool: True if URL is from supported platform
    """
    return any(platform in video_url.lower() for platform in SUPPORTED_PLATFORMS)


def extract_video_id(video_url: str) -> Optional[str]:
    """Extract video ID from various video platforms.
    
    Args:
        video_url: URL of the video
        
    Returns:
        str: Video ID if found, None otherwise
    """
    import re
    
    # YouTube patterns
    youtube_patterns = [
        r'(?:https?:\/\/)?(?:www\.)?(?:m\.)?youtube\.com\/watch\?v=([^&\n?#]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)',
    ]
    
    for pattern in youtube_patterns:
        match = re.search(pattern, video_url)
        if match:
            return match.group(1)
    
    # Vimeo pattern
    vimeo_match = re.search(r'(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)', video_url)
    if vimeo_match:
        return vimeo_match.group(1)
    
    return None


def initialize_vertex_ai(project_id: str, location: str = DEFAULT_LOCATION) -> GenerativeModel:
    """Initialize Vertex AI and return model instance.
    
    Args:
        project_id: Google Cloud project ID
        location: GCP region for Vertex AI
        
    Returns:
        GenerativeModel: Initialized Gemini model
        
    Raises:
        VideoProcessingError: If initialization fails
    """
    try:
        vertexai.init(project=project_id, location=location)
        model = GenerativeModel(DEFAULT_MODEL)
        logger.info(f"Initialized Vertex AI with project: {project_id}")
        return model
    except Exception as e:
        raise VideoProcessingError(f"Failed to initialize Vertex AI: {e}")


def generate_summary(model: GenerativeModel, video_url: str, metadata: Optional[Dict] = None) -> Dict[str, any]:
    """Generate video summary using Vertex AI.
    
    Args:
        model: Initialized GenerativeModel instance
        video_url: URL of the video to summarize
        metadata: Optional Raindrop metadata (title, tags, created, domain, etc.)
        
    Returns:
        Dict: Contains 'summary' (markdown text), 'generated_tags' (list), and 'front_matter' (dict)
        
    Raises:
        VideoProcessingError: If summary generation fails
    """
    try:
        from datetime import datetime
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now().isoformat()
        
        # Detect platform
        platform = "Unknown"
        if "youtube.com" in video_url.lower() or "youtu.be" in video_url.lower():
            platform = "YouTube"
        elif "vimeo.com" in video_url.lower():
            platform = "Vimeo"
        elif "tiktok.com" in video_url.lower():
            platform = "TikTok"
        elif "twitch.tv" in video_url.lower():
            platform = "Twitch"
        elif "dailymotion.com" in video_url.lower():
            platform = "Dailymotion"
        elif "ted.com" in video_url.lower():
            platform = "TED"
        
        # Create combined prompt for tag generation and summary
        full_prompt = TAG_GENERATION_PROMPT + SUMMARY_PROMPT.replace(
            "> **Video URL**: [Insert the video URL here]",
            f"> **Video URL**: {video_url}"
        ).replace(
            "> **Generated**: [Current date]",
            f"> **Generated**: {current_date}"
        ).replace(
            "> **Platform**: [YouTube/Vimeo/etc.]",
            f"> **Platform**: {platform}"
        )
        
        contents = [
            full_prompt,
            Part.from_uri(video_url, mime_type="video/mp4"),
        ]
        
        # Log to stderr to avoid interfering with stdout summary
        if logging.getLogger().isEnabledFor(logging.INFO):
            print(f"Generating summary and tags for: {video_url}", file=sys.stderr)
        
        response = model.generate_content(contents)
        
        if not response.text:
            raise VideoProcessingError("Received empty response from model")
        
        response_text = response.text.strip()
        
        # Extract generated tags from response
        generated_tags = []
        summary_content = response_text
        
        import re
        
        # Look for JSON code block first: ```json [...] ```
        json_block_match = re.search(r'```json\s*(\[.*?\])\s*```', response_text, re.DOTALL)
        if json_block_match:
            try:
                generated_tags = json.loads(json_block_match.group(1))
                # Remove the entire JSON code block from the summary content
                summary_content = response_text.replace(json_block_match.group(0), '').strip()
            except json.JSONDecodeError:
                logger.warning("Could not parse generated tags from JSON code block")
        else:
            # Look for inline JSON array: [...] 
            json_match = re.search(r'\[.*?\]', response_text)
            if json_match:
                try:
                    generated_tags = json.loads(json_match.group())
                    # Remove the JSON from the summary content
                    summary_content = response_text.replace(json_match.group(), '').strip()
                except json.JSONDecodeError:
                    logger.warning("Could not parse generated tags as JSON")
        
        # Create front matter
        existing_tags = metadata.get('tags', []) if metadata else []
        all_tags = list(set(existing_tags + generated_tags))  # Combine and deduplicate
        
        # Extract video ID for front matter
        video_id = extract_video_id(video_url)
        
        front_matter = {
            'title': metadata.get('title', 'Video Summary') if metadata else 'Video Summary',
            'url': video_url,
            'platform': platform,
            'video_id': video_id,
            'generated': current_time,
            'raindrop_created': metadata.get('created') if metadata else None,
            'domain': metadata.get('domain') if metadata else None,
            'tags': all_tags
        }
        
        # Clean up None values
        front_matter = {k: v for k, v in front_matter.items() if v is not None}
        
        # Create final markdown with YAML front matter
        yaml_front_matter = yaml.dump(front_matter, default_flow_style=False, sort_keys=False)
        final_content = f"---\n{yaml_front_matter}---\n\n{summary_content}"
        
        return {
            'summary': final_content,
            'generated_tags': generated_tags,
            'front_matter': front_matter
        }
        
    except Exception as e:
        raise VideoProcessingError(f"Failed to generate summary: {e}")


def main() -> None:
    """Main entry point for the video summarizer."""
    parser = argparse.ArgumentParser(
        description="Summarize a YouTube video using Vertex AI Gemini.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  %(prog)s "https://youtu.be/dQw4w9WgXcQ" --verbose
        """
    )
    
    parser.add_argument(
        "video_url",
        help="The full URL of the video to summarize"
    )
    parser.add_argument(
        "--metadata",
        help="JSON string containing Raindrop metadata (title, tags, created, domain, etc.)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Gemini model to use (default: {DEFAULT_MODEL})"
    )
    
    args = parser.parse_args()
    
    # Configure logging based on verbosity
    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)
    
    try:
        # Validate environment
        project_id = validate_environment()
        
        # Parse metadata if provided
        metadata = None
        if args.metadata:
            try:
                metadata = json.loads(args.metadata)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid metadata JSON: {e}")
                sys.exit(1)
        
        # Validate video URL
        if not validate_video_url(args.video_url):
            logger.warning(
                f"URL may not be from a supported platform. "
                f"Supported: {', '.join(SUPPORTED_PLATFORMS)}"
            )
        
        # Initialize Vertex AI
        model = initialize_vertex_ai(project_id)
        
        # Generate summary with tags
        result = generate_summary(model, args.video_url, metadata)
        
        # Output structured result as JSON (this is captured by the Deno script)
        print(json.dumps(result, indent=2))
        
    except ConfigurationError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except VideoProcessingError as e:
        logger.error(f"Processing error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

