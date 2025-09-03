import { TagUsageInfo } from '../ports/tag-repository';

export interface TagCloudItemDTO {
  readonly id: string;
  readonly normalizedValue: string;
  readonly displayValue: string;
  readonly usageCount: number;
  readonly weight: number;
  readonly fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  readonly color?: string;
  readonly category?: string;
}

export class TagCloudItemDTOMapper {
  static toDTO(tagUsageInfo: TagUsageInfo, weight: number): TagCloudItemDTO {
    return {
      id: tagUsageInfo.tag.id.toString(),
      normalizedValue: tagUsageInfo.tag.normalizedValue,
      displayValue: this.formatDisplayValue(tagUsageInfo.tag.normalizedValue),
      usageCount: tagUsageInfo.usageCount,
      weight,
      fontSize: this.calculateFontSize(weight),
    };
  }

  static toDTOs(tagUsageInfos: TagUsageInfo[]): TagCloudItemDTO[] {
    if (tagUsageInfos.length === 0) {
      return [];
    }

    if (tagUsageInfos.length === 1) {
      const firstItem = tagUsageInfos[0];
      if (!firstItem) {
        return [];
      }
      return [this.toDTO(firstItem, 1)];
    }

    const sortedByUsage = [...tagUsageInfos].sort(
      (a, b) => b.usageCount - a.usageCount
    );
    const firstItem = sortedByUsage[0];
    const lastItem = sortedByUsage[sortedByUsage.length - 1];

    if (!firstItem || !lastItem) {
      return [];
    }

    const maxUsage = firstItem.usageCount;
    const minUsage = lastItem.usageCount;
    const usageRange = maxUsage - minUsage;

    return tagUsageInfos.map((tagUsage) => {
      const weight =
        usageRange === 0 ? 1 : (tagUsage.usageCount - minUsage) / usageRange;
      return this.toDTO(tagUsage, weight);
    });
  }

  private static formatDisplayValue(normalizedValue: string): string {
    return normalizedValue
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private static calculateFontSize(
    weight: number
  ): 'small' | 'medium' | 'large' | 'xlarge' {
    if (weight >= 0.8) return 'xlarge';
    if (weight >= 0.6) return 'large';
    if (weight >= 0.3) return 'medium';
    return 'small';
  }
}
