//! Explicit GitHub / Enterprise requests. Secrets stay in the OS credential store.
use reqwest::{blocking::Client, redirect::Policy, Method, Url};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{io::Read, sync::Mutex, time::Duration};
static CREDENTIAL_LOCK: Mutex<()> = Mutex::new(());
#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum HostAction {
    Status,
    SaveToken,
    DeleteToken,
    Test,
    ListPulls,
    ReadPull,
    PullFiles,
    CreatePull,
    Comment,
    Review,
    MergePull,
    Fork,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRequest {
    pub action: HostAction,
    pub base_url: String,
    #[serde(default)]
    pub repository: String,
    #[serde(default)]
    pub number: u64,
    #[serde(default)]
    pub page: u32,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub head: String,
    #[serde(default)]
    pub base: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub confirmed: bool,
}
fn endpoint(base: &str) -> Result<Url, String> {
    let mut url = Url::parse(base).map_err(|_| "Enter a valid API URL")?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("API URL cannot include credentials, query or fragment".into());
    }
    let local = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err("HTTPS is required except for loopback servers".into());
    }
    if !url.path().ends_with('/') {
        url.set_path(&format!("{}/", url.path()));
    }
    Ok(url)
}
fn repo_segments(repository: &str) -> Result<Vec<&str>, String> {
    let parts: Vec<_> = repository.split('/').collect();
    if parts.len() != 2
        || parts.iter().any(|s| {
            s.is_empty()
                || *s == "."
                || *s == ".."
                || !s
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        })
    {
        return Err("Enter owner/repository".into());
    }
    Ok(parts)
}
pub fn request(c: HostRequest) -> Result<Value, String> {
    let url = endpoint(&c.base_url)?;
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    if matches!(c.action, HostAction::SaveToken | HostAction::DeleteToken) {
        return Err("Credential storage is currently supported on Windows and macOS".into());
    }
    let _guard = CREDENTIAL_LOCK
        .lock()
        .map_err(|_| "Credential store unavailable")?;
    let entry = keyring::Entry::new("dev.gitstudiopro.repository-host", url.as_str())
        .map_err(|_| "Cannot open OS credential entry")?;
    if c.action == HostAction::SaveToken {
        if c.token.trim().is_empty() {
            return Err("Enter an access token".into());
        }
        entry
            .set_password(&c.token)
            .map_err(|_| "Could not store the token in the OS credential manager")?;
        return Ok(json!({"configured":true}));
    }
    if c.action == HostAction::DeleteToken {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => return Err("Could not remove token".into()),
        };
        return Ok(json!({"configured":false}));
    }
    let token = match entry.get_password() {
        Ok(value) => Some(value),
        Err(keyring::Error::NoEntry) => None,
        Err(_) => {
            return Err("OS credential store is unavailable; no plaintext fallback is used".into())
        }
    };
    if c.action == HostAction::Status {
        return Ok(json!({"configured":token.is_some()}));
    }
    drop(_guard);
    send(c, url, token.as_deref())
}
fn send(c: HostRequest, mut url: Url, token: Option<&str>) -> Result<Value, String> {
    use HostAction::*;
    let mut method = Method::GET;
    let mut body = Value::Null;
    let number = c.number.to_string();
    let mut suffix: Vec<&str> = Vec::new();
    match c.action {
        Test => {
            suffix.push("user");
        }
        ListPulls | ReadPull | PullFiles | CreatePull | Comment | Review | MergePull | Fork => {
            suffix.push("repos");
            suffix.extend(repo_segments(&c.repository)?);
            match c.action {
                ListPulls => suffix.push("pulls"),
                ReadPull | PullFiles | Review | MergePull => {
                    if c.number == 0 {
                        return Err("Pull request number is required".into());
                    }
                    suffix.extend(["pulls", &number]);
                    if c.action == PullFiles {
                        suffix.push("files");
                    } else if c.action == Review {
                        suffix.push("reviews");
                        method = Method::POST;
                        let event = match c.mode.as_str() {
                            "APPROVE" | "REQUEST_CHANGES" | "COMMENT" => &c.mode,
                            _ => return Err("Choose a review event".into()),
                        };
                        body = json!({"event":event,"body":c.body});
                    } else if c.action == MergePull {
                        suffix.push("merge");
                        method = Method::PUT;
                        if !["merge", "squash", "rebase"].contains(&c.mode.as_str()) {
                            return Err("Choose a merge method".into());
                        }
                        if c.head.len() != 40 || !c.head.chars().all(|ch| ch.is_ascii_hexdigit()) {
                            return Err(
                                "Reload the pull request and provide its current head SHA".into()
                            );
                        }
                        body = json!({"merge_method":c.mode,"sha":c.head});
                    }
                }
                CreatePull => {
                    suffix.push("pulls");
                    method = Method::POST;
                    if c.title.trim().is_empty()
                        || c.head.trim().is_empty()
                        || c.base.trim().is_empty()
                    {
                        return Err("Title, head and base are required".into());
                    }
                    body = json!({"title":c.title,"body":c.body,"head":c.head,"base":c.base,"draft":true});
                }
                Comment => {
                    if c.number == 0 || c.body.trim().is_empty() {
                        return Err("Pull request number and comment required".into());
                    }
                    suffix.extend(["issues", &number, "comments"]);
                    method = Method::POST;
                    body = json!({"body":c.body});
                }
                Fork => {
                    suffix.push("forks");
                    method = Method::POST;
                    body = json!({});
                }
                _ => unreachable!(),
            }
        }
        _ => return Err("Unsupported host request".into()),
    }
    if method != Method::GET {
        if !c.confirmed {
            return Err("Review and confirm this remote write".into());
        }
        if token.is_none() {
            return Err("Save a token with the required repository permissions".into());
        }
    }
    url.path_segments_mut()
        .map_err(|_| "Invalid base URL")?
        .pop_if_empty()
        .extend(suffix);
    if matches!(c.action, ListPulls | PullFiles) {
        url.query_pairs_mut()
            .append_pair("per_page", "50")
            .append_pair("page", &c.page.max(1).to_string());
        if c.action == ListPulls {
            url.query_pairs_mut().append_pair("state", "open");
        }
    }
    let client = Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|_| "Could not create HTTP client")?;
    let mut request = client
        .request(method, url)
        .header("User-Agent", "GitStudioPro")
        .header("Accept", "application/vnd.github+json");
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    if !body.is_null() {
        request = request.json(&body);
    }
    let response = request.send().map_err(|_| {
        "Host request failed. Check the endpoint, network and certificate configuration."
    })?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Host returned HTTP {status}. Check permissions, endpoint and request state. Redirects are not followed."));
    }
    let mut data = Vec::new();
    response
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut data)
        .map_err(|_| "Could not read host response")?;
    if data.len() > 8 * 1024 * 1024 {
        return Err("Host response exceeds 8 MiB".into());
    }
    serde_json::from_slice(&data).map_err(|_| "Host response was not JSON".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn isolates_endpoint_identity_and_rejects_unsafe_urls() {
        assert!(endpoint("http://example.com").is_err());
        assert!(endpoint("https://user:token@example.com").is_err());
        assert_eq!(
            endpoint("https://api.github.com").unwrap().as_str(),
            "https://api.github.com/"
        );
        assert!(repo_segments("../private").is_err());
        assert!(repo_segments("owner/repo").is_ok());
    }
    #[test]
    fn rejects_unconfirmed_remote_writes_before_sending() {
        let c:HostRequest=serde_json::from_value(json!({"action":"createPull","baseUrl":"https://api.github.com","repository":"owner/repo","title":"Test","head":"feature","base":"main"})).unwrap();
        assert!(
            send(c, endpoint("https://api.github.com").unwrap(), Some("test"))
                .unwrap_err()
                .contains("confirm")
        );
    }
}
