use std::collections::HashMap;
use std::time::Duration;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .invoke_handler(tauri::generate_handler![
            looperman_text,
            looperman_post,
            looperman_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

const BROWSER_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Could not build HTTP client: {e}"))
}

#[derive(serde::Serialize)]
struct LoopermanTextResponse {
    status: u16,
    final_url: String,
    body: String,
    set_cookies: Vec<String>,
}

fn response_cookies(response: &reqwest::Response) -> Vec<String> {
    response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok().map(|s| s.to_string()))
        .collect()
}

// The frontend's plugin-http fetch builds a browser Request first, and the
// browser silently drops `Referer` and `Cookie` as forbidden headers. These
// commands send requests straight from Rust instead, where Looperman's
// hotlink protection (Referer) and login session (Cookie) work as expected.
#[tauri::command]
async fn looperman_text(
    url: String,
    referer: String,
    cookie: String,
) -> Result<LoopermanTextResponse, String> {
    let client = http_client()?;
    let mut request = client.get(&url);
    if !referer.is_empty() {
        request = request.header(reqwest::header::REFERER, referer);
    }
    if !cookie.is_empty() {
        request = request.header(reqwest::header::COOKIE, cookie);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    let status = response.status().as_u16();
    let final_url = response.url().to_string();
    let set_cookies = response_cookies(&response);
    let body = response
        .text()
        .await
        .map_err(|e| format!("Could not read response: {e}"))?;
    Ok(LoopermanTextResponse {
        status,
        final_url,
        body,
        set_cookies,
    })
}

#[tauri::command]
async fn looperman_post(
    url: String,
    referer: String,
    cookie: String,
    fields: HashMap<String, String>,
) -> Result<LoopermanTextResponse, String> {
    let client = http_client()?;
    let mut request = client.post(&url);
    if !referer.is_empty() {
        request = request.header(reqwest::header::REFERER, referer);
    }
    if !cookie.is_empty() {
        request = request.header(reqwest::header::COOKIE, cookie);
    }
    let response = request
        .header(reqwest::header::ORIGIN, "https://www.looperman.com")
        .form(&fields)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    let status = response.status().as_u16();
    let final_url = response.url().to_string();
    let set_cookies = response_cookies(&response);
    let body = response
        .text()
        .await
        .map_err(|e| format!("Could not read response: {e}"))?;
    Ok(LoopermanTextResponse {
        status,
        final_url,
        body,
        set_cookies,
    })
}

#[tauri::command]
async fn looperman_bytes(
    url: String,
    referer: String,
    cookie: String,
    accept: String,
) -> Result<Vec<u8>, String> {
    let client = http_client()?;
    let mut request = client.get(&url);
    if !referer.is_empty() {
        request = request.header(reqwest::header::REFERER, referer);
    }
    if !cookie.is_empty() {
        request = request.header(reqwest::header::COOKIE, cookie);
    }
    if !accept.is_empty() {
        request = request.header(reqwest::header::ACCEPT, accept);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        return Err(format!("Download failed (HTTP {status})"));
    }
    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Could not read audio: {e}"))
}
