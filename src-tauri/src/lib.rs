// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, session_drag_pointer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


// Sample only the primary pointer and Escape during an explicit session drag.
// Screen coordinates stay physical, including on mixed-DPI displays.
#[derive(serde::Serialize)]
struct DragPointer { x: f64, y: f64, pressed: bool, cancelled: bool }

#[tauri::command]
fn session_drag_pointer(window: tauri::WebviewWindow) -> Result<DragPointer, String> {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" {
            fn GetAsyncKeyState(key: i32) -> i16;
            fn GetSystemMetrics(index: i32) -> i32;
        }
        let point = window.cursor_position().map_err(|e| e.to_string())?;
        // These Win32 functions take scalar values and do not dereference pointers.
        let (pressed, cancelled) = unsafe {
            let primary = if GetSystemMetrics(23) != 0 { 2 } else { 1 };
            (GetAsyncKeyState(primary) < 0, GetAsyncKeyState(27) < 0)
        };
        Ok(DragPointer { x: point.x, y: point.y, pressed, cancelled })
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = window; Err("Native session dragging currently requires Windows".into()) }
}
