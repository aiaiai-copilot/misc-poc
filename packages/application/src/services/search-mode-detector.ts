import { SearchResultDTO } from '../dtos/search-result-dto';

export enum DisplayMode {
  LIST = 'list',
  CLOUD = 'cloud',
}

export interface SearchModeDetectorConfig {
  readonly listToCloudThreshold: number;
  readonly cloudToListThreshold: number;
}

export class SearchModeDetector {
  private config: SearchModeDetectorConfig;

  private static readonly DEFAULT_CONFIG: SearchModeDetectorConfig = {
    listToCloudThreshold: 12,
    cloudToListThreshold: 10,
  };

  constructor(config?: Partial<SearchModeDetectorConfig>) {
    this.config = {
      ...SearchModeDetector.DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfiguration(this.config);
  }

  detectMode(searchResult: SearchResultDTO): DisplayMode {
    if (searchResult == null) {
      throw new Error('SearchResult cannot be null or undefined');
    }

    const resultCount = searchResult.total;

    if (resultCount > this.config.listToCloudThreshold) {
      return DisplayMode.CLOUD;
    }

    return DisplayMode.LIST;
  }

  getConfiguration(): SearchModeDetectorConfig {
    return { ...this.config };
  }

  updateConfiguration(newConfig: Partial<SearchModeDetectorConfig>): void {
    const updatedConfig = {
      ...this.config,
      ...newConfig,
    };

    this.validateConfiguration(updatedConfig);
    this.config = updatedConfig;
  }

  private validateConfiguration(config: SearchModeDetectorConfig): void {
    if (config.listToCloudThreshold <= config.cloudToListThreshold) {
      throw new Error(
        'listToCloudThreshold must be greater than cloudToListThreshold'
      );
    }
  }
}
