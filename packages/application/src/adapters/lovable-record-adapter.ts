import { RecordDTO } from '../dtos/record-dto';

// Type definition matching the Lovable frontend format
export interface LovableRecord {
  id: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class LovableRecordAdapter {
  /**
   * Convert RecordDTO (backend format) to LovableRecord (frontend format)
   */
  static toLovableRecord(recordDTO: RecordDTO): LovableRecord {
    return {
      id: recordDTO.id,
      tags: this.contentToTags(recordDTO.content),
      createdAt: this.parseDate(recordDTO.createdAt),
      updatedAt: this.parseDate(recordDTO.updatedAt)
    };
  }

  /**
   * Convert LovableRecord (frontend format) to RecordDTO (backend format)
   */
  static toRecordDTO(lovableRecord: LovableRecord): RecordDTO {
    return {
      id: lovableRecord.id,
      content: this.tagsToContent(lovableRecord.tags),
      tagIds: [], // Cannot derive tagIds from Lovable format, would need additional mapping
      createdAt: this.formatDate(lovableRecord.createdAt),
      updatedAt: this.formatDate(lovableRecord.updatedAt)
    };
  }

  /**
   * Convert string array to space-separated content
   */
  static tagsToContent(tags: string[]): string {
    // Filter out tags with spaces to maintain data integrity
    const validTags = tags.filter(tag => !tag.includes(' '));
    return validTags.join(' ');
  }

  /**
   * Convert space-separated content to string array
   */
  static contentToTags(content: string): string[] {
    if (!content.trim()) {
      return [];
    }
    // Split by whitespace and filter out empty strings
    return content.trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Parse date string to Date object
   */
  static parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    return date;
  }

  /**
   * Format Date object to ISO string
   */
  static formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * Batch convert array of RecordDTOs to LovableRecords
   */
  static toLovableRecords(recordDTOs: RecordDTO[]): LovableRecord[] {
    return recordDTOs.map(dto => this.toLovableRecord(dto));
  }

  /**
   * Batch convert array of LovableRecords to RecordDTOs
   */
  static toRecordDTOs(lovableRecords: LovableRecord[]): RecordDTO[] {
    return lovableRecords.map(record => this.toRecordDTO(record));
  }
}