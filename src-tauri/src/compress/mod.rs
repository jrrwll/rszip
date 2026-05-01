use serde::{Deserialize, Serialize};

pub use command::*;

mod command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub ctime: u64,
    pub mtime: u64,
    #[serde(rename = "type")]
    pub entry_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DecompressInfo {
    pub size: u64,
    pub file_count: usize,
    pub cost: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompressInfo {
    pub size: u64,
    pub file_count: usize,
    pub cost: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CompressParam {
    pub r#type: String,
    pub level: Option<u8>,
    pub password: Option<String>,
    pub volume: Option<String>,
}
