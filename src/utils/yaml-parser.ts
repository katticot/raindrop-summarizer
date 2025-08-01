// yaml-parser.ts - YAML front matter parser utility
import { parse as parseYaml } from "https://deno.land/std@0.218.0/yaml/mod.ts";
import { Logger } from "./logger.ts";

export interface MarkdownFrontMatter {
  title?: string;
  url?: string;
  platform?: string;
  video_id?: string;
  generated?: string;
  raindrop_created?: string;
  domain?: string;
  tags?: string[];
  original_tags?: string[];
  generated_tags?: string[];
  [key: string]: any;
}

export interface ParsedMarkdown {
  frontMatter: MarkdownFrontMatter | null;
  content: string;
  filePath: string;
}

export class YamlParser {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Parse YAML front matter from a markdown file
   */
  async parseMarkdownFile(filePath: string): Promise<ParsedMarkdown | null> {
    try {
      const content = await Deno.readTextFile(filePath);
      return this.parseMarkdownContent(content, filePath);
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Parse YAML front matter from markdown content
   */
  parseMarkdownContent(content: string, filePath: string = ""): ParsedMarkdown | null {
    try {
      // Check if content starts with YAML front matter
      if (!content.startsWith('---\n')) {
        this.logger.debug(`No YAML front matter found in ${filePath}`);
        return {
          frontMatter: null,
          content: content,
          filePath
        };
      }

      // Find the closing --- delimiter
      const endDelimiterIndex = content.indexOf('\n---\n', 4);
      if (endDelimiterIndex === -1) {
        this.logger.warn(`Invalid YAML front matter format in ${filePath}: missing closing delimiter`);
        return {
          frontMatter: null,
          content: content,
          filePath
        };
      }

      // Extract YAML content
      const yamlContent = content.substring(4, endDelimiterIndex);
      const markdownContent = content.substring(endDelimiterIndex + 5);

      // Parse YAML
      const frontMatter = parseYaml(yamlContent) as MarkdownFrontMatter;

      this.logger.debug(`Successfully parsed YAML front matter from ${filePath}`);
      
      return {
        frontMatter,
        content: markdownContent,
        filePath
      };

    } catch (error) {
      this.logger.error(`Failed to parse YAML front matter from ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Get all markdown files from a directory
   */
  async getMarkdownFiles(directoryPath: string): Promise<string[]> {
    try {
      const files: string[] = [];
      
      for await (const entry of Deno.readDir(directoryPath)) {
        if (entry.isFile && entry.name.endsWith('.md')) {
          files.push(`${directoryPath}/${entry.name}`);
        }
      }

      this.logger.debug(`Found ${files.length} markdown files in ${directoryPath}`);
      return files.sort();

    } catch (error) {
      this.logger.error(`Failed to read directory ${directoryPath}: ${error}`);
      return [];
    }
  }

  /**
   * Extract video URL from front matter or content
   */
  extractVideoUrl(parsed: ParsedMarkdown): string | null {
    // First try to get URL from front matter
    if (parsed.frontMatter?.url) {
      return parsed.frontMatter.url;
    }

    // Fallback: try to extract from content using regex
    const urlMatch = parsed.content.match(/>\s*\*\*Video URL\*\*:\s*([^\n\r]+)/);
    if (urlMatch) {
      return urlMatch[1].trim();
    }

    this.logger.warn(`Could not extract video URL from ${parsed.filePath}`);
    return null;
  }

  /**
   * Get tags that should be synced to Raindrop
   * Returns the combined tags (original + generated) if available
   */
  getTagsForSync(parsed: ParsedMarkdown): string[] {
    if (!parsed.frontMatter) {
      return [];
    }

    // If we have tags array, use that (it should contain both original and generated)
    if (parsed.frontMatter.tags && Array.isArray(parsed.frontMatter.tags)) {
      return parsed.frontMatter.tags;
    }

    // Fallback: combine original_tags and generated_tags
    const originalTags = parsed.frontMatter.original_tags || [];
    const generatedTags = parsed.frontMatter.generated_tags || [];
    
    // Combine and deduplicate
    return [...new Set([...originalTags, ...generatedTags])];
  }

  /**
   * Validate that the parsed markdown has the required fields for tag updating
   */
  isValidForTagUpdate(parsed: ParsedMarkdown): boolean {
    if (!parsed.frontMatter) {
      this.logger.debug(`${parsed.filePath}: No front matter found`);
      return false;
    }

    const hasUrl = !!parsed.frontMatter.url;
    const hasTags = !!(parsed.frontMatter.tags && parsed.frontMatter.tags.length > 0);

    if (!hasUrl) {
      this.logger.debug(`${parsed.filePath}: No URL in front matter`);
    }

    if (!hasTags) {
      this.logger.debug(`${parsed.filePath}: No tags in front matter`);
    }

    return hasUrl && hasTags;
  }
}