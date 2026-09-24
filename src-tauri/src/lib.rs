mod diff;
mod log_grep;
mod color_picker;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(log_grep::LogGrepState::default())
        .invoke_handler(tauri::generate_handler![
            diff::compute_text_diff,
            diff::read_file_for_diff,
            log_grep::grep_log_file,
            log_grep::grep_log_content,
            log_grep::pick_log_file,
            log_grep::open_log_file,
            log_grep::close_log_file,
            log_grep::search_log,
            log_grep::cancel_search,
            log_grep::get_lines,
            log_grep::get_search_results,
            log_grep::export_search_results,
            color_picker::start_eyedropper,
            color_picker::cancel_eyedropper,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

