export interface ObjectStorage {
  putObject: (key: string, data: Buffer, contentType: string) => Promise<void>;
}
