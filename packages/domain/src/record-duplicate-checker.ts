import { Record } from './record';

export class RecordDuplicateChecker {
  isDuplicate(record1: Record, record2: Record): boolean {
    if (!record1 || !record2) {
      return false;
    }

    if (!(record1 instanceof Record) || !(record2 instanceof Record)) {
      return false;
    }

    return record1.hasSameTagSet(record2);
  }

  findDuplicatesIn(targetRecord: Record, records: Record[]): Record[] {
    if (!targetRecord || !(targetRecord instanceof Record)) {
      return [];
    }

    if (!records || !Array.isArray(records)) {
      return [];
    }

    const duplicates: Record[] = [];

    for (const record of records) {
      if (!record || !(record instanceof Record)) {
        continue; // Skip null/undefined/invalid entries
      }

      // Exclude the target record itself from results
      if (targetRecord.equals(record)) {
        continue;
      }

      if (this.isDuplicate(targetRecord, record)) {
        duplicates.push(record);
      }
    }

    return duplicates;
  }
}
