use blake3;

pub struct FileHasher;

impl FileHasher {
    pub fn calculate_hash(buffer: &[u8]) -> String {
        let hash = blake3::hash(buffer);
        hash.to_hex().to_string()
    }
}
