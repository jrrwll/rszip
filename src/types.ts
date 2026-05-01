export interface Entry {
  name: string;
  path: string;
  size: number;
  ctime: number;
  mtime: number;
  type: "dir" | "audio" | "video" | "image" | "other" | "compress";
}

export interface DecompressInfo {
  size: number;
  file_count: number;
  cost: number;
}

export interface CompressInfo {
  size: number;
  file_count: number;
  cost: number;
}

export interface CompressParam {
  type: "zip" | "7z" | "gzip" | "bzip2" | "xz";
  level: number | null;
  password: string | null;
  volume: string | null;
}
