mod bootstrap;
mod git;
mod hosts;
#[cfg(test)]
mod integration_tests;
mod models;
mod process;
mod tools;
#[cfg(test)]
mod tools_tests;
mod workflow;

use git::GitService;
use models::{Repository, Request};
use std::sync::Arc;
type Service = Arc<GitService>;
#[tauri::command]
async fn host_request(request: hosts::HostRequest) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || hosts::request(request))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn create_repository(
    options: bootstrap::CreateRepository,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || bootstrap::create(options))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn open_repository(
    state: tauri::State<'_, Service>,
    path: String,
) -> Result<Repository, String> {
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.open(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn repository_request(
    state: tauri::State<'_, Service>,
    path: String,
    request: Request,
) -> Result<serde_json::Value, String> {
    let service = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.execute(&path, request))
        .await
        .map_err(|e| e.to_string())?
}

pub fn run() {
    if tools::sequence_editor() {
        return;
    }
    tauri::Builder::default()
        .manage(Service::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_repository,
            create_repository,
            host_request,
            repository_request
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start GitStudio Pro");
}
