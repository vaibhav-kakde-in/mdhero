//! Keep a restored window the size the window-state plugin saved.
//!
//! On Windows 11, `AdjustWindowRectEx` under-reports the caption of a decorated
//! window. tao's `set_inner_size` uses that call, and `tauri-plugin-window-state`
//! restores through it, so the client area comes back short (20px at 96 DPI on
//! the machine this was measured on). The plugin then stores that shorter size.
//! A window snapped to the side of the screen keeps its top-left corner and
//! loses the gap off the bottom on every launch. After a few open/close cycles
//! the gap above the taskbar is obvious.
//!
//! The saved client size is still the size from the previous session. Once the
//! restored window is only a caption-sized amount short of it, grow the window
//! back using its real frame insets instead of `AdjustWindowRectEx`.

use tauri::{Runtime, WebviewWindow};

#[cfg(windows)]
use tauri::{Manager, WindowEvent};

/// Largest caption/frame error, in physical pixels, that this will repair.
/// The measured error is 20px at 96 DPI and scales with DPI; 96 covers a 4x
/// display without treating a real resize (the default 900x700 versus a
/// snapped window, for example) as a frame error.
const FRAME_ERROR_MAX: i32 = 96;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ClientSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum StartupSize {
    /// This resize is not the restored window. Keep listening.
    Ignore,
    /// The window already has the saved client size. Stop.
    Settled,
    /// The window is only a frame-error short of `saved`. Grow it back.
    Short { saved: ClientSize },
}

/// Decide what a resize during startup means.
///
/// Both axes have to be exact or a little short. A window that is hundreds of
/// pixels away is the creation size, a maximized window, or a real drag, and
/// must be left alone. A window that is larger than the saved size is not this
/// bug either.
pub(crate) fn classify_startup_size(saved: ClientSize, actual: ClientSize) -> StartupSize {
    if saved.width == 0 || saved.height == 0 {
        return StartupSize::Settled;
    }
    let dw = saved.width as i32 - actual.width as i32;
    let dh = saved.height as i32 - actual.height as i32;
    if dw == 0 && dh == 0 {
        return StartupSize::Settled;
    }
    let frame_error = |delta: i32| (0..=FRAME_ERROR_MAX).contains(&delta);
    if frame_error(dw) && frame_error(dh) {
        StartupSize::Short { saved }
    } else {
        StartupSize::Ignore
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct FrameInsets {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

/// Outer size whose client area is `client`, given the live frame insets.
fn outer_size_for_client(client: ClientSize, insets: FrameInsets) -> Option<(i32, i32)> {
    if insets.left < 0 || insets.top < 0 || insets.right < 0 || insets.bottom < 0 {
        return None;
    }
    let width = i32::try_from(client.width).ok()? + insets.left + insets.right;
    let height = i32::try_from(client.height).ok()? + insets.top + insets.bottom;
    if width <= 0 || height <= 0 {
        return None;
    }
    Some((width, height))
}

#[cfg(windows)]
#[derive(Debug, serde::Deserialize)]
struct SavedWindow {
    width: u32,
    height: u32,
}

#[cfg(windows)]
fn saved_client_size<R: Runtime>(window: &WebviewWindow<R>) -> Option<ClientSize> {
    use std::collections::HashMap;

    let path = window
        .app_handle()
        .path()
        .app_config_dir()
        .ok()?
        .join(tauri_plugin_window_state::DEFAULT_FILENAME);
    let text = std::fs::read_to_string(path).ok()?;
    let states: HashMap<String, SavedWindow> = serde_json::from_str(&text).ok()?;
    let saved = states.get(window.label())?;
    Some(ClientSize {
        width: saved.width,
        height: saved.height,
    })
}

/// Watch the main window and undo the one-time shrink from restoring its size.
pub fn keep_restored_client_size<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(windows)]
    if let Some(saved) = saved_client_size(window) {
        install(window, saved);
    }
    #[cfg(not(windows))]
    {
        let _ = window;
    }
}

#[cfg(windows)]
fn install<R: Runtime>(window: &WebviewWindow<R>, saved: ClientSize) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    let done = Arc::new(AtomicBool::new(false));
    if let Ok(size) = window.inner_size() {
        let actual = ClientSize {
            width: size.width,
            height: size.height,
        };
        match classify_startup_size(saved, actual) {
            // The plugin restores during window creation, on this thread, so
            // the short size is already applied by the time setup runs.
            StartupSize::Short { saved } => {
                done.store(true, Ordering::SeqCst);
                let _ = resize_client_to(window, saved);
            }
            StartupSize::Settled => {
                done.store(true, Ordering::SeqCst);
            }
            StartupSize::Ignore => {}
        }
    }
    let window_for_fix = window.clone();
    window.on_window_event(move |event| {
        let WindowEvent::Resized(size) = event else {
            return;
        };
        if done.load(Ordering::SeqCst) {
            return;
        }
        let actual = ClientSize {
            width: size.width,
            height: size.height,
        };
        match classify_startup_size(saved, actual) {
            StartupSize::Ignore => {}
            StartupSize::Settled => {
                done.store(true, Ordering::SeqCst);
            }
            StartupSize::Short { saved } => {
                // Queue past this event so SetWindowPos does not re-enter it.
                // The plugin records the shrunk size first; the resize below is
                // what it writes on the way out.
                done.store(true, Ordering::SeqCst);
                let window = window_for_fix.clone();
                let app = window.app_handle().clone();
                let _ = app.run_on_main_thread(move || {
                    let _ = resize_client_to(&window, saved);
                });
            }
        }
    });
}

#[cfg(windows)]
fn resize_client_to<R: Runtime>(
    window: &WebviewWindow<R>,
    client: ClientSize,
) -> tauri::Result<()> {
    if window.is_minimized().unwrap_or(false)
        || window.is_maximized().unwrap_or(false)
        || window.is_fullscreen().unwrap_or(false)
    {
        return Ok(());
    }
    let hwnd = window.hwnd()?;
    let Some(insets) = frame_insets(hwnd) else {
        return Ok(());
    };
    let Some((width, height)) = outer_size_for_client(client, insets) else {
        return Ok(());
    };
    unsafe {
        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
            hwnd,
            None,
            0,
            0,
            width,
            height,
            windows::Win32::UI::WindowsAndMessaging::SWP_NOMOVE
                | windows::Win32::UI::WindowsAndMessaging::SWP_NOZORDER
                | windows::Win32::UI::WindowsAndMessaging::SWP_NOACTIVATE,
        );
    }
    Ok(())
}

#[cfg(windows)]
fn frame_insets(hwnd: windows::Win32::Foundation::HWND) -> Option<FrameInsets> {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::ClientToScreen;
    use windows::Win32::UI::WindowsAndMessaging::{GetClientRect, GetWindowRect};

    let mut window_rect = RECT::default();
    let mut client_rect = RECT::default();
    unsafe {
        GetWindowRect(hwnd, &mut window_rect).ok()?;
        GetClientRect(hwnd, &mut client_rect).ok()?;
    }
    let mut origin = POINT::default();
    // `ClientToScreen` returns `BOOL`. `BOOL::ok()` is a `Result`, unlike
    // `GetWindowRect`, which already returns `Result`.
    unsafe { ClientToScreen(hwnd, &mut origin).ok().ok()? };

    Some(FrameInsets {
        left: origin.x - window_rect.left,
        top: origin.y - window_rect.top,
        right: window_rect.right - (origin.x + client_rect.right),
        bottom: window_rect.bottom - (origin.y + client_rect.bottom),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn size(width: u32, height: u32) -> ClientSize {
        ClientSize { width, height }
    }

    #[test]
    fn exact_restore_settles() {
        assert_eq!(
            classify_startup_size(size(1278, 1340), size(1278, 1340)),
            StartupSize::Settled
        );
    }

    #[test]
    fn caption_shortfall_is_repaired() {
        // 20px is the shortfall measured on Windows 11 at 96 DPI.
        assert_eq!(
            classify_startup_size(size(1278, 1340), size(1278, 1320)),
            StartupSize::Short {
                saved: size(1278, 1340)
            }
        );
    }

    #[test]
    fn both_axes_can_be_short() {
        assert_eq!(
            classify_startup_size(size(800, 600), size(792, 580)),
            StartupSize::Short {
                saved: size(800, 600)
            }
        );
    }

    #[test]
    fn creation_size_is_not_a_frame_error() {
        assert_eq!(
            classify_startup_size(size(1278, 1340), size(900, 700)),
            StartupSize::Ignore
        );
    }

    #[test]
    fn a_larger_window_is_left_alone() {
        assert_eq!(
            classify_startup_size(size(800, 600), size(800, 640)),
            StartupSize::Ignore
        );
    }

    #[test]
    fn shortfall_past_the_caption_is_left_alone() {
        assert_eq!(
            classify_startup_size(size(1278, 1340), size(1278, 1200)),
            StartupSize::Ignore
        );
    }

    #[test]
    fn empty_saved_size_settles() {
        assert_eq!(
            classify_startup_size(size(0, 0), size(900, 700)),
            StartupSize::Settled
        );
    }

    #[test]
    fn outer_size_uses_live_frame_insets() {
        // Insets measured on a snapped decorated window at 96 DPI:
        // 8px left/right/bottom and a 51px caption. Client 1278x1340 must
        // come back as the outer 1294x1399 Windows itself used when snapping.
        let outer = outer_size_for_client(
            size(1278, 1340),
            FrameInsets {
                left: 8,
                top: 51,
                right: 8,
                bottom: 8,
            },
        );
        assert_eq!(outer, Some((1294, 1399)));
    }

    #[test]
    fn negative_insets_are_rejected() {
        assert_eq!(
            outer_size_for_client(
                size(100, 100),
                FrameInsets {
                    left: -1,
                    top: 0,
                    right: 0,
                    bottom: 0,
                },
            ),
            None
        );
    }
}
