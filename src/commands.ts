import { invoke } from "@tauri-apps/api/core";
import type { Entry, DecompressInfo, CompressInfo, CompressParam } from "./types";

export async function get_default_dir(): Promise<string> {
  return invoke<string>("get_default_dir");
}

export async function list_dir(path: string, password: string | null = null): Promise<Entry[]> {
  return invoke<Entry[]>("list_dir", { path, password });
}

export async function take_pending_open_path(): Promise<string | null> {
  return invoke<string | null>("take_pending_open_path");
}

export async function decompress(
  path: string,
  password: string | null,
  target_dir: string | null,
): Promise<DecompressInfo> {
  return invoke<DecompressInfo>("decompress", { path, password, targetDir: target_dir });
}

export async function decompress_test(
  path: string,
  password: string | null,
): Promise<DecompressInfo> {
  return invoke<DecompressInfo>("decompress_test", { path, password });
}

export async function compress(
  path: string[],
  compress_param: CompressParam,
  target_filename: string | null,
): Promise<CompressInfo> {
  return invoke<CompressInfo>("compress", {
    path,
    compressParam: compress_param,
    targetFilename: target_filename,
  });
}

export async function compress_add(
  path: string,
  file_path: string,
  password: string | null,
): Promise<CompressInfo> {
  return invoke<CompressInfo>("compress_add", { path, filePath: file_path, password });
}

export async function compress_remove(
  path: string[],
  password: string | null,
): Promise<CompressInfo> {
  return invoke<CompressInfo>("compress_remove", { path, password });
}

export async function compress_info(
  path: string,
  password: string | null,
): Promise<CompressInfo> {
  return invoke<CompressInfo>("compress_info", { path, password });
}

export async function compress_rename(
  path: string,
  new_name: string,
  password: string | null,
): Promise<CompressInfo> {
  return invoke<CompressInfo>("compress_rename", { path, newName: new_name, password });
}

export async function compress_password_detect(compress_path: string): Promise<boolean> {
  return invoke<boolean>("compress_password_detect", { compressPath: compress_path });
}

export async function get_default_handlers(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_default_handlers");
}

export async function set_default_handlers(exts: string[]): Promise<void> {
  return invoke<void>("set_default_handlers", { exts });
}

export async function get_context_menu_enabled(): Promise<Record<string, boolean>> {
  return invoke<Record<string, boolean>>("get_context_menu_enabled");
}

export async function set_context_menu_enabled(targets: string[]): Promise<void> {
  return invoke<void>("set_context_menu_enabled", { targets });
}

export async function load_recent(): Promise<string[]> {
  return invoke<string[]>("load_recent");
}

export async function save_recent(paths: string[]): Promise<void> {
  return invoke<void>("save_recent", { paths });
}
