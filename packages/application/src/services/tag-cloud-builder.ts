import { SearchResultDTO } from '../dtos/search-result-dto';
import {
  TagCloudItemDTO,
  TagCloudItemDTOMapper,
} from '../dtos/tag-cloud-item-dto';
import { TagRepository } from '../ports/tag-repository';

export interface TagCloudBuilderConfig {
  readonly maxCloudSize: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
}

export class TagCloudBuilder {
  private config: TagCloudBuilderConfig;
  private tagRepository: TagRepository;

  private static readonly DEFAULT_CONFIG: TagCloudBuilderConfig = {
    maxCloudSize: 30,
    minFrequency: 1,
    maxFrequency: Infinity,
  };

  constructor(
    tagRepository: TagRepository,
    config?: Partial<TagCloudBuilderConfig>
  ) {
    this.tagRepository = tagRepository;
    this.config = {
      ...TagCloudBuilder.DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfiguration(this.config);
  }

  async buildFromSearchResult(
    searchResult: SearchResultDTO
  ): Promise<TagCloudItemDTO[]> {
    if (searchResult == null) {
      throw new Error('SearchResult cannot be null or undefined');
    }

    if (searchResult.records.length === 0) {
      return [];
    }

    // Extract unique tag IDs from all records
    const uniqueTagIds = this.extractUniqueTagIds(searchResult.records);

    if (uniqueTagIds.length === 0) {
      return [];
    }

    // Get usage information for all tags, sorted by usage count descending
    const usageInfoResult = await this.tagRepository.getUsageInfo({
      sortBy: 'usage',
      sortOrder: 'desc',
    });

    if (!usageInfoResult.isSuccess) {
      throw usageInfoResult.error;
    }

    const tagUsageInfos = usageInfoResult.value;

    // Filter tags that appear in search results and meet frequency criteria
    const relevantTagUsageInfos = tagUsageInfos
      .filter((usageInfo) => uniqueTagIds.has(usageInfo.tag.id.toString()))
      .filter((usageInfo) => this.meetsFrequencyThreshold(usageInfo.usageCount))
      .slice(0, this.config.maxCloudSize); // Limit by max cloud size

    // Convert to DTOs with proper weight calculation
    const tagCloudItems = TagCloudItemDTOMapper.toDTOs(relevantTagUsageInfos);

    // Sort by usage count (relevance) descending
    return tagCloudItems.sort((a, b) => b.usageCount - a.usageCount);
  }

  getConfiguration(): TagCloudBuilderConfig {
    return { ...this.config };
  }

  updateConfiguration(newConfig: Partial<TagCloudBuilderConfig>): void {
    const updatedConfig = {
      ...this.config,
      ...newConfig,
    };

    this.validateConfiguration(updatedConfig);
    this.config = updatedConfig;
  }

  private extractUniqueTagIds(records: { tagIds: string[] }[]): Set<string> {
    const uniqueTagIds = new Set<string>();

    for (const record of records) {
      for (const tagId of record.tagIds) {
        uniqueTagIds.add(tagId);
      }
    }

    return uniqueTagIds;
  }

  private meetsFrequencyThreshold(usageCount: number): boolean {
    return (
      usageCount >= this.config.minFrequency &&
      usageCount <= this.config.maxFrequency
    );
  }

  private validateConfiguration(config: TagCloudBuilderConfig): void {
    if (config.maxCloudSize <= 0) {
      throw new Error('maxCloudSize must be greater than 0');
    }

    if (config.minFrequency < 0) {
      throw new Error('minFrequency must be non-negative');
    }

    if (config.maxFrequency <= 0) {
      throw new Error('maxFrequency must be greater than 0');
    }

    if (config.maxFrequency <= config.minFrequency) {
      throw new Error('maxFrequency must be greater than minFrequency');
    }
  }
}
