import { Record } from '@misc-poc/domain';

export interface RecordDTO {
  readonly id: string;
  readonly content: string;
  readonly tagIds: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata?: {
    readonly source?: string;
    readonly version?: number;
    readonly operation?: 'create' | 'update' | 'import';
    readonly [key: string]: unknown;
  };
}

export class RecordDTOMapper {
  static toDTO(record: Record): RecordDTO {
    return {
      id: record.id.toString(),
      content: record.content.toString(),
      tagIds: Array.from(record.tagIds).map((tagId) => tagId.toString()),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  static toDTOs(records: Record[]): RecordDTO[] {
    return records.map((record) => this.toDTO(record));
  }
}
