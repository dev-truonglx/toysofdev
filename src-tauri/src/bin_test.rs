use device_query::{DeviceQuery, DeviceState};

fn main() {
    let device_state = DeviceState::new();
    let mouse = device_state.get_mouse();
    let pressed = mouse.button_pressed;
    println!("{:?}", pressed);
}
