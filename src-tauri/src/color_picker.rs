use tauri::{AppHandle, Emitter};
use device_query::{DeviceQuery, DeviceState};
use xcap::Monitor;
use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};

static IS_PICKING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn start_eyedropper(app_handle: AppHandle) -> Result<(), String> {
    if IS_PICKING.swap(true, Ordering::SeqCst) {
        return Err("Already picking".to_string());
    }

    thread::spawn(move || {
        let device_state = DeviceState::new();
        loop {
            let mouse = device_state.get_mouse();
            let is_left_clicked = mouse.button_pressed.len() > 1 && mouse.button_pressed[1];
            
            if is_left_clicked {
                let x = mouse.coords.0;
                let y = mouse.coords.1;

                if let Ok(monitors) = Monitor::all() {
                    for monitor in monitors {
                        let mx = monitor.x().unwrap_or(0);
                        let my = monitor.y().unwrap_or(0);
                        let mw = monitor.width().unwrap_or(0) as i32;
                        let mh = monitor.height().unwrap_or(0) as i32;

                        if x >= mx && x < mx + mw && y >= my && y < my + mh {
                            if let Ok(image) = monitor.capture_image() {
                                let rel_x = (x - mx) as u32;
                                let rel_y = (y - my) as u32;
                                let pixel = image.get_pixel(rel_x, rel_y);
                                let hex = format!("#{:02x}{:02x}{:02x}", pixel.0[0], pixel.0[1], pixel.0[2]);
                                
                                let _ = app_handle.emit("color-picked", hex);
                            }
                            break;
                        }
                    }
                }
                
                break;
            }
            
            thread::sleep(Duration::from_millis(10));
            
            if !IS_PICKING.load(Ordering::SeqCst) {
                break;
            }
        }
        
        IS_PICKING.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_eyedropper() {
    IS_PICKING.store(false, Ordering::SeqCst);
}
