use super::*;
use base64::Engine;

pub(crate) fn ollama_runtime_env() -> HashMap<String, String> {
    let mut values = HashMap::new();
    let authorization = env::var("OLLAMA_AUTHORIZATION")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(
            || match (env::var("OLLAMA_AUTH_USER"), env::var("OLLAMA_AUTH_PASS")) {
                (Ok(user), Ok(pass)) if !user.is_empty() && !pass.is_empty() => Some(format!(
                    "Basic {}",
                    base64::engine::general_purpose::STANDARD.encode(format!("{user}:{pass}"))
                )),
                _ => env::var("OLLAMA_API_KEY")
                    .ok()
                    .filter(|s| !s.is_empty())
                    .map(|key| format!("Bearer {key}")),
            },
        );
    if let Some(value) = authorization {
        values.insert("OLLAMA_AUTHORIZATION".to_string(), value);
    }
    values
}

pub(crate) fn with_ollama_profile(
    mut snapshot: (String, HashMap<String, RuntimeProfile>),
    data_dir: &Path,
) -> (String, HashMap<String, RuntimeProfile>) {
    if env::var("OLLAMA_BASE_URL")
        .ok()
        .is_some_and(|s| !s.trim().is_empty())
    {
        let home = env::var("OLLAMA_CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                home_dir_path()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(".codex-ollama")
            });
        if home.is_absolute() && !snapshot.1.values().any(|p| p.codex_home == home) {
            snapshot
                .1
                .entry("ollama".to_string())
                .or_insert(RuntimeProfile {
                    label: "Ollama".to_string(),
                    codex_home: home,
                    data_dir: data_dir.join("profiles/ollama"),
                });
        }
    }
    snapshot
}

pub(crate) async fn handle_ollama_http(
    state: AppState,
    request: Request,
    auth: AuthContext,
) -> Response {
    if !role_has_admin_access(auth.role) {
        return json_error(StatusCode::FORBIDDEN, "تتطلب إدارة Ollama صلاحية المدير.");
    }
    let action = if request.method() == Method::GET {
        "catalog"
    } else if request.method() == Method::POST {
        "probe"
    } else if request.method() == Method::PUT {
        "setup"
    } else {
        return json_error(StatusCode::METHOD_NOT_ALLOWED, "طريقة غير متاحة.");
    };
    let model = if action == "catalog" {
        String::new()
    } else {
        let body = match to_bytes(request.into_body(), 4096).await {
            Ok(body) => body,
            Err(_) => return json_error(StatusCode::BAD_REQUEST, "طلب غير صالح."),
        };
        match serde_json::from_slice::<Value>(&body)
            .ok()
            .and_then(|v| v.get("model").and_then(Value::as_str).map(str::to_string))
        {
            Some(model) => model,
            None => return json_error(StatusCode::BAD_REQUEST, "اختر نموذجًا."),
        }
    };
    let script = state.config.project_root.join("scripts/ollama-runtime.mjs");
    let mut command = tokio::process::Command::new("node");
    command
        .arg(script)
        .arg(action)
        .arg(model)
        .kill_on_drop(true);
    match tokio::time::timeout(Duration::from_secs(320), command.output()).await {
        Ok(Ok(output)) => match serde_json::from_slice::<Value>(&output.stdout) {
            Ok(value) => {
                let status = if output.status.success() {
                    StatusCode::OK
                } else {
                    StatusCode::BAD_REQUEST
                };
                (status, Json(value)).into_response()
            }
            Err(_) => json_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "تعذر قراءة نتيجة فحص Ollama.",
            ),
        },
        _ => json_error(
            StatusCode::GATEWAY_TIMEOUT,
            "تعذر تشغيل فاحص Ollama أو انتهت مهلته.",
        ),
    }
}
