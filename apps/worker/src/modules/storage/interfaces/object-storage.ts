export interface ObjectStorage {
  getObject: (key: string) => Promise<Buffer>;
}
