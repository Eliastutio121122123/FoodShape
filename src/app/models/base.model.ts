export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
}

export interface TimeWindow {
  startsAt: string;
  endsAt: string;
}
