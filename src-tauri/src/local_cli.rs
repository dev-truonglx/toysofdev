use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalCliStatus {
    pub available: bool,
    pub path: String,
    pub version: String,
    pub default_model: String,
    pub available_models: Vec<String>,
}

fn resolve_cli_path(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = custom_path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.exists() && path.is_file() {
                return Some(path);
            }
        }
    }

    // 1. Check ~/.local/bin/agy
    if let Ok(home) = std::env::var("HOME") {
        let agy_home = PathBuf::from(home).join(".local/bin/agy");
        if agy_home.exists() && agy_home.is_file() {
            return Some(agy_home);
        }
    }

    // 2. Check /usr/local/bin/agy
    let usr_local = PathBuf::from("/usr/local/bin/agy");
    if usr_local.exists() && usr_local.is_file() {
        return Some(usr_local);
    }

    // 3. Check /opt/homebrew/bin/agy
    let homebrew = PathBuf::from("/opt/homebrew/bin/agy");
    if homebrew.exists() && homebrew.is_file() {
        return Some(homebrew);
    }

    // 4. Try `which agy`
    if let Ok(output) = Command::new("which").arg("agy").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let pb = PathBuf::from(path_str);
                if pb.exists() {
                    return Some(pb);
                }
            }
        }
    }

    None
}

fn get_augmented_env_path() -> String {
    let current_path = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_default();
    let local_bin = format!("{}/.local/bin", home);
    format!("{}:/usr/local/bin:/opt/homebrew/bin:{}", local_bin, current_path)
}

#[tauri::command]
pub async fn check_local_cli(cli_path: Option<String>) -> Result<LocalCliStatus, String> {
    let path_opt = resolve_cli_path(cli_path.as_deref());
    let path = match path_opt {
        Some(p) => p,
        None => {
            return Ok(LocalCliStatus {
                available: false,
                path: String::new(),
                version: String::new(),
                default_model: "gemini-3.8-flash-high".to_string(),
                available_models: vec![
                    "gemini-3.8-flash-high".to_string(),
                    "gemini-3.8-flash-medium".to_string(),
                    "gemini-3.8-flash-low".to_string(),
                    "gemini-3.7-flash-high".to_string(),
                    "gemini-3.7-flash-medium".to_string(),
                    "claude-sonnet-4-6".to_string(),
                    "claude-opus-4-6-thinking".to_string(),
                ],
            });
        }
    };

    let path_str = path.to_string_lossy().to_string();

    let version_output = Command::new(&path)
        .arg("--version")
        .env("PATH", get_augmented_env_path())
        .output();

    let version = match version_output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "unknown".to_string(),
    };

    let models = vec![
        "gemini-3.8-flash-high".to_string(),
        "gemini-3.8-flash-medium".to_string(),
        "gemini-3.8-flash-low".to_string(),
        "gemini-3.7-flash-high".to_string(),
        "gemini-3.7-flash-medium".to_string(),
        "gemini-3.6-flash-high".to_string(),
        "gemini-3.1-pro-high".to_string(),
        "claude-sonnet-4-6".to_string(),
        "claude-opus-4-6-thinking".to_string(),
        "gpt-oss-120b-medium".to_string(),
    ];

    Ok(LocalCliStatus {
        available: true,
        path: path_str,
        version,
        default_model: "gemini-3.8-flash-high".to_string(),
        available_models: models,
    })
}

#[tauri::command]
pub async fn execute_local_cli(
    prompt: String,
    model: Option<String>,
    cli_path: Option<String>,
) -> Result<String, String> {
    let binary_path = resolve_cli_path(cli_path.as_deref())
        .ok_or_else(|| "Local CLI (agy) was not found. Please verify that agy is installed at ~/.local/bin/agy or specify its custom path in AI Settings.".to_string())?;

    let selected_model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "gemini-3.8-flash-high".to_string());

    let mut cmd = Command::new(&binary_path);
    cmd.arg("-p")
        .arg(&prompt)
        .arg("--model")
        .arg(&selected_model)
        .arg("--disable-slash-commands")
        .arg("--output-format")
        .arg("text")
        .env("PATH", get_augmented_env_path());

    let output = cmd.output().map_err(|e| format!("Failed to spawn local CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let combined = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("Local CLI execution failed (exit code {:?}): {}", output.status.code(), combined));
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.is_empty() {
        return Err("Local CLI returned empty response.".to_string());
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_cli_path() {
        let p = resolve_cli_path(None);
        println!("Resolved path: {:?}", p);
        assert!(p.is_some(), "Expected to find local agy CLI");
    }
}
