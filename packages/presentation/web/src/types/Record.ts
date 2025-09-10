export interface Record {
  id: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TagFrequency {
  tag: string;
  count: number;
}