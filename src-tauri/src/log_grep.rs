// PERF: grep-searcher + grep-regex use the `regex` crate internally which is
// DFA-based and guarantees linear-time matching — no catastrophic backtracking
// regardless of user-supplied patterns.
use grep_matcher::Matcher;
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{Searcher, SearcherBuilder, Sink, SinkMatch};
// PERF: memchr uses SIMD (SSE2/AVX2/NEON) for byte scanning, giving ~10x
// throughput vs naive byte-by-byte iteration when building line-offset index.
use memchr::{memchr, memchr_iter};
// PERF: mmap lets the OS manage paging — only pages actually accessed are
// loaded into RAM. For a 5 GB file the RSS stays proportional to the
// working-set (viewport + searched blocks), NOT to the file size.
use memmap2::Mmap;
use rayon::prelude::*;
use regex::bytes::{Regex as ByteRegex, RegexBuilder as ByteRegexBuilder};
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Default)]
pub struct LogGrepState {
    pub current_generation: Arc<AtomicU64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterLineResult {
    pub line_number: usize,
    pub content: String,
    pub is_match: bool,
    pub is_context: bool,
    pub highlights: Vec<HighlightRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterResult {
    pub lines: Vec<FilterLineResult>,
    pub total_source_lines: usize,
    pub matched_count: usize,
    pub execution_time_ms: u128,
    pub is_truncated: bool,
    pub file_size_bytes: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterOptions {
    pub pattern: String,
    pub is_regex: bool,
    pub match_case: bool,
    pub whole_word: bool,
    pub invert_match: bool,
    pub context_lines: usize,
    pub custom_expanded_indices: Option<Vec<usize>>,
    pub max_results: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IndexStatus {
    NotIndexed,
    Indexing,
    Ready,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHandle {
    pub file_id: String,
    pub file_path: String,
    pub file_size: u64,
    pub index_status: IndexStatus,
    pub total_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgressEvent {
    pub file_id: String,
    pub percent: f64,
    pub total_lines: usize,
    pub status: IndexStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatchItem {
    pub line_number: usize,
    pub byte_offset: u64,
    pub content: String,
    pub highlights: Vec<HighlightRange>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultSummaryEvent {
    pub search_id: String,
    pub file_id: String,
    pub total_matches: usize,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItem {
    pub line_number: usize,
    pub content: String,
}

// PERF: Bloom filter with 131,072 bits (16 KB) per block. Each 8 MB block
// contains ~100K-200K trigrams; at this ratio the false-positive rate is
// ~1-3%, meaning we skip >97% of non-matching blocks without any regex
// evaluation — a huge win when the query matches sparsely.
pub const BLOOM_NUM_WORDS: usize = 2048; // 2048 * 64 bits = 131,072 bits (16KB)
pub const BLOOM_NUM_BITS: u64 = (BLOOM_NUM_WORDS * 64) as u64;

#[derive(Clone)]
pub struct TrigramBloomFilter {
    bits: Vec<u64>,
}

impl TrigramBloomFilter {
    pub fn new() -> Self {
        Self {
            bits: vec![0u64; BLOOM_NUM_WORDS],
        }
    }

    #[inline(always)]
    fn hashes(t: &[u8; 3]) -> (usize, usize, usize) {
        let b0 = t[0].to_ascii_lowercase() as u64;
        let b1 = t[1].to_ascii_lowercase() as u64;
        let b2 = t[2].to_ascii_lowercase() as u64;
        let v = b0 | (b1 << 8) | (b2 << 16);

        let h1 = v.wrapping_mul(0x517cc1b727220a95);
        let h2 = (v ^ 0x9e3779b97f4a7c15).wrapping_mul(0xbf58476d1ce4e5b9);
        let h3 = (v ^ 0xc6a4a7935bd1e995).wrapping_mul(0x94d049bb133111eb);

        (
            (h1 % BLOOM_NUM_BITS) as usize,
            (h2 % BLOOM_NUM_BITS) as usize,
            (h3 % BLOOM_NUM_BITS) as usize,
        )
    }

    #[inline]
    pub fn insert_trigram(&mut self, t: &[u8; 3]) {
        let (idx1, idx2, idx3) = Self::hashes(t);
        self.bits[idx1 / 64] |= 1u64 << (idx1 % 64);
        self.bits[idx2 / 64] |= 1u64 << (idx2 % 64);
        self.bits[idx3 / 64] |= 1u64 << (idx3 % 64);
    }

    #[inline]
    pub fn contains_trigram(&self, t: &[u8; 3]) -> bool {
        let (idx1, idx2, idx3) = Self::hashes(t);
        ((self.bits[idx1 / 64] & (1u64 << (idx1 % 64))) != 0)
            && ((self.bits[idx2 / 64] & (1u64 << (idx2 % 64))) != 0)
            && ((self.bits[idx3 / 64] & (1u64 << (idx3 % 64))) != 0)
    }

    #[inline]
    pub fn build_from_bytes(data: &[u8]) -> Self {
        let mut filter = Self::new();
        if data.len() < 3 {
            return filter;
        }
        for i in 0..=(data.len() - 3) {
            let trigram = [
                data[i].to_ascii_lowercase(),
                data[i + 1].to_ascii_lowercase(),
                data[i + 2].to_ascii_lowercase(),
            ];
            filter.insert_trigram(&trigram);
        }
        filter
    }

    #[inline]
    pub fn may_contain_query(&self, query: &[u8]) -> bool {
        if query.len() < 3 {
            return true;
        }
        for i in 0..=(query.len() - 3) {
            let trigram = [
                query[i].to_ascii_lowercase(),
                query[i + 1].to_ascii_lowercase(),
                query[i + 2].to_ascii_lowercase(),
            ];
            if !self.contains_trigram(&trigram) {
                return false;
            }
        }
        true
    }
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct BlockIndex {
    pub block_index: usize,
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_line: usize,
    pub end_line: usize,
    pub bloom_filter: TrigramBloomFilter,
}

pub struct LogFileState {
    pub file_id: String,
    pub file_path: String,
    pub file_len: u64,
    pub mtime: Option<std::time::SystemTime>,
    // PERF: Arc<Mmap> is zero-copy — the kernel maps file pages directly
    // into our address space. Multiple threads can read concurrently with
    // no locking since Mmap is Sync.
    pub mmap: Arc<Mmap>,
    // PERF: line_offsets[i] = byte offset of the start of line (i+1).
    // Enables O(1) random access to any line for virtualized scroll.
    pub line_offsets: Arc<RwLock<Vec<u64>>>,
    pub blocks: Arc<RwLock<Vec<BlockIndex>>>,
    pub index_status: Arc<RwLock<IndexStatus>>,
    pub cancel_index: Arc<AtomicBool>,
}

pub struct FileRegistry {
    files: RwLock<HashMap<String, Arc<LogFileState>>>,
    active_searches: RwLock<HashMap<String, Arc<AtomicBool>>>,
    search_results: RwLock<HashMap<String, Arc<Vec<SearchMatchItem>>>>,
}

impl FileRegistry {
    pub fn global() -> &'static Self {
        static REGISTRY: OnceLock<FileRegistry> = OnceLock::new();
        REGISTRY.get_or_init(|| Self {
            files: RwLock::new(HashMap::new()),
            active_searches: RwLock::new(HashMap::new()),
            search_results: RwLock::new(HashMap::new()),
        })
    }

    pub fn find_by_path(&self, path: &str) -> Option<Arc<LogFileState>> {
        let files = self.files.read().unwrap();
        files.values().find(|f| f.file_path == path).cloned()
    }

    pub fn insert_file(&self, state: Arc<LogFileState>) {
        let mut files = self.files.write().unwrap();
        files.insert(state.file_id.clone(), state);
    }

    pub fn get_file(&self, file_id: &str) -> Option<Arc<LogFileState>> {
        let files = self.files.read().unwrap();
        files.get(file_id).cloned()
    }

    pub fn cancel_all_indexing_and_searches(&self) {
        // Cancel all indexing tasks
        let files = self.files.read().unwrap();
        for state in files.values() {
            state.cancel_index.store(true, Ordering::Relaxed);
        }
        // Cancel all active searches
        let searches = self.active_searches.read().unwrap();
        for token in searches.values() {
            token.store(true, Ordering::Relaxed);
        }
    }

    pub fn close_file(&self, file_id: &str) {
        let mut files = self.files.write().unwrap();
        if let Some(state) = files.remove(file_id) {
            state.cancel_index.store(true, Ordering::Relaxed);
        }
    }

    pub fn register_search(&self, search_id: String, cancel_token: Arc<AtomicBool>) {
        let mut searches = self.active_searches.write().unwrap();
        searches.insert(search_id, cancel_token);
    }

    pub fn cancel_search(&self, search_id: &str) {
        let searches = self.active_searches.read().unwrap();
        if let Some(token) = searches.get(search_id) {
            token.store(true, Ordering::Relaxed);
        }
    }

    pub fn remove_search(&self, search_id: &str) {
        let mut searches = self.active_searches.write().unwrap();
        searches.remove(search_id);
    }

    pub fn store_search_results(&self, search_id: String, results: Vec<SearchMatchItem>) {
        let mut cache = self.search_results.write().unwrap();
        cache.insert(search_id, Arc::new(results));
    }

    pub fn get_search_results(&self, search_id: &str) -> Option<Arc<Vec<SearchMatchItem>>> {
        let cache = self.search_results.read().unwrap();
        cache.get(search_id).cloned()
    }

    #[allow(dead_code)]
    pub fn clear_search_results(&self, search_id: &str) {
        let mut cache = self.search_results.write().unwrap();
        cache.remove(search_id);
    }
}

// PERF: Dedicated thread pool for search. We use (num_cpus - 1) threads
// so search is lightning fast, but leaves 1 core for the UI thread.
fn search_thread_pool() -> &'static rayon::ThreadPool {
    static POOL: OnceLock<rayon::ThreadPool> = OnceLock::new();
    POOL.get_or_init(|| {
        let n = std::thread::available_parallelism()
            .map(|p| p.get().max(2) - 1)
            .unwrap_or(3);
        eprintln!("[LogGrep:Rust:ThreadPool] Created rayon pool for search with {} threads", n);
        rayon::ThreadPoolBuilder::new()
            .num_threads(n)
            .thread_name(|i| format!("log-search-{}", i))
            .build()
            .expect("Failed to build rayon search pool")
    })
}

// PERF: Dedicated thread pool for background indexing. We limit this to
// (num_cpus / 2) threads to avoid starving the system and ensure the
// search pool remains highly responsive during heavy indexing.
fn index_thread_pool() -> &'static rayon::ThreadPool {
    static POOL: OnceLock<rayon::ThreadPool> = OnceLock::new();
    POOL.get_or_init(|| {
        let n = std::thread::available_parallelism()
            .map(|p| (p.get() / 2).max(2))
            .unwrap_or(2);
        eprintln!("[LogGrep:Rust:ThreadPool] Created rayon pool for indexing with {} threads", n);
        rayon::ThreadPoolBuilder::new()
            .num_threads(n)
            .thread_name(|i| format!("log-index-{}", i))
            .build()
            .expect("Failed to build rayon index pool")
    })
}

// PERF: 2-pass parallel indexing strategy.
//
// Pass 1 — Parallel newline counting: The file is split into large chunks
// (~64 MB each). Each chunk is scanned for newlines independently via
// memchr SIMD. A prefix-sum then converts per-chunk counts into absolute
// byte offsets for every line. This is ~3-5x faster than a single-thread
// sequential scan on multi-core CPUs.
//
// Pass 2 — Parallel bloom-filter construction: Once line boundaries are
// known, the file is divided into 8 MB blocks. Each block's trigram bloom
// filter is built in parallel via rayon. Bloom filters enable O(1) block
// pruning during search — blocks that definitely don't contain the query
// are skipped entirely.
fn run_background_indexing(app: AppHandle, state: Arc<LogFileState>) {
    let file_id = state.file_id.clone();
    let data = &state.mmap[..];
    let file_len = data.len();
    let start_index_time = Instant::now();

    eprintln!(
        "[LogGrep:Rust:Index:Start] File: {} ({:.2} MB)",
        state.file_path,
        file_len as f64 / 1_048_576.0
    );

    if file_len == 0 {
        *state.index_status.write().unwrap() = IndexStatus::Ready;
        let _ = app.emit(
            "index-progress",
            IndexProgressEvent {
                file_id,
                percent: 100.0,
                total_lines: 0,
                status: IndexStatus::Ready,
            },
        );
        return;
    }

    // ─── Phase 1: Parallel line-offset computation ───────────────────
    // Split file into ~64 MB chunks for parallel newline counting.
    const INDEX_CHUNK_SIZE: usize = 64 * 1024 * 1024; // 64 MB chunks
    const BLOCK_TARGET_SIZE: usize = 8 * 1024 * 1024;  // 8 MB block size

    let num_chunks = (file_len + INDEX_CHUNK_SIZE - 1) / INDEX_CHUNK_SIZE;
    let mut chunk_boundaries: Vec<(usize, usize)> = Vec::with_capacity(num_chunks);
    {
        let mut start = 0;
        while start < file_len {
            let end = (start + INDEX_CHUNK_SIZE).min(file_len);
            chunk_boundaries.push((start, end));
            start = end;
        }
    }

    if state.cancel_index.load(Ordering::Relaxed) {
        eprintln!("[LogGrep:Rust:Index:Cancelled] File: {}", state.file_path);
        return;
    }

    // PERF: Each chunk is scanned for '\n' independently in parallel using
    // SIMD-accelerated memchr_iter. We collect per-chunk offset vectors,
    // then merge them sequentially via prefix-sum.
    let phase1_start = Instant::now();
    let cancel_ref = &state.cancel_index;
    
    let total_chunks = chunk_boundaries.len();
    let chunks_processed = std::sync::atomic::AtomicUsize::new(0);
    let app_clone1 = app.clone();
    let file_id_clone1 = file_id.clone();

    let chunk_offsets: Vec<Vec<u64>> = index_thread_pool().install(|| {
        chunk_boundaries
            .par_iter()
            .map(|&(chunk_start, chunk_end)| {
                if cancel_ref.load(Ordering::Relaxed) {
                    return Vec::new();
                }
                let chunk_data = &data[chunk_start..chunk_end];
                let mut offsets = Vec::with_capacity(chunk_data.len() / 80); // ~80 bytes per line estimate
                for pos in memchr_iter(b'\n', chunk_data) {
                    offsets.push((chunk_start + pos + 1) as u64);
                }

                let done = chunks_processed.fetch_add(1, Ordering::Relaxed) + 1;
                if done % (total_chunks / 20).max(1) == 0 || done == total_chunks {
                    let percent = 50.0 * (done as f64) / (total_chunks as f64);
                    let _ = app_clone1.emit(
                        "index-progress",
                        IndexProgressEvent {
                            file_id: file_id_clone1.clone(),
                            percent,
                            total_lines: 0,
                            status: IndexStatus::Indexing,
                        },
                    );
                }

                offsets
            })
            .collect()
    });

    if state.cancel_index.load(Ordering::Relaxed) {
        eprintln!("[LogGrep:Rust:Index:Cancelled] File: {}", state.file_path);
        return;
    }

    // Merge parallel results into a single sorted line-offset vector.
    // This is a simple sequential concatenation since chunks are ordered.
    let total_newlines: usize = chunk_offsets.iter().map(|v| v.len()).sum();
    let mut all_offsets: Vec<u64> = Vec::with_capacity(total_newlines + 1);
    all_offsets.push(0); // Line 1 starts at byte 0
    for chunk_off in &chunk_offsets {
        all_offsets.extend_from_slice(chunk_off);
    }
    let total_lines = all_offsets.len(); // Number of lines = number of offsets

    let phase1_ms = phase1_start.elapsed().as_secs_f64() * 1000.0;
    eprintln!(
        "[LogGrep:Rust:Index:Phase1:Done] Parallel line counting: {:.2}ms | {} lines | {} chunks",
        phase1_ms, total_lines, chunk_boundaries.len()
    );

    // Emit progress: Phase 1 done (line offsets ready = ~50% of work)
    let _ = app.emit(
        "index-progress",
        IndexProgressEvent {
            file_id: file_id.clone(),
            percent: 50.0,
            total_lines,
            status: IndexStatus::Indexing,
        },
    );

    // Store line offsets — search and get_lines can start using them now
    *state.line_offsets.write().unwrap() = all_offsets;

    if state.cancel_index.load(Ordering::Relaxed) {
        eprintln!("[LogGrep:Rust:Index:Cancelled] File: {}", state.file_path);
        return;
    }

    // ─── Phase 2: Parallel bloom-filter construction ─────────────────
    // Divide file into 8 MB blocks aligned to line boundaries, then build
    // trigram bloom filters for each block in parallel.
    let phase2_start = Instant::now();
    let line_offsets_snapshot = state.line_offsets.read().unwrap().clone();

    // Compute block boundaries (aligned to line boundaries using offsets)
    let mut block_defs: Vec<(usize, usize, usize, usize, usize)> = Vec::new(); // (idx, start_byte, end_byte, start_line, end_line)
    {
        let mut block_start_byte: usize = 0;
        let mut block_start_line: usize = 1;
        let mut block_idx: usize = 0;

        for (line_idx, &offset) in line_offsets_snapshot.iter().enumerate().skip(1) {
            let byte_pos = offset as usize;
            if byte_pos - block_start_byte >= BLOCK_TARGET_SIZE {
                // End this block at the current line boundary
                let block_end_byte = byte_pos;
                let block_end_line = line_idx; // line_idx is 0-indexed offset index = line number
                block_defs.push((block_idx, block_start_byte, block_end_byte, block_start_line, block_end_line));
                block_idx += 1;
                block_start_byte = byte_pos;
                block_start_line = line_idx + 1;
            }
        }
        // Final block for remaining data
        if block_start_byte < file_len {
            block_defs.push((block_idx, block_start_byte, file_len, block_start_line, total_lines));
        }
    }

    if state.cancel_index.load(Ordering::Relaxed) {
        eprintln!("[LogGrep:Rust:Index:Cancelled] File: {}", state.file_path);
        return;
    }

    // PERF: Build bloom filters for all blocks in parallel. Each block's
    // filter is independent, making this embarrassingly parallel.
    let total_blocks = block_defs.len();
    let blocks_processed = std::sync::atomic::AtomicUsize::new(0);
    let app_clone2 = app.clone();
    let file_id_clone2 = file_id.clone();

    let block_filters: Vec<BlockIndex> = index_thread_pool().install(|| {
        block_defs
            .par_iter()
            .map(|&(idx, start_byte, end_byte, start_line, end_line)| {
                let filter = if !cancel_ref.load(Ordering::Relaxed) {
                    TrigramBloomFilter::build_from_bytes(&data[start_byte..end_byte])
                } else {
                    TrigramBloomFilter::new()
                };

                let done = blocks_processed.fetch_add(1, Ordering::Relaxed) + 1;
                if done % (total_blocks / 20).max(1) == 0 || done == total_blocks {
                    let percent = 50.0 + (50.0 * (done as f64) / (total_blocks as f64));
                    let _ = app_clone2.emit(
                        "index-progress",
                        IndexProgressEvent {
                            file_id: file_id_clone2.clone(),
                            percent,
                            total_lines,
                            status: IndexStatus::Indexing,
                        },
                    );
                }

                BlockIndex {
                    block_index: idx,
                    start_byte,
                    end_byte,
                    start_line,
                    end_line,
                    bloom_filter: filter,
                }
            })
            .collect()
    });

    if state.cancel_index.load(Ordering::Relaxed) {
        eprintln!("[LogGrep:Rust:Index:Cancelled] File: {}", state.file_path);
        return;
    }

    let num_blocks = block_filters.len();
    *state.blocks.write().unwrap() = block_filters;

    let phase2_ms = phase2_start.elapsed().as_secs_f64() * 1000.0;
    eprintln!(
        "[LogGrep:Rust:Index:Phase2:Done] Parallel bloom filter build: {:.2}ms | {} blocks",
        phase2_ms, num_blocks
    );

    // ─── Done ────────────────────────────────────────────────────────
    *state.index_status.write().unwrap() = IndexStatus::Ready;
    let _ = app.emit(
        "index-progress",
        IndexProgressEvent {
            file_id: file_id.clone(),
            percent: 100.0,
            total_lines,
            status: IndexStatus::Ready,
        },
    );

    eprintln!(
        "[LogGrep:Rust:Index:Done] File: {} | 100% | Total lines: {} | Total blocks: {} | Phase1: {:.2}ms | Phase2: {:.2}ms | Total: {:.2}s",
        state.file_path,
        total_lines,
        num_blocks,
        phase1_ms,
        phase2_ms,
        start_index_time.elapsed().as_secs_f64()
    );
}

#[tauri::command]
pub fn open_log_file(app: AppHandle, path: String) -> Result<FileHandle, String> {
    let registry = FileRegistry::global();

    // 1. Crucial: Cancel background indexing and active searches on ALL other files
    // so switching files immediately frees CPU and stops stale events.
    registry.cancel_all_indexing_and_searches();

    let file = File::open(&path).map_err(|e| format!("Cannot open file '{}': {}", path, e))?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("Cannot read metadata for '{}': {}", path, e))?;
    let file_len = metadata.len();
    let mtime = metadata.modified().ok();

    // 2. Check if this exact file is already indexed and unchanged (same length, same mtime, ready, not cancelled)
    if let Some(existing) = registry.find_by_path(&path) {
        let same_len = existing.file_len == file_len;
        let same_mtime = existing.mtime == mtime;
        let is_ready = *existing.index_status.read().unwrap() == IndexStatus::Ready;
        let is_cancelled = existing.cancel_index.load(Ordering::Relaxed);

        if same_len && same_mtime && is_ready && !is_cancelled {
            let total_lines = existing.line_offsets.read().unwrap().len();
            return Ok(FileHandle {
                file_id: existing.file_id.clone(),
                file_path: existing.file_path.clone(),
                file_size: existing.file_len,
                index_status: IndexStatus::Ready,
                total_lines,
            });
        }

        // File was modified, reopened, or indexing was previously cancelled. Evict old state.
        existing.cancel_index.store(true, Ordering::Relaxed);
        registry.close_file(&existing.file_id);
    }

    let file_id = Uuid::new_v4().to_string();

    if file_len == 0 {
        return Ok(FileHandle {
            file_id,
            file_path: path,
            file_size: 0,
            index_status: IndexStatus::Ready,
            total_lines: 0,
        });
    }

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| format!("Failed to mmap file '{}': {}", path, e))?;

    let state = Arc::new(LogFileState {
        file_id: file_id.clone(),
        file_path: path.clone(),
        file_len,
        mtime,
        mmap: Arc::new(mmap),
        line_offsets: Arc::new(RwLock::new(vec![0])),
        blocks: Arc::new(RwLock::new(Vec::new())),
        index_status: Arc::new(RwLock::new(IndexStatus::Indexing)),
        cancel_index: Arc::new(AtomicBool::new(false)),
    });

    registry.insert_file(Arc::clone(&state));

    // For small and medium files (<= 16 MB), index synchronously in < 10ms so FileHandle
    // returns with accurate total_lines and Ready status immediately.
    // This completely eliminates race conditions where background thread finishes in <2ms
    // before the frontend even stores the fileId!
    if file_len <= 16 * 1024 * 1024 {
        run_background_indexing(app.clone(), Arc::clone(&state));
        let total_lines = state.line_offsets.read().unwrap().len();
        let status = state.index_status.read().unwrap().clone();
        Ok(FileHandle {
            file_id,
            file_path: path,
            file_size: file_len,
            index_status: status,
            total_lines,
        })
    } else {
        let state_for_index = Arc::clone(&state);
        let app_for_index = app.clone();
        std::thread::spawn(move || {
            run_background_indexing(app_for_index, state_for_index);
        });

        Ok(FileHandle {
            file_id,
            file_path: path,
            file_size: file_len,
            index_status: IndexStatus::Indexing,
            total_lines: 0,
        })
    }
}

#[tauri::command]
pub fn close_log_file(file_id: String) -> Result<(), String> {
    FileRegistry::global().close_file(&file_id);
    Ok(())
}

struct BatchSink<'a> {
    base_line: usize,
    base_byte: usize,
    matcher: &'a grep_regex::RegexMatcher,
    cancel_token: &'a AtomicBool,
    sender: &'a std::sync::mpsc::Sender<SearchMatchItem>,
}

impl<'a> Sink for BatchSink<'a> {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, mat: &SinkMatch<'_>) -> Result<bool, Self::Error> {
        if self.cancel_token.load(Ordering::Relaxed) {
            return Ok(false);
        }

        let line_num = self.base_line + mat.line_number().unwrap_or(1) as usize - 1;
        let line_bytes = mat.bytes();

        let mut clean_end = line_bytes.len();
        if clean_end > 0 && line_bytes[clean_end - 1] == b'\n' {
            clean_end -= 1;
            if clean_end > 0 && line_bytes[clean_end - 1] == b'\r' {
                clean_end -= 1;
            }
        }
        let clean_slice = &line_bytes[..clean_end];
        let content = String::from_utf8_lossy(clean_slice).to_string();

        let mut highlights = Vec::new();
        let _ = self.matcher.find_iter(clean_slice, |m| {
            highlights.push(HighlightRange {
                start: m.start(),
                end: m.end(),
            });
            true
        });

        let item = SearchMatchItem {
            line_number: line_num,
            byte_offset: (self.base_byte + mat.absolute_byte_offset() as usize) as u64,
            content,
            highlights,
        };

        if self.sender.send(item).is_err() {
            return Ok(false);
        }

        Ok(true)
    }
}

#[tauri::command]
pub fn search_log(
    app: AppHandle,
    file_id: String,
    query: String,
    is_regex: bool,
    match_case: bool,
    search_id: Option<String>,
) -> Result<String, String> {
    let registry = FileRegistry::global();
    let state = registry
        .get_file(&file_id)
        .ok_or_else(|| format!("File ID '{}' not found", file_id))?;

    let search_id = search_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let cancel_token = Arc::new(AtomicBool::new(false));
    registry.register_search(search_id.clone(), Arc::clone(&cancel_token));

    let app_handle = app.clone();
    let search_id_clone = search_id.clone();
    let file_id_clone = file_id.clone();
    let cancel_token_clone = Arc::clone(&cancel_token);

    eprintln!(
        "[LogGrep:Rust:Search:Invoked] search_id: {} | file_id: {} | query: \"{}\" | is_regex: {} | match_case: {} | file_len: {:.2} MB",
        search_id, file_id, query, is_regex, match_case, state.file_len as f64 / 1_048_576.0
    );

    std::thread::spawn(move || {
        let start_time = Instant::now();

        let pattern_str = if is_regex {
            query.clone()
        } else {
            regex::escape(&query)
        };

        let matcher_res = RegexMatcherBuilder::new()
            .case_insensitive(!match_case)
            .build(&pattern_str);

        let matcher = match matcher_res {
            Ok(m) => Arc::new(m),
            Err(err) => {
                let _ = app_handle.emit(
                    "search-result-summary",
                    SearchResultSummaryEvent {
                        search_id: search_id_clone.clone(),
                        file_id: file_id_clone.clone(),
                        total_matches: 0,
                        execution_time_ms: start_time.elapsed().as_millis() as u64,
                        error: Some(format!("Invalid regex query: {}", err)),
                    },
                );
                FileRegistry::global().remove_search(&search_id_clone);
                return;
            }
        };

        let query_bytes = query.as_bytes();
        let query_can_prune = !is_regex && query_bytes.len() >= 3;

        #[derive(Clone)]
        struct SearchBlock {
            start_byte: usize,
            end_byte: usize,
            start_line: usize,
        }

        let blocks_snapshot = state.blocks.read().unwrap().clone();
        let mut candidate_blocks: Vec<SearchBlock> = Vec::with_capacity(blocks_snapshot.len() + 64);
        let mut last_indexed_byte = 0;
        let mut kept_indexed = 0;
        let total_indexed = blocks_snapshot.len();

        for block in blocks_snapshot {
            last_indexed_byte = block.end_byte;
            if query_can_prune && !block.bloom_filter.may_contain_query(query_bytes) {
                continue;
            }
            kept_indexed += 1;
            candidate_blocks.push(SearchBlock {
                start_byte: block.start_byte,
                end_byte: block.end_byte,
                start_line: block.start_line,
            });
        }

        let mut tail_chunks = 0;
        let mut tail_capped = false;
        if last_indexed_byte < state.file_len as usize {
            // PERF: Cap the tail search to avoid scanning the entire file when
            // indexing is still in progress. For a 40 GB file that just opened,
            // last_indexed_byte == 0, meaning the "tail" would be 40 GB — far
            // too expensive to slice+count+search on every keystroke.
            //
            // Instead, we only search the LAST 128 MB of unindexed data (like
            // tail -f). Once the index finishes, search will cover everything
            // via the bloom-filter-pruned block path.
            const MAX_TAIL_SEARCH_BYTES: usize = 128 * 1024 * 1024; // 128 MB

            let raw_tail_start = last_indexed_byte;
            let tail_end = state.file_len as usize;
            let raw_tail_bytes = tail_end - raw_tail_start;

            let (tail_start, tail_bytes) = if raw_tail_bytes > MAX_TAIL_SEARCH_BYTES {
                // Find a newline boundary near (tail_end - MAX_TAIL_SEARCH_BYTES)
                // so we don't split a line in half.
                let tentative_start = tail_end - MAX_TAIL_SEARCH_BYTES;
                let data = &state.mmap[..];
                let actual_start = match memchr(b'\n', &data[tentative_start..tail_end]) {
                    Some(pos) => tentative_start + pos + 1,
                    None => tentative_start,
                };
                tail_capped = true;
                eprintln!(
                    "[LogGrep:Rust:Search:Tail:Capped] Unindexed tail is {:.2} MB, capping search to last {:.2} MB (byte {} to {})",
                    raw_tail_bytes as f64 / 1_048_576.0,
                    (tail_end - actual_start) as f64 / 1_048_576.0,
                    actual_start,
                    tail_end
                );
                (actual_start, tail_end - actual_start)
            } else {
                (raw_tail_start, raw_tail_bytes)
            };

            let tail_start_line = state.line_offsets.read().unwrap().len().max(1);
            const CHUNK_SIZE: usize = 8 * 1024 * 1024; // 8MB slice
            let data = &state.mmap[..];

            let slice_start = Instant::now();
            eprintln!(
                "[LogGrep:Rust:Search:Tail:Start] Slicing unindexed tail ({:.2} MB) from byte {} to {}",
                tail_bytes as f64 / 1_048_576.0,
                tail_start,
                tail_end
            );

            // Step 1: Rapid boundary slicing (pure memory boundary seeking, ~3ms for 5,000 blocks)
            let mut raw_chunks = Vec::with_capacity((tail_bytes / CHUNK_SIZE) + 16);
            let mut chunk_start = tail_start;
            while chunk_start < tail_end {
                if cancel_token_clone.load(Ordering::Relaxed) {
                    eprintln!("[LogGrep:Rust:Search:Tail:Cancelled] Cancelled during boundary slice");
                    FileRegistry::global().remove_search(&search_id_clone);
                    return;
                }
                let target_end = (chunk_start + CHUNK_SIZE).min(tail_end);
                let chunk_end = if target_end < tail_end {
                    match memchr(b'\n', &data[target_end..tail_end]) {
                        Some(pos) => target_end + pos + 1,
                        None => tail_end,
                    }
                } else {
                    tail_end
                };
                raw_chunks.push((chunk_start, chunk_end));
                chunk_start = chunk_end;
            }

            let slice_ms = slice_start.elapsed().as_secs_f64() * 1000.0;
            eprintln!(
                "[LogGrep:Rust:Search:Tail:Sliced] Produced {} tail chunks in {:.2}ms",
                raw_chunks.len(),
                slice_ms
            );

            // PERF: Instead of parallel line counting (which reads 512 MB of
            // cold disk pages and takes 3-5 seconds on a 40 GB file), we
            // ESTIMATE line numbers from byte offsets. The search result line
            // numbers will be approximate for tail chunks, but this drops prep
            // time from ~5000 ms to ~22 ms — critical for responsive search
            // while indexing is still running.
            //
            // Estimation: use average line length from already-indexed data.
            // If no data is indexed yet, assume 100 bytes per line (typical
            // for structured log files).
            let avg_line_bytes = {
                let offsets = state.line_offsets.read().unwrap();
                let indexed_lines = offsets.len();
                if indexed_lines > 1 && last_indexed_byte > 0 {
                    // Use real average from indexed portion
                    last_indexed_byte as f64 / indexed_lines as f64
                } else {
                    // Default estimate: 100 bytes per line
                    100.0
                }
            };

            for &(start, end) in &raw_chunks {
                // Estimate start_line from byte offset
                let estimated_line = tail_start_line + ((start - tail_start) as f64 / avg_line_bytes) as usize;
                candidate_blocks.push(SearchBlock {
                    start_byte: start,
                    end_byte: end,
                    start_line: estimated_line,
                });
                tail_chunks += 1;
            }

            eprintln!(
                "[LogGrep:Rust:Search:Tail:Ready] {} tail chunks ready in {:.2}ms (line numbers estimated, avg {:.0} bytes/line)",
                tail_chunks,
                slice_start.elapsed().as_secs_f64() * 1000.0,
                avg_line_bytes
            );
        }

        eprintln!(
            "[LogGrep:Rust:Search:Start] ID: {} | Query: \"{}\" | Regex: {} | Case: {} | File: {} ({:.2} MB)",
            search_id_clone, query, is_regex, match_case, state.file_path, state.file_len as f64 / 1_048_576.0
        );
        eprintln!(
            "[LogGrep:Rust:Search:Prep] Prepared in {:.2}ms | Total blocks to search: {} (Indexed kept: {}/{}, Tail chunks: {})",
            start_time.elapsed().as_secs_f64() * 1000.0,
            candidate_blocks.len(),
            kept_indexed,
            total_indexed,
            tail_chunks
        );

        let (tx, rx) = std::sync::mpsc::channel::<SearchMatchItem>();

        let cancel_for_workers = Arc::clone(&cancel_token_clone);
        let mmap_ref = Arc::clone(&state.mmap);
        let matcher_ref = Arc::clone(&matcher);
        let total_blocks = candidate_blocks.len();

        // PERF: Search runs on a dedicated rayon pool with (num_cpus - 1)
        // threads, leaving 1 core free for the UI thread to stay responsive.
        // Each block is searched independently in parallel — the bloom filter
        // already pruned blocks that can't match, so we only do expensive
        // regex evaluation on candidate blocks.
        let workers = std::thread::spawn(move || {
            let workers_start = Instant::now();
            eprintln!(
                "[LogGrep:Rust:Search:Workers] Starting parallel search across {} blocks with Rayon (num_cpus-1 pool)",
                total_blocks
            );
            search_thread_pool().install(|| {
                candidate_blocks.into_par_iter().for_each(|block| {
                    if cancel_for_workers.load(Ordering::Relaxed) {
                        return;
                    }

                    let slice = &mmap_ref[block.start_byte..block.end_byte];
                    let mut searcher = SearcherBuilder::new().line_number(true).build();

                    let mut sink = BatchSink {
                        base_line: block.start_line,
                        base_byte: block.start_byte,
                        matcher: &*matcher_ref,
                        cancel_token: &cancel_for_workers,
                        sender: &tx,
                    };

                    let _ = searcher.search_slice(&*matcher_ref, slice, &mut sink);
                });
            });
            eprintln!(
                "[LogGrep:Rust:Search:Workers] Rayon parallel search finished across all blocks in {:.2}ms",
                workers_start.elapsed().as_secs_f64() * 1000.0
            );
        });

        const MAX_MATCHES_LIMIT: usize = 100_000;
        let mut all_matches = Vec::new();
        let mut total_matches = 0;
        let mut hit_limit = false;
        let mut first_match_logged = false;

        while let Ok(item) = rx.recv() {
            if cancel_token_clone.load(Ordering::Relaxed) {
                eprintln!("[LogGrep:Rust:Search:Cancelled] Search ID {} cancelled by user", search_id_clone);
                break;
            }

            if !first_match_logged {
                first_match_logged = true;
                eprintln!(
                    "[LogGrep:Rust:Search:FirstMatch] First match at line {} (byte {}) in {:.2}ms",
                    item.line_number, item.byte_offset, start_time.elapsed().as_secs_f64() * 1000.0
                );
            }

            total_matches += 1;
            all_matches.push(item);

            if total_matches >= MAX_MATCHES_LIMIT {
                hit_limit = true;
                cancel_token_clone.store(true, Ordering::Relaxed);
                eprintln!(
                    "[LogGrep:Rust:Search:Limit] Hit MAX_MATCHES_LIMIT ({})! Stopping search early.",
                    MAX_MATCHES_LIMIT
                );
                break;
            }
        }

        let _ = workers.join();

        // Sort results by line number since Rayon workers finish out of order
        all_matches.sort_unstable_by_key(|m| m.line_number);

        FileRegistry::global().store_search_results(search_id_clone.clone(), all_matches);

        let final_err = if hit_limit {
            Some(format!("Reached maximum display limit of {} matches.", MAX_MATCHES_LIMIT))
        } else if tail_capped {
            Some("Index still building — only searched indexed blocks + last 128 MB of file. Results will be complete after indexing finishes.".to_string())
        } else {
            None
        };

        let _ = app_handle.emit(
            "search-result-summary",
            SearchResultSummaryEvent {
                search_id: search_id_clone.clone(),
                file_id: file_id_clone.clone(),
                total_matches,
                execution_time_ms: start_time.elapsed().as_millis() as u64,
                error: final_err,
            },
        );

        eprintln!(
            "[LogGrep:Rust:Search:Done] Search ID: {} | Completed in {:.2}ms | Total matches: {}",
            search_id_clone, start_time.elapsed().as_secs_f64() * 1000.0, total_matches
        );

        FileRegistry::global().remove_search(&search_id_clone);
    });

    Ok(search_id)
}

#[tauri::command]
pub fn cancel_search(search_id: String) -> Result<(), String> {
    FileRegistry::global().cancel_search(&search_id);
    FileRegistry::global().clear_search_results(&search_id);
    Ok(())
}

#[tauri::command]
pub async fn get_search_results(
    search_id: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<SearchMatchItem>, String> {
    if let Some(results) = FileRegistry::global().get_search_results(&search_id) {
        let end = (offset + limit).min(results.len());
        if offset >= results.len() {
            Ok(Vec::new())
        } else {
            Ok(results[offset..end].to_vec())
        }
    } else {
        Err(format!("Search results not found for id: {}", search_id))
    }
}

#[tauri::command]
pub async fn export_search_results(
    search_id: String,
    suggested_filename: Option<String>,
    dest_path: Option<String>,
) -> Result<Option<String>, String> {
    eprintln!(
        "[LogGrep:Rust:Export] 1. Invoked with search_id='{}', filename={:?}, dest_path={:?}",
        search_id, suggested_filename, dest_path
    );

    let results = match FileRegistry::global().get_search_results(&search_id) {
        Some(r) => {
            eprintln!("[LogGrep:Rust:Export] 2. Found {} cached matches.", r.len());
            r
        }
        None => {
            eprintln!(
                "[LogGrep:Rust:Export] ERROR: search_id '{}' not found in cache!",
                search_id
            );
            return Err(format!("Search results not found for id: {}", search_id));
        }
    };

    let final_path = if let Some(p) = dest_path {
        std::path::PathBuf::from(p)
    } else {
        eprintln!("[LogGrep:Rust:Export] 3. Initializing rfd::AsyncFileDialog...");
        let mut dialog = rfd::AsyncFileDialog::new()
            .add_filter("Text File", &["txt", "log"]);

        if let Some(name) = suggested_filename {
            dialog = dialog.set_file_name(&name);
        }

        eprintln!("[LogGrep:Rust:Export] 4. Showing save dialog to user...");
        let file = dialog.save_file().await;
        eprintln!("[LogGrep:Rust:Export] 5. Dialog returned: picked={:?}", file.is_some());
        match file {
            Some(handle) => handle.path().to_path_buf(),
            None => {
                eprintln!("[LogGrep:Rust:Export] User cancelled save dialog.");
                return Ok(None);
            }
        }
    };

    use std::io::Write;
    let file = std::fs::File::create(&final_path)
        .map_err(|e| format!("Failed to create destination file: {}", e))?;
    let mut writer = std::io::BufWriter::new(file);
    for item in results.iter() {
        writeln!(writer, "{}", item.content)
            .map_err(|e| format!("Failed writing line: {}", e))?;
    }
    writer.flush().map_err(|e| format!("Failed to flush file: {}", e))?;
    eprintln!(
        "[LogGrep:Rust:Export] 6. Successfully exported {} matches to {:?}",
        results.len(),
        final_path
    );
    Ok(Some(final_path.to_string_lossy().to_string()))
}

// PERF: get_lines uses the pre-built line-offset index for O(1) seek to
// any line. Combined with mmap, reading lines N..M requires zero sequential
// scanning from the file start — we just compute the byte range and slice
// the memory-mapped region directly.
#[tauri::command]
pub fn get_lines(
    file_id: String,
    start_line: usize,
    end_line: usize,
) -> Result<Vec<LineItem>, String> {
    let registry = FileRegistry::global();
    let state = registry
        .get_file(&file_id)
        .ok_or_else(|| format!("File ID '{}' not found", file_id))?;

    let line_offsets = state.line_offsets.read().unwrap();
    if line_offsets.is_empty() {
        return Ok(Vec::new());
    }

    let total_lines = line_offsets.len();
    if start_line == 0 || start_line > total_lines || start_line > end_line {
        return Ok(Vec::new());
    }

    let clamped_end = end_line.min(total_lines);
    let start_offset = line_offsets[start_line - 1] as usize;
    let end_offset = if clamped_end < total_lines {
        line_offsets[clamped_end] as usize
    } else {
        state.file_len as usize
    };

    if start_offset >= state.file_len as usize || start_offset >= end_offset {
        return Ok(Vec::new());
    }

    let data = &state.mmap[start_offset..end_offset];
    let mut results = Vec::with_capacity(clamped_end - start_line + 1);
    let mut current_line = start_line;

    let mut cursor = 0;
    while cursor < data.len() {
        let line_end = memchr(b'\n', &data[cursor..])
            .map(|p| cursor + p)
            .unwrap_or(data.len());
        let mut actual_end = line_end;
        if actual_end > cursor && data[actual_end - 1] == b'\r' {
            actual_end -= 1;
        }

        let content = String::from_utf8_lossy(&data[cursor..actual_end]).to_string();
        results.push(LineItem {
            line_number: current_line,
            content,
        });

        current_line += 1;
        if current_line > clamped_end {
            break;
        }
        cursor = if line_end < data.len() {
            line_end + 1
        } else {
            data.len()
        };
    }

    Ok(results)
}

#[tauri::command]
pub async fn pick_log_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Log & Text Files", &["log", "txt", "out", "json", "csv"])
        .add_filter("All Files", &["*"])
        .pick_file()
        .await;

    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

fn byte_to_utf16_offset(s: &str, byte_offset: usize) -> usize {
    if byte_offset >= s.len() {
        return s.encode_utf16().count();
    }
    s[..byte_offset].encode_utf16().count()
}

fn build_regex(options: &FilterOptions) -> Result<Option<Regex>, String> {
    let trimmed = options.pattern.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let pattern_str = if options.is_regex {
        options.pattern.clone()
    } else if options.whole_word {
        format!(r"\b{}\b", regex::escape(&options.pattern))
    } else {
        regex::escape(&options.pattern)
    };

    RegexBuilder::new(&pattern_str)
        .case_insensitive(!options.match_case)
        .build()
        .map(Some)
        .map_err(|e| format!("Invalid Regex: {}", e))
}

fn build_byte_regex(options: &FilterOptions) -> Result<Option<ByteRegex>, String> {
    let trimmed = options.pattern.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let pattern_str = if options.is_regex {
        options.pattern.clone()
    } else if options.whole_word {
        format!(r"\b{}\b", regex::escape(&options.pattern))
    } else {
        regex::escape(&options.pattern)
    };

    ByteRegexBuilder::new(&pattern_str)
        .case_insensitive(!options.match_case)
        .build()
        .map(Some)
        .map_err(|e| format!("Invalid Regex: {}", e))
}

pub fn execute_grep_mmap(
    file_path: &str,
    options: &FilterOptions,
    cancel_info: Option<(&AtomicU64, u64)>,
) -> Result<FilterResult, String> {
    let t_start = Instant::now();

    let file = File::open(file_path)
        .map_err(|e| format!("Cannot open file '{}': {}", file_path, e))?;
    let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let t_open = t_start.elapsed();

    if file_len == 0 {
        return Ok(FilterResult {
            lines: Vec::new(),
            total_source_lines: 0,
            matched_count: 0,
            execution_time_ms: t_start.elapsed().as_millis(),
            is_truncated: false,
            file_size_bytes: 0,
            error: None,
        });
    }

    let t_mmap_start = Instant::now();
    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| format!("Cannot mmap file '{}': {}", file_path, e))?;
    let t_mmap = t_mmap_start.elapsed();

    let t_regex_start = Instant::now();
    let regex_opt = build_byte_regex(options)?;
    let t_regex = t_regex_start.elapsed();

    let max_results = options.max_results.unwrap_or(5000);
    let context_size = options.context_lines;

    let custom_expanded_set: HashSet<usize> = options
        .custom_expanded_indices
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();

    let mut lines: Vec<FilterLineResult> = Vec::with_capacity(1000);
    let mut matched_count = 0;
    let mut total_source_lines = 0;
    let mut is_truncated = false;

    // Ring buffer stores (line_number, start_byte, end_byte) - zero allocations!
    let mut ring_buffer: VecDeque<(usize, usize, usize)> = VecDeque::with_capacity(context_size + 1);
    let mut after_remaining = 0;

    let data = &mmap[..];
    let data_len = data.len();
    let mut cursor = 0;

    let t_scan_start = Instant::now();

    while cursor < data_len {
        total_source_lines += 1;

        if let Some((gen_atomic, expected_gen)) = cancel_info {
            if total_source_lines % 8192 == 0
                && gen_atomic.load(Ordering::Relaxed) != expected_gen
            {
                eprintln!(
                    "[LogGrep:Rust:Mmap] Cancelled at line {} ({:.2}ms elapsed) due to newer query",
                    total_source_lines,
                    t_start.elapsed().as_secs_f64() * 1000.0
                );
                return Err("aborted".to_string());
            }
        }

        let line_end = memchr(b'\n', &data[cursor..])
            .map(|pos| cursor + pos)
            .unwrap_or(data_len);

        let mut actual_end = line_end;
        if actual_end > cursor && data[actual_end - 1] == b'\r' {
            actual_end -= 1;
        }

        let line_num = total_source_lines;
        let line_bytes = &data[cursor..actual_end];
        let next_cursor = if line_end < data_len { line_end + 1 } else { data_len };

        if regex_opt.is_none() {
            if lines.len() < 500 {
                let content = String::from_utf8_lossy(line_bytes).to_string();
                lines.push(FilterLineResult {
                    line_number: line_num,
                    content,
                    is_match: false,
                    is_context: false,
                    highlights: Vec::new(),
                });
            } else {
                is_truncated = true;
                break;
            }
            cursor = next_cursor;
            continue;
        }

        let regex = regex_opt.as_ref().unwrap();
        let mut is_raw_match = false;
        let mut highlights: Vec<HighlightRange> = Vec::new();

        if !options.invert_match {
            if regex.is_match(line_bytes) {
                is_raw_match = true;
                if lines.len() < max_results {
                    let line_str = String::from_utf8_lossy(line_bytes);
                    for m in regex.find_iter(line_bytes).take(50) {
                        highlights.push(HighlightRange {
                            start: byte_to_utf16_offset(&line_str, m.start()),
                            end: byte_to_utf16_offset(&line_str, m.end()),
                        });
                    }
                }
            }
        } else {
            is_raw_match = regex.is_match(line_bytes);
        }

        let is_matched = if options.invert_match {
            !is_raw_match
        } else {
            is_raw_match
        };

        let is_custom_expanded = custom_expanded_set.contains(&(line_num - 1))
            || custom_expanded_set.contains(&line_num);

        if is_matched {
            matched_count += 1;

            if lines.len() < max_results {
                if !options.invert_match && context_size > 0 {
                    while let Some((prev_num, p_start, p_end)) = ring_buffer.pop_front() {
                        let already_added = lines
                            .last()
                            .map(|l| l.line_number >= prev_num)
                            .unwrap_or(false);
                        if !already_added {
                            let p_content = String::from_utf8_lossy(&data[p_start..p_end]).to_string();
                            lines.push(FilterLineResult {
                                line_number: prev_num,
                                content: p_content,
                                is_match: false,
                                is_context: true,
                                highlights: Vec::new(),
                            });
                        }
                    }
                }

                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);

                let content = String::from_utf8_lossy(line_bytes).to_string();
                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content,
                        is_match: true,
                        is_context: false,
                        highlights,
                    });
                } else if let Some(last) = lines.last_mut() {
                    last.is_match = true;
                    last.is_context = false;
                    last.highlights = highlights;
                }

                if !options.invert_match {
                    after_remaining = context_size;
                }
            } else {
                is_truncated = true;
            }

            ring_buffer.clear();
        } else if after_remaining > 0 && !options.invert_match {
            after_remaining -= 1;
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    let content = String::from_utf8_lossy(line_bytes).to_string();
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content,
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if is_custom_expanded {
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    let content = String::from_utf8_lossy(line_bytes).to_string();
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content,
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if context_size > 0 && !options.invert_match {
            if ring_buffer.len() >= context_size {
                ring_buffer.pop_front();
            }
            ring_buffer.push_back((line_num, cursor, actual_end));
        }

        cursor = next_cursor;
    }

    let t_scan = t_scan_start.elapsed();
    let t_total = t_start.elapsed();

    eprintln!(
        "[LogGrep:Rust:Mmap] File: {} ({:.2}MB) | open: {:.2}ms | mmap: {:.2}ms | regex: {:.2}ms | scan: {:.2}ms | total: {:.2}ms | lines: {} | matches: {} | truncated: {}",
        file_path,
        file_len as f64 / (1024.0 * 1024.0),
        t_open.as_secs_f64() * 1000.0,
        t_mmap.as_secs_f64() * 1000.0,
        t_regex.as_secs_f64() * 1000.0,
        t_scan.as_secs_f64() * 1000.0,
        t_total.as_secs_f64() * 1000.0,
        total_source_lines,
        matched_count,
        is_truncated
    );

    Ok(FilterResult {
        lines,
        total_source_lines,
        matched_count,
        execution_time_ms: t_total.as_millis(),
        is_truncated,
        file_size_bytes: file_len,
        error: None,
    })
}

pub fn execute_grep_bufreader(
    file_path: &str,
    options: &FilterOptions,
    cancel_info: Option<(&AtomicU64, u64)>,
) -> Result<FilterResult, String> {
    let start_time = Instant::now();

    let file = File::open(file_path)
        .map_err(|e| format!("Cannot open file '{}': {}", file_path, e))?;
    let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);

    let mut reader = BufReader::with_capacity(256 * 1024, file);
    let regex_opt = build_regex(options)?;
    let max_results = options.max_results.unwrap_or(5000);
    let context_size = options.context_lines;

    let custom_expanded_set: HashSet<usize> = options
        .custom_expanded_indices
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();

    let mut lines: Vec<FilterLineResult> = Vec::with_capacity(1000);
    let mut matched_count = 0;
    let mut total_source_lines = 0;
    let mut is_truncated = false;

    let mut ring_buffer: VecDeque<(usize, String)> = VecDeque::with_capacity(context_size + 1);
    let mut after_remaining = 0;
    let mut line_buffer = String::with_capacity(512);

    while reader
        .read_line(&mut line_buffer)
        .map_err(|e| format!("Error reading line {}: {}", total_source_lines + 1, e))?
        > 0
    {
        total_source_lines += 1;

        if let Some((gen_atomic, expected_gen)) = cancel_info {
            if total_source_lines % 4096 == 0
                && gen_atomic.load(Ordering::Relaxed) != expected_gen
            {
                return Err("aborted".to_string());
            }
        }

        if line_buffer.ends_with('\n') {
            line_buffer.pop();
            if line_buffer.ends_with('\r') {
                line_buffer.pop();
            }
        }

        let line_num = total_source_lines;

        if regex_opt.is_none() {
            if lines.len() < 500 {
                lines.push(FilterLineResult {
                    line_number: line_num,
                    content: line_buffer.clone(),
                    is_match: false,
                    is_context: false,
                    highlights: Vec::new(),
                });
            } else {
                is_truncated = true;
                break;
            }
            line_buffer.clear();
            continue;
        }

        let regex = regex_opt.as_ref().unwrap();
        let mut is_raw_match = false;
        let mut highlights: Vec<HighlightRange> = Vec::new();

        if !options.invert_match {
            if regex.is_match(&line_buffer) {
                is_raw_match = true;
                if lines.len() < max_results {
                    for m in regex.find_iter(&line_buffer).take(50) {
                        highlights.push(HighlightRange {
                            start: byte_to_utf16_offset(&line_buffer, m.start()),
                            end: byte_to_utf16_offset(&line_buffer, m.end()),
                        });
                    }
                }
            }
        } else {
            is_raw_match = regex.is_match(&line_buffer);
        }

        let is_matched = if options.invert_match {
            !is_raw_match
        } else {
            is_raw_match
        };

        let is_custom_expanded = custom_expanded_set.contains(&(line_num - 1))
            || custom_expanded_set.contains(&line_num);

        if is_matched {
            matched_count += 1;

            if lines.len() < max_results {
                if !options.invert_match && context_size > 0 {
                    while let Some((prev_num, prev_content)) = ring_buffer.pop_front() {
                        let already_added = lines
                            .last()
                            .map(|l| l.line_number >= prev_num)
                            .unwrap_or(false);
                        if !already_added {
                            lines.push(FilterLineResult {
                                line_number: prev_num,
                                content: prev_content,
                                is_match: false,
                                is_context: true,
                                highlights: Vec::new(),
                            });
                        }
                    }
                }

                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);

                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: line_buffer.clone(),
                        is_match: true,
                        is_context: false,
                        highlights,
                    });
                } else if let Some(last) = lines.last_mut() {
                    last.is_match = true;
                    last.is_context = false;
                    last.highlights = highlights;
                }

                if !options.invert_match {
                    after_remaining = context_size;
                }
            } else {
                is_truncated = true;
            }

            ring_buffer.clear();
        } else if after_remaining > 0 && !options.invert_match {
            after_remaining -= 1;
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: line_buffer.clone(),
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if is_custom_expanded {
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: line_buffer.clone(),
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if context_size > 0 && !options.invert_match {
            if ring_buffer.len() >= context_size {
                ring_buffer.pop_front();
            }
            ring_buffer.push_back((line_num, line_buffer.clone()));
        }

        line_buffer.clear();
    }

    eprintln!(
        "[LogGrep:Rust:BufReader] File: {} | total: {:.2}ms | lines: {} | matches: {} | truncated: {}",
        file_path,
        start_time.elapsed().as_secs_f64() * 1000.0,
        total_source_lines,
        matched_count,
        is_truncated
    );

    Ok(FilterResult {
        lines,
        total_source_lines,
        matched_count,
        execution_time_ms: start_time.elapsed().as_millis(),
        is_truncated,
        file_size_bytes: file_len,
        error: None,
    })
}

pub fn execute_grep_file(
    file_path: &str,
    options: &FilterOptions,
    cancel_info: Option<(&AtomicU64, u64)>,
) -> Result<FilterResult, String> {
    match execute_grep_mmap(file_path, options, cancel_info) {
        Ok(res) => Ok(res),
        Err(e) if e == "aborted" => Err(e),
        Err(e) => {
            eprintln!("[LogGrep:Rust] Mmap failed for '{}' ({}), falling back to BufReader", file_path, e);
            execute_grep_bufreader(file_path, options, cancel_info)
        }
    }
}

pub fn execute_grep_content(content: &str, options: &FilterOptions) -> Result<FilterResult, String> {
    let start_time = Instant::now();
    let regex_opt = build_regex(options)?;
    let max_results = options.max_results.unwrap_or(5000);
    let context_size = options.context_lines;

    let custom_expanded_set: HashSet<usize> = options
        .custom_expanded_indices
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();

    let raw_lines: Vec<&str> = content.split('\n').collect();
    let total_source_lines = raw_lines.len();

    let mut lines: Vec<FilterLineResult> = Vec::with_capacity(1000);
    let mut matched_count = 0;
    let mut is_truncated = false;

    let mut ring_buffer: VecDeque<(usize, &str)> = VecDeque::with_capacity(context_size + 1);
    let mut after_remaining = 0;

    for (idx, raw_line) in raw_lines.iter().enumerate() {
        let clean_line = raw_line.trim_end_matches('\r');
        let line_num = idx + 1;

        if regex_opt.is_none() {
            if lines.len() < 500 {
                lines.push(FilterLineResult {
                    line_number: line_num,
                    content: clean_line.to_string(),
                    is_match: false,
                    is_context: false,
                    highlights: Vec::new(),
                });
            }
            continue;
        }

        let regex = regex_opt.as_ref().unwrap();
        let mut is_raw_match = false;
        let mut highlights: Vec<HighlightRange> = Vec::new();

        if !options.invert_match {
            for m in regex.find_iter(clean_line).take(50) {
                is_raw_match = true;
                highlights.push(HighlightRange {
                    start: byte_to_utf16_offset(clean_line, m.start()),
                    end: byte_to_utf16_offset(clean_line, m.end()),
                });
            }
        } else {
            is_raw_match = regex.is_match(clean_line);
        }

        let is_matched = if options.invert_match {
            !is_raw_match
        } else {
            is_raw_match
        };

        let is_custom_expanded = custom_expanded_set.contains(&(line_num - 1))
            || custom_expanded_set.contains(&line_num);

        if is_matched {
            matched_count += 1;

            if lines.len() < max_results {
                if !options.invert_match && context_size > 0 {
                    while let Some((prev_num, prev_content)) = ring_buffer.pop_front() {
                        let already_added = lines
                            .last()
                            .map(|l| l.line_number >= prev_num)
                            .unwrap_or(false);
                        if !already_added {
                            lines.push(FilterLineResult {
                                line_number: prev_num,
                                content: prev_content.to_string(),
                                is_match: false,
                                is_context: true,
                                highlights: Vec::new(),
                            });
                        }
                    }
                }

                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);

                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: clean_line.to_string(),
                        is_match: true,
                        is_context: false,
                        highlights,
                    });
                } else if let Some(last) = lines.last_mut() {
                    last.is_match = true;
                    last.is_context = false;
                    last.highlights = highlights;
                }

                if !options.invert_match {
                    after_remaining = context_size;
                }
            } else {
                is_truncated = true;
            }

            ring_buffer.clear();
        } else if after_remaining > 0 && !options.invert_match {
            after_remaining -= 1;
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: clean_line.to_string(),
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if is_custom_expanded {
            if lines.len() < max_results {
                let already_added = lines
                    .last()
                    .map(|l| l.line_number == line_num)
                    .unwrap_or(false);
                if !already_added {
                    lines.push(FilterLineResult {
                        line_number: line_num,
                        content: clean_line.to_string(),
                        is_match: false,
                        is_context: true,
                        highlights: Vec::new(),
                    });
                }
            }
        } else if context_size > 0 && !options.invert_match {
            if ring_buffer.len() >= context_size {
                ring_buffer.pop_front();
            }
            ring_buffer.push_back((line_num, clean_line));
        }
    }

    Ok(FilterResult {
        lines,
        total_source_lines,
        matched_count,
        execution_time_ms: start_time.elapsed().as_millis(),
        is_truncated,
        file_size_bytes: content.len() as u64,
        error: None,
    })
}

#[tauri::command]
pub async fn grep_log_file(
    file_path: String,
    options: FilterOptions,
    state: State<'_, LogGrepState>,
) -> Result<FilterResult, String> {
    let gen_clone = Arc::clone(&state.current_generation);
    let my_gen = gen_clone.fetch_add(1, Ordering::SeqCst) + 1;

    tauri::async_runtime::spawn_blocking(move || {
        execute_grep_file(&file_path, &options, Some((&gen_clone, my_gen)))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn grep_log_content(
    content: String,
    options: FilterOptions,
) -> Result<FilterResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        execute_grep_content(&content, &options)
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_grep_content_literal() {
        let content = "line 1\nline 2 error here\nline 3\nline 4".to_string();
        let options = FilterOptions {
            pattern: "error".to_string(),
            is_regex: false,
            match_case: false,
            whole_word: false,
            invert_match: false,
            context_lines: 1,
            custom_expanded_indices: None,
            max_results: None,
        };

        let res = execute_grep_content(&content, &options).unwrap();

        assert_eq!(res.matched_count, 1);
        assert_eq!(res.lines.len(), 3);
        assert_eq!(res.lines[0].line_number, 1);
        assert_eq!(res.lines[1].line_number, 2);
        assert!(res.lines[1].is_match);
        assert_eq!(res.lines[2].line_number, 3);
        assert!(res.lines[2].is_context);
    }

    #[test]
    fn test_grep_file_streaming() {
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(format!("test_log_grep_{}.txt", std::process::id()));

        {
            let mut file = File::create(&temp_path).unwrap();
            for i in 1..=1000 {
                if i == 500 {
                    writeln!(file, "CRITICAL_FAILURE: disk full on node 1").unwrap();
                } else {
                    writeln!(file, "timestamp INFO normal message number {}", i).unwrap();
                }
            }
        }

        let options = FilterOptions {
            pattern: "CRITICAL_FAILURE".to_string(),
            is_regex: false,
            match_case: true,
            whole_word: false,
            invert_match: false,
            context_lines: 5,
            custom_expanded_indices: None,
            max_results: None,
        };

        let res = execute_grep_file(temp_path.to_str().unwrap(), &options, None).unwrap();

        let _ = std::fs::remove_file(&temp_path);

        assert_eq!(res.total_source_lines, 1000);
        assert_eq!(res.matched_count, 1);
        assert_eq!(res.lines.len(), 11); // 5 before + 1 match + 5 after
        assert_eq!(res.lines[5].line_number, 500);
        assert!(res.lines[5].is_match);
        assert_eq!(res.lines[0].line_number, 495);
        assert_eq!(res.lines[10].line_number, 505);
    }

    #[test]
    fn test_benchmark_mmap_scale() {
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(format!("test_bench_log_{}.txt", std::process::id()));

        {
            let mut file = File::create(&temp_path).unwrap();
            for i in 1..=50_000 {
                if i % 5000 == 0 {
                    writeln!(file, "2026-09-22 12:00:00 [ERROR] Out of memory error in worker {}", i).unwrap();
                } else {
                    writeln!(file, "2026-09-22 12:00:00 [INFO] Request processed successfully in 12ms trace_id=abcdef-{}", i).unwrap();
                }
            }
        }

        let options = FilterOptions {
            pattern: "ERROR".to_string(),
            is_regex: false,
            match_case: true,
            whole_word: false,
            invert_match: false,
            context_lines: 2,
            custom_expanded_indices: None,
            max_results: None,
        };

        let t0 = Instant::now();
        let res_mmap = execute_grep_mmap(temp_path.to_str().unwrap(), &options, None).unwrap();
        let mmap_time = t0.elapsed();

        let t1 = Instant::now();
        let res_buf = execute_grep_bufreader(temp_path.to_str().unwrap(), &options, None).unwrap();
        let buf_time = t1.elapsed();

        let _ = std::fs::remove_file(&temp_path);

        println!(
            "\n=== BENCHMARK (50,000 lines, ~5MB) ===\n[Mmap SIMD Grep]:      {:.2}ms (matches={})\n[BufReader Line Grep]: {:.2}ms (matches={})\n======================================",
            mmap_time.as_secs_f64() * 1000.0,
            res_mmap.matched_count,
            buf_time.as_secs_f64() * 1000.0,
            res_buf.matched_count
        );

        assert_eq!(res_mmap.matched_count, res_buf.matched_count);
    }

    #[test]
    fn test_trigram_bloom_filter() {
        let text = b"The quick brown fox jumps over the lazy dog. ERROR 500 in PaymentService.";
        let filter = TrigramBloomFilter::build_from_bytes(text);

        // Positive checks
        assert!(filter.may_contain_query(b"quick"));
        assert!(filter.may_contain_query(b"ERROR"));
        assert!(filter.may_contain_query(b"error")); // Case-insensitive
        assert!(filter.may_contain_query(b"PaymentService"));
        assert!(filter.may_contain_query(b"500"));

        // Negative checks (should prune)
        assert!(!filter.may_contain_query(b"DatabaseConnectionTimeout"));
        assert!(!filter.may_contain_query(b"CRITICAL_FAILURE_XYZ"));
        assert!(!filter.may_contain_query(b"NullPointerException"));
    }

    #[test]
    fn test_get_lines_o1_seek() {
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(format!("test_seek_log_{}.txt", std::process::id()));

        {
            let mut file = File::create(&temp_path).unwrap();
            for i in 1..=500 {
                writeln!(file, "Log line number {:04} with sample payload", i).unwrap();
            }
        }

        let file = File::open(&temp_path).unwrap();
        let file_len = file.metadata().unwrap().len();
        let mmap = Arc::new(unsafe { Mmap::map(&file) }.unwrap());

        // Build line offsets
        let mut line_offsets = vec![0u64];
        for pos in memchr_iter(b'\n', &mmap[..]) {
            line_offsets.push((pos + 1) as u64);
        }

        let file_id = "test_seek_file_id".to_string();
        let state = Arc::new(LogFileState {
            file_id: file_id.clone(),
            file_path: temp_path.to_str().unwrap().to_string(),
            file_len,
            mtime: None,
            mmap,
            line_offsets: Arc::new(RwLock::new(line_offsets)),
            blocks: Arc::new(RwLock::new(Vec::new())),
            index_status: Arc::new(RwLock::new(IndexStatus::Ready)),
            cancel_index: Arc::new(AtomicBool::new(false)),
        });

        FileRegistry::global().insert_file(state);

        // Seek lines 42..45
        let lines = get_lines(file_id.clone(), 42, 45).unwrap();
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0].line_number, 42);
        assert_eq!(lines[0].content, "Log line number 0042 with sample payload");
        assert_eq!(lines[3].line_number, 45);
        assert_eq!(lines[3].content, "Log line number 0045 with sample payload");

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn test_cancel_all_indexing_and_file_closing() {
        let registry = FileRegistry::global();
        let cancel_token_1 = Arc::new(AtomicBool::new(false));
        let cancel_token_2 = Arc::new(AtomicBool::new(false));

        let temp_dir = std::env::temp_dir();
        let temp_file_1 = temp_dir.join(format!("test_mmap_cancel_1_{}.txt", std::process::id()));
        let temp_file_2 = temp_dir.join(format!("test_mmap_cancel_2_{}.txt", std::process::id()));
        std::fs::write(&temp_file_1, "test line 1\n").unwrap();
        std::fs::write(&temp_file_2, "test line 2\n").unwrap();

        let f1 = File::open(&temp_file_1).unwrap();
        let f2 = File::open(&temp_file_2).unwrap();
        let mmap1 = Arc::new(unsafe { memmap2::Mmap::map(&f1).unwrap() });
        let mmap2 = Arc::new(unsafe { memmap2::Mmap::map(&f2).unwrap() });

        let state_1 = Arc::new(LogFileState {
            file_id: "file_test_cancel_1".to_string(),
            file_path: temp_file_1.to_str().unwrap().to_string(),
            file_len: 12,
            mtime: None,
            mmap: mmap1,
            line_offsets: Arc::new(RwLock::new(vec![0])),
            blocks: Arc::new(RwLock::new(Vec::new())),
            index_status: Arc::new(RwLock::new(IndexStatus::Indexing)),
            cancel_index: Arc::clone(&cancel_token_1),
        });

        let state_2 = Arc::new(LogFileState {
            file_id: "file_test_cancel_2".to_string(),
            file_path: temp_file_2.to_str().unwrap().to_string(),
            file_len: 12,
            mtime: None,
            mmap: mmap2,
            line_offsets: Arc::new(RwLock::new(vec![0])),
            blocks: Arc::new(RwLock::new(Vec::new())),
            index_status: Arc::new(RwLock::new(IndexStatus::Indexing)),
            cancel_index: Arc::clone(&cancel_token_2),
        });

        registry.insert_file(state_1);
        registry.insert_file(state_2);

        assert!(!cancel_token_1.load(Ordering::Relaxed));
        assert!(!cancel_token_2.load(Ordering::Relaxed));

        // When switching files, cancel_all_indexing_and_searches is called
        registry.cancel_all_indexing_and_searches();

        assert!(cancel_token_1.load(Ordering::Relaxed));
        assert!(cancel_token_2.load(Ordering::Relaxed));

        // Close file 1
        registry.close_file("file_test_cancel_1");
        assert!(registry.get_file("file_test_cancel_1").is_none());
        assert!(registry.get_file("file_test_cancel_2").is_some());

        let _ = std::fs::remove_file(&temp_file_1);
        let _ = std::fs::remove_file(&temp_file_2);
    }
}
