fn main() {
    tauri_plugin::Builder::new(&["init", "start", "stop", "set_rate", "set_voice", "get_voices"])
        .build();
}
