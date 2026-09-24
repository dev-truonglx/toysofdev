use serde::{Deserialize, Serialize};
use similar::{ChangeTag, DiffOp, TextDiff};

pub const MAX_WORD_DIFF_LINE_LEN: usize = 1000;
pub const MAX_FULL_DIFF_LINES: usize = 10_000;
pub const HARD_CAP_LINES: usize = 100_000;
pub const TRUNCATED_SAFE_LINES: usize = 50_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffSegment {
    pub text: String,
    pub is_diff: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffRowSide {
    pub line_num: Option<usize>,
    pub text: String,
    pub segments: Vec<DiffSegment>,
    pub is_spacer: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AlignedRow {
    pub is_changed: bool,
    pub left: DiffRowSide,
    pub right: DiffRowSide,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub rows: Vec<AlignedRow>,
    pub differences_count: usize,
    pub is_truncated: bool,
    pub word_diff_disabled: bool,
    pub total_lines_left: usize,
    pub total_lines_right: usize,
}

fn push_segment(segments: &mut Vec<DiffSegment>, text: &str, is_diff: bool) {
    if text.is_empty() {
        return;
    }
    if let Some(last) = segments.last_mut() {
        if last.is_diff == is_diff {
            last.text.push_str(text);
            return;
        }
    }
    segments.push(DiffSegment {
        text: text.to_string(),
        is_diff,
    });
}

fn normalize_line_str(line: &str, ignore_ws: bool, ignore_case: bool) -> String {
    let mut res = line.to_string();
    if ignore_case {
        res = res.to_lowercase();
    }
    if ignore_ws {
        res = res.split_whitespace().collect::<Vec<&str>>().join(" ");
    }
    res
}

fn compute_word_diff(
    s1: &str,
    s2: &str,
    ignore_ws: bool,
    ignore_case: bool,
) -> (Vec<DiffSegment>, Vec<DiffSegment>) {
    if s1 == s2 {
        let seg = DiffSegment {
            text: s1.to_string(),
            is_diff: false,
        };
        return (vec![seg.clone()], vec![seg]);
    }

    if (ignore_ws || ignore_case)
        && normalize_line_str(s1, ignore_ws, ignore_case)
            == normalize_line_str(s2, ignore_ws, ignore_case)
    {
        return (
            vec![DiffSegment {
                text: s1.to_string(),
                is_diff: false,
            }],
            vec![DiffSegment {
                text: s2.to_string(),
                is_diff: false,
            }],
        );
    }

    if s1.len() > MAX_WORD_DIFF_LINE_LEN || s2.len() > MAX_WORD_DIFF_LINE_LEN {
        return (
            vec![DiffSegment {
                text: s1.to_string(),
                is_diff: true,
            }],
            vec![DiffSegment {
                text: s2.to_string(),
                is_diff: true,
            }],
        );
    }

    let word_diff = TextDiff::configure().diff_chars(s1, s2);
    let mut left_segs = Vec::new();
    let mut right_segs = Vec::new();

    for change in word_diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Equal => {
                push_segment(&mut left_segs, change.value(), false);
                push_segment(&mut right_segs, change.value(), false);
            }
            ChangeTag::Delete => {
                push_segment(&mut left_segs, change.value(), true);
            }
            ChangeTag::Insert => {
                push_segment(&mut right_segs, change.value(), true);
            }
        }
    }

    (left_segs, right_segs)
}

#[tauri::command]
pub async fn compute_text_diff(
    old_text: String,
    new_text: String,
    ignore_whitespace: Option<bool>,
    ignore_case: Option<bool>,
    force_all: Option<bool>,
) -> Result<DiffResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw_lines1: Vec<&str> = if old_text.is_empty() {
            Vec::new()
        } else {
            old_text.split('\n').map(|s| s.strip_suffix('\r').unwrap_or(s)).collect()
        };

        let raw_lines2: Vec<&str> = if new_text.is_empty() {
            Vec::new()
        } else {
            new_text.split('\n').map(|s| s.strip_suffix('\r').unwrap_or(s)).collect()
        };

        let total_lines_left = raw_lines1.len();
        let total_lines_right = raw_lines2.len();

        if total_lines_left == 0 && total_lines_right == 0 {
            return Ok(DiffResult {
                rows: Vec::new(),
                differences_count: 0,
                is_truncated: false,
                word_diff_disabled: false,
                total_lines_left: 0,
                total_lines_right: 0,
            });
        }

        let allow_force = force_all.unwrap_or(false);
        let is_truncated = !allow_force && (total_lines_left > HARD_CAP_LINES || total_lines_right > HARD_CAP_LINES);

        let lines1: Vec<&str> = if is_truncated {
            raw_lines1.into_iter().take(TRUNCATED_SAFE_LINES).collect()
        } else {
            raw_lines1
        };

        let lines2: Vec<&str> = if is_truncated {
            raw_lines2.into_iter().take(TRUNCATED_SAFE_LINES).collect()
        } else {
            raw_lines2
        };

        let word_diff_disabled = lines1.len() > MAX_FULL_DIFF_LINES || lines2.len() > MAX_FULL_DIFF_LINES;

        let ignore_ws = ignore_whitespace.unwrap_or(false);
        let ignore_c = ignore_case.unwrap_or(false);

        let norm1: Vec<String>;
        let norm2: Vec<String>;
        let norm1_refs: Vec<&str>;
        let norm2_refs: Vec<&str>;

        let diff = if ignore_ws || ignore_c {
            norm1 = lines1.iter().map(|s| normalize_line_str(s, ignore_ws, ignore_c)).collect();
            norm2 = lines2.iter().map(|s| normalize_line_str(s, ignore_ws, ignore_c)).collect();
            norm1_refs = norm1.iter().map(|s| s.as_str()).collect();
            norm2_refs = norm2.iter().map(|s| s.as_str()).collect();
            TextDiff::configure()
                .algorithm(similar::Algorithm::Myers)
                .diff_slices(&norm1_refs, &norm2_refs)
        } else {
            TextDiff::configure()
                .algorithm(similar::Algorithm::Myers)
                .diff_slices(&lines1, &lines2)
        };

        let mut rows = Vec::with_capacity(lines1.len().max(lines2.len()));
        let mut differences_count = 0;

        for op in diff.ops() {
            match *op {
                DiffOp::Equal { old_index, new_index, len } => {
                    for k in 0..len {
                        let oi = old_index + k;
                        let ni = new_index + k;
                        let s1 = lines1[oi].to_string();
                        let s2 = lines2[ni].to_string();
                        rows.push(AlignedRow {
                            is_changed: false,
                            left: DiffRowSide {
                                line_num: Some(oi + 1),
                                text: s1.clone(),
                                segments: vec![DiffSegment {
                                    text: s1,
                                    is_diff: false,
                                }],
                                is_spacer: false,
                            },
                            right: DiffRowSide {
                                line_num: Some(ni + 1),
                                text: s2.clone(),
                                segments: vec![DiffSegment {
                                    text: s2,
                                    is_diff: false,
                                }],
                                is_spacer: false,
                            },
                        });
                    }
                }
                DiffOp::Delete { old_index, old_len, .. } => {
                    for k in 0..old_len {
                        let oi = old_index + k;
                        let line_text = lines1[oi].to_string();
                        differences_count += 1;
                        rows.push(AlignedRow {
                            is_changed: true,
                            left: DiffRowSide {
                                line_num: Some(oi + 1),
                                text: line_text.clone(),
                                segments: vec![DiffSegment {
                                    text: line_text,
                                    is_diff: true,
                                }],
                                is_spacer: false,
                            },
                            right: DiffRowSide {
                                line_num: None,
                                text: String::new(),
                                segments: Vec::new(),
                                is_spacer: true,
                            },
                        });
                    }
                }
                DiffOp::Insert { new_index, new_len, .. } => {
                    for k in 0..new_len {
                        let ni = new_index + k;
                        let line_text = lines2[ni].to_string();
                        differences_count += 1;
                        rows.push(AlignedRow {
                            is_changed: true,
                            left: DiffRowSide {
                                line_num: None,
                                text: String::new(),
                                segments: Vec::new(),
                                is_spacer: true,
                            },
                            right: DiffRowSide {
                                line_num: Some(ni + 1),
                                text: line_text.clone(),
                                segments: vec![DiffSegment {
                                    text: line_text,
                                    is_diff: true,
                                }],
                                is_spacer: false,
                            },
                        });
                    }
                }
                DiffOp::Replace {
                    old_index,
                    old_len,
                    new_index,
                    new_len,
                } => {
                    let max_len = old_len.max(new_len);
                    for k in 0..max_len {
                        let has_old = k < old_len;
                        let has_new = k < new_len;

                        if has_old && has_new {
                            let oi = old_index + k;
                            let ni = new_index + k;
                            let s1 = lines1[oi];
                            let s2 = lines2[ni];
                            let (left_segs, right_segs) = if word_diff_disabled {
                                (
                                    vec![DiffSegment {
                                        text: s1.to_string(),
                                        is_diff: true,
                                    }],
                                    vec![DiffSegment {
                                        text: s2.to_string(),
                                        is_diff: true,
                                    }],
                                )
                            } else {
                                compute_word_diff(s1, s2, ignore_ws, ignore_c)
                            };

                            let is_really_equal = left_segs.iter().all(|s| !s.is_diff) && right_segs.iter().all(|s| !s.is_diff);
                            if !is_really_equal {
                                differences_count += 1;
                            }
                            rows.push(AlignedRow {
                                is_changed: !is_really_equal,
                                left: DiffRowSide {
                                    line_num: Some(oi + 1),
                                    text: s1.to_string(),
                                    segments: left_segs,
                                    is_spacer: false,
                                },
                                right: DiffRowSide {
                                    line_num: Some(ni + 1),
                                    text: s2.to_string(),
                                    segments: right_segs,
                                    is_spacer: false,
                                },
                            });
                        } else if has_old && !has_new {
                            let oi = old_index + k;
                            let line_text = lines1[oi].to_string();
                            differences_count += 1;
                            rows.push(AlignedRow {
                                is_changed: true,
                                left: DiffRowSide {
                                    line_num: Some(oi + 1),
                                    text: line_text.clone(),
                                    segments: vec![DiffSegment {
                                        text: line_text,
                                        is_diff: true,
                                    }],
                                    is_spacer: false,
                                },
                                right: DiffRowSide {
                                    line_num: None,
                                    text: String::new(),
                                    segments: Vec::new(),
                                    is_spacer: true,
                                },
                            });
                        } else if !has_old && has_new {
                            let ni = new_index + k;
                            let line_text = lines2[ni].to_string();
                            differences_count += 1;
                            rows.push(AlignedRow {
                                is_changed: true,
                                left: DiffRowSide {
                                    line_num: None,
                                    text: String::new(),
                                    segments: Vec::new(),
                                    is_spacer: true,
                                },
                                right: DiffRowSide {
                                    line_num: Some(ni + 1),
                                    text: line_text.clone(),
                                    segments: vec![DiffSegment {
                                        text: line_text,
                                        is_diff: true,
                                    }],
                                    is_spacer: false,
                                },
                            });
                        }
                    }
                }
            }
        }

        Ok(DiffResult {
            rows,
            differences_count,
            is_truncated,
            word_diff_disabled,
            total_lines_left,
            total_lines_right,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfoResult {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub content: Option<String>,
    pub is_binary: bool,
    pub line_count: Option<usize>,
}

#[tauri::command]
pub async fn read_file_for_diff(path: String) -> Result<FileInfoResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err("File does not exist".to_string());
        }
        if p.is_dir() {
            return Err("Path is a directory".to_string());
        }

        let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
        let size = metadata.len();
        let name = p
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());

        // Check if binary by reading up to 512 bytes
        let mut file = std::fs::File::open(p).map_err(|e| e.to_string())?;
        use std::io::Read;
        let mut buffer = [0u8; 512];
        let bytes_read = file.read(&mut buffer).unwrap_or(0);
        let is_binary = buffer[..bytes_read].contains(&0);

        if is_binary {
            return Ok(FileInfoResult {
                name,
                path,
                size,
                content: None,
                is_binary: true,
                line_count: None,
            });
        }

        // Read text
        let content = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
        let line_count = content.lines().count();

        Ok(FileInfoResult {
            name,
            path,
            size,
            content: Some(content),
            is_binary: false,
            line_count: Some(line_count),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_diff() {
        tauri::async_runtime::block_on(async {
            let res = compute_text_diff("".into(), "".into(), None, None, None).await.unwrap();
            assert_eq!(res.rows.len(), 0);
            assert_eq!(res.differences_count, 0);
            assert!(!res.is_truncated);
            assert!(!res.word_diff_disabled);
        });
    }

    #[test]
    fn test_identical_diff() {
        tauri::async_runtime::block_on(async {
            let res = compute_text_diff("hello\nworld".into(), "hello\nworld".into(), None, None, None)
                .await
                .unwrap();
            assert_eq!(res.rows.len(), 2);
            assert_eq!(res.differences_count, 0);
            assert!(!res.rows[0].is_changed);
            assert!(!res.rows[1].is_changed);
        });
    }

    #[test]
    fn test_ignore_whitespace_and_case() {
        tauri::async_runtime::block_on(async {
            let res = compute_text_diff(
                "HELLO   WORLD".into(),
                "hello world".into(),
                Some(true),
                Some(true),
                None,
            )
            .await
            .unwrap();
            assert_eq!(res.rows.len(), 1);
            assert_eq!(res.differences_count, 0);
            assert!(!res.rows[0].is_changed);
            assert_eq!(res.rows[0].left.text, "HELLO   WORLD");
            assert_eq!(res.rows[0].right.text, "hello world");
        });
    }

    #[test]
    fn test_word_diff_replacement() {
        tauri::async_runtime::block_on(async {
            let res = compute_text_diff("hello world".into(), "hello rust world".into(), None, None, None)
                .await
                .unwrap();
            assert_eq!(res.rows.len(), 1);
            assert_eq!(res.differences_count, 1);
            assert!(res.rows[0].is_changed);
            assert_eq!(res.rows[0].left.text, "hello world");
            assert_eq!(res.rows[0].right.text, "hello rust world");
            assert!(!res.word_diff_disabled);
        });
    }

    #[test]
    fn test_char_diff_ds_vs_dsf() {
        tauri::async_runtime::block_on(async {
            let res = compute_text_diff("ds".into(), "dsf".into(), None, None, None)
                .await
                .unwrap();
            assert_eq!(res.rows.len(), 1);
            assert!(res.rows[0].is_changed);
            assert_eq!(res.rows[0].left.segments.len(), 1);
            assert_eq!(res.rows[0].left.segments[0].text, "ds");
            assert!(!res.rows[0].left.segments[0].is_diff);

            assert_eq!(res.rows[0].right.segments.len(), 2);
            assert_eq!(res.rows[0].right.segments[0].text, "ds");
            assert!(!res.rows[0].right.segments[0].is_diff);
            assert_eq!(res.rows[0].right.segments[1].text, "f");
            assert!(res.rows[0].right.segments[1].is_diff);
        });
    }

    #[test]
    fn test_guardrail_long_line() {
        tauri::async_runtime::block_on(async {
            let long1 = "a".repeat(1500);
            let long2 = "b".repeat(1500);
            let res = compute_text_diff(long1, long2, None, None, None).await.unwrap();
            assert_eq!(res.rows.len(), 1);
            assert_eq!(res.differences_count, 1);
            assert!(res.rows[0].is_changed);
        });
    }

    #[test]
    fn test_word_diff_disabled_on_large_text() {
        tauri::async_runtime::block_on(async {
            // Text > 10,000 lines
            let n = 10_005;
            let old_lines: Vec<String> = (0..n).map(|i| format!("line {}", i)).collect();
            let mut new_lines = old_lines.clone();
            new_lines[0] = "line 0 modified".to_string();

            let res = compute_text_diff(old_lines.join("\n"), new_lines.join("\n"), None, None, None)
                .await
                .unwrap();
            assert!(res.word_diff_disabled);
            assert_eq!(res.differences_count, 1);
            assert_eq!(res.total_lines_left, 10_005);
            // Word diff is disabled so the segment is the entire line marked is_diff
            assert_eq!(res.rows[0].left.segments.len(), 1);
            assert!(res.rows[0].left.segments[0].is_diff);
        });
    }

    #[test]
    #[ignore]
    fn test_benchmark_scales() {
        use std::time::Instant;

        let counts = [1_000, 5_000, 20_000, 50_000];

        for &n in &counts {
            // Realistic case: 95% identical, 5% modified
            let old_lines: Vec<String> = (0..n).map(|i| format!("fn function_{}() {{ let x = {}; println!(\"value: {{}}\", x); }}", i, i)).collect();
            let mut new_lines = old_lines.clone();
            for i in (0..n).step_by(20) {
                new_lines[i] = format!("fn function_{}() {{ let x = {}; println!(\"MODIFIED: {{}}\", x * 2); }}", i, i);
            }
            let old_text = old_lines.join("\n");
            let new_text = new_lines.join("\n");

            let t0 = Instant::now();
            let _ = tauri::async_runtime::block_on(async {
                compute_text_diff(old_text, new_text, None, None, None).await.unwrap()
            });
            let elapsed = t0.elapsed();
            println!("\n>>> BENCHMARK [n = {} lines, 5% diff]: {:?}", n, elapsed);
        }

        // Worst case scenario: 50% lines different
        for &n in &[1_000, 5_000, 20_000] {
            let old_lines: Vec<String> = (0..n).map(|i| format!("old line content {}", i)).collect();
            let new_lines: Vec<String> = (0..n).map(|i| format!("new changed content {}", i)).collect();
            let old_text = old_lines.join("\n");
            let new_text = new_lines.join("\n");

            let t0 = Instant::now();
            let _ = tauri::async_runtime::block_on(async {
                compute_text_diff(old_text, new_text, None, None, None).await.unwrap()
            });
            let elapsed = t0.elapsed();
            println!(">>> BENCHMARK [n = {} lines, 100% diff]: {:?}", n, elapsed);
        }
    }
}
