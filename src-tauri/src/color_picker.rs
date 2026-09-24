use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

static IS_PICKING: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
mod win32 {
    use std::ptr;

    type HDC = *mut std::ffi::c_void;
    type HWND = *mut std::ffi::c_void;
    type COLORREF = u32;
    type BOOL = i32;

    #[repr(C)]
    #[derive(Default, Debug, Clone, Copy)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hWnd: HWND) -> HDC;
        fn ReleaseDC(hWnd: HWND, hDC: HDC) -> i32;
        fn GetCursorPos(lpPoint: *mut POINT) -> BOOL;
        fn GetAsyncKeyState(vKey: i32) -> i16;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn GetPixel(hdc: HDC, x: i32, y: i32) -> COLORREF;
    }

    const VK_LBUTTON: i32 = 0x01;
    const VK_RBUTTON: i32 = 0x02;
    const VK_ESCAPE: i32 = 0x1B;

    pub fn is_left_button_down() -> bool {
        unsafe { (GetAsyncKeyState(VK_LBUTTON) as u16 & 0x8000) != 0 }
    }

    pub fn is_cancel_requested() -> bool {
        unsafe {
            ((GetAsyncKeyState(VK_ESCAPE) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(VK_RBUTTON) as u16 & 0x8000) != 0)
        }
    }

    pub fn pick_pixel_under_cursor() -> Option<String> {
        unsafe {
            let mut pt = POINT::default();
            if GetCursorPos(&mut pt) == 0 {
                return None;
            }

            // GetDC(NULL) retrieves the DC for the entire virtual desktop across all monitors
            let hdc = GetDC(ptr::null_mut());
            if hdc.is_null() {
                return None;
            }

            let color = GetPixel(hdc, pt.x, pt.y);
            ReleaseDC(ptr::null_mut(), hdc);

            // CLR_INVALID is 0xFFFFFFFF
            if color == 0xFFFFFFFF {
                return None;
            }

            let r = (color & 0xFF) as u8;
            let g = ((color >> 8) & 0xFF) as u8;
            let b = ((color >> 16) & 0xFF) as u8;

            Some(format!("#{:02x}{:02x}{:02x}", r, g, b))
        }
    }
}

#[cfg(not(windows))]
mod fallback {
    use device_query::{DeviceQuery, DeviceState};
    use xcap::Monitor;

    pub fn pick_pixel_under_cursor(x: i32, y: i32) -> Option<String> {
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
                        if rel_x < image.width() && rel_y < image.height() {
                            let pixel = image.get_pixel(rel_x, rel_y);
                            return Some(format!("#{:02x}{:02x}{:02x}", pixel.0[0], pixel.0[1], pixel.0[2]));
                        }
                    }
                    break;
                }
            }
        }
        None
    }

    pub fn get_mouse_state() -> (bool, i32, i32) {
        let device_state = DeviceState::new();
        let mouse = device_state.get_mouse();
        let is_clicked = mouse.button_pressed.len() > 1 && mouse.button_pressed[1];
        (is_clicked, mouse.coords.0, mouse.coords.1)
    }
}

#[tauri::command]
pub fn start_eyedropper(app_handle: AppHandle) -> Result<(), String> {
    if IS_PICKING.swap(true, Ordering::SeqCst) {
        return Err("Already picking".to_string());
    }

    thread::spawn(move || {
        #[cfg(windows)]
        {
            // 1. Wait for current click (on the picker button) to be released
            while win32::is_left_button_down() {
                thread::sleep(Duration::from_millis(10));
                if !IS_PICKING.load(Ordering::SeqCst) {
                    return;
                }
            }

            // 2. Poll for the next click anywhere across any monitor
            loop {
                if !IS_PICKING.load(Ordering::SeqCst) {
                    break;
                }

                if win32::is_cancel_requested() {
                    let _ = app_handle.emit("color-pick-cancelled", ());
                    break;
                }

                if win32::is_left_button_down() {
                    if let Some(hex) = win32::pick_pixel_under_cursor() {
                        let _ = app_handle.emit("color-picked", hex);
                    }
                    break;
                }

                thread::sleep(Duration::from_millis(5));
            }
        }

        #[cfg(not(windows))]
        {
            // Fallback for macOS / Linux
            loop {
                let (is_clicked, x, y) = fallback::get_mouse_state();
                if is_clicked {
                    if let Some(hex) = fallback::pick_pixel_under_cursor(x, y) {
                        let _ = app_handle.emit("color-picked", hex);
                    }
                    break;
                }

                thread::sleep(Duration::from_millis(10));

                if !IS_PICKING.load(Ordering::SeqCst) {
                    break;
                }
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
