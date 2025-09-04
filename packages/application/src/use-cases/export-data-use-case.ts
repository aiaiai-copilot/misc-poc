import { Result, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { RecordRepository } from '../ports/record-repository';
import { TagRepository } from '../ports/tag-repository';
import { RecordDTOMapper } from '../dtos/record-dto';
import { ExportDTO, ExportDTOMapper } from '../dtos/export-dto';

export interface NormalizationSettings {
  readonly caseSensitive: boolean;
  readonly removeDiacritics: boolean;
  readonly normalizeUnicode: boolean;
}

export interface ExportSettings {
  readonly includeTimestamps: boolean;
  readonly compressOutput: boolean;
  readonly formatVersion: string;
}

export interface ExportDataRequest {
  readonly format: 'json' | 'csv' | 'xml' | 'yaml';
  readonly includeMetadata: boolean;
  readonly normalizationSettings?: NormalizationSettings;
  readonly exportSettings?: ExportSettings;
}

export interface ExportDataResponse {
  readonly success: boolean;
  readonly exportData: ExportDTO;
}

export class ExportDataUseCase {
  constructor(
    private readonly recordRepository: RecordRepository,
    private readonly tagRepository: TagRepository
  ) {}

  async execute(
    request: ExportDataRequest
  ): Promise<Result<ExportDataResponse, DomainError>> {
    try {
      // Validate export format
      if (!this.isValidFormat(request.format)) {
        return Err(
          new DomainError(
            'INVALID_EXPORT_FORMAT',
            `Unsupported export format: ${request.format}`
          )
        );
      }

      // Fetch all records
      const recordsResult = await this.recordRepository.findAll();
      if (recordsResult.isErr()) {
        return Err(recordsResult.error);
      }

      // Fetch all tags for reference (though we'll remove UUIDs)
      const tagsResult = await this.tagRepository.findAll();
      if (tagsResult.isErr()) {
        return Err(tagsResult.error);
      }

      const records = recordsResult.value.records;
      const tags = tagsResult.value;

      // Create mapping from tag IDs to normalized values for portable export
      const tagIdToNormalizedValue = new Map<string, string>();
      tags.forEach((tag) => {
        tagIdToNormalizedValue.set(tag.id.toString(), tag.normalizedValue);
      });

      // Convert records to DTOs without UUIDs
      const recordDTOs = records.map((record) => {
        const baseDTO = RecordDTOMapper.toDTO(record);

        // Replace UUID-based tagIds with normalized tag values for portability
        const portableTagIds = baseDTO.tagIds.map((tagId) => {
          const normalizedValue = tagIdToNormalizedValue.get(tagId);
          return normalizedValue || tagId;
        });

        return {
          // Remove UUID from id for portability - use content-based hash instead
          id: this.generatePortableId(baseDTO.content),
          content: baseDTO.content,
          tagIds: portableTagIds,
          createdAt: baseDTO.createdAt,
          updatedAt: baseDTO.updatedAt,
        };
      });

      // Create export data with metadata
      let exportData: ExportDTO;

      if (records.length === 0) {
        exportData = ExportDTOMapper.create([], request.format);
        exportData = {
          ...exportData,
          metadata: {
            ...exportData.metadata,
            exportSource: 'empty-export',
          },
        };
      } else {
        exportData = ExportDTOMapper.create(recordDTOs, request.format);
      }

      // Add normalization settings if requested
      if (request.includeMetadata && request.normalizationSettings) {
        exportData = {
          ...exportData,
          metadata: {
            ...exportData.metadata,
            normalizationSettings: request.normalizationSettings,
          },
        };
      }

      // Add export settings if provided
      if (request.includeMetadata && request.exportSettings) {
        exportData = {
          ...exportData,
          metadata: {
            ...exportData.metadata,
            exportSettings: request.exportSettings,
          },
        };
      }

      return Ok({
        success: true,
        exportData,
      });
    } catch (error) {
      return Err(
        new DomainError(
          'EXPORT_FAILED',
          `Export operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  private isValidFormat(
    format: string
  ): format is 'json' | 'csv' | 'xml' | 'yaml' {
    return ['json', 'csv', 'xml', 'yaml'].includes(format);
  }

  private generatePortableId(content: string): string {
    // Generate a portable, content-based identifier
    // This ensures consistent export/import without relying on UUIDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Convert to positive number and encode as base36 for compactness
    const positiveHash = Math.abs(hash);
    return `record_${positiveHash.toString(36)}`;
  }
}
