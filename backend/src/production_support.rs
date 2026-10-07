use super::*;

const PRODUCTION_CHECK_OUTPUT_LIMIT: usize = 512 * 1024;

fn production_project_root() -> Result<PathBuf> {
    let configured = env::var("CODEX_WEBUI_PROJECT_ROOT").ok();
    let root = configured
        .map(PathBuf::from)
        .unwrap_or(env::current_dir().context("resolve current working directory")?);
    let root = root
        .canonicalize()
        .with_context(|| format!("resolve production project root: {}", root.display()))?;
    if !root.join("package.json").is_file() {
        anyhow::bail!(
            "{{"code":"PRODUCTION_ROOT_INVALID","message":"Production project root does not contain package.json."}}"
        );
    }
    Ok(root)
}

fn production_check_spec(check: &str) -> Result<(&'static str, Duration)> {
    match check {
        "release" => Ok(("release:check", Duration::from_secs(30 * 60))),
        "foundry" => Ok(("foundry:doctor", Duration::from_secs(3 * 60))),
        "production" => Ok(("prod:doctor", Duration::from_secs(3 * 60))),
        "mcp" => Ok(("mcp:doctor", Duration::from_secs(2 * 60))),
        _ => anyhow::bail!(
            "{{"code":"PRODUCTION_CHECK_NOT_ALLOWED","message":"Unknown production check."}}"
        ),
    }
}

fn truncate_check_output(value: &[u8]) -> (String, bool) {
    if value.len() <= PRODUCTION_CHECK_OUTPUT_LIMIT {
        return (String::from_utf8_lossy(value).into_owned(), false);
    }

    let start = value.len().saturating_sub(PRODUCTION_CHECK_OUTPUT_LIMIT);
    (
        format!(
            "[output truncated to last {} bytes]\n{}",
            PRODUCTION_CHECK_OUTPUT_LIMIT,
            String::from_utf8_lossy(&value[start..])
        ),
        true,
    )
}

pub(crate) async fn run_production_check_payload(params: Value) -> Result<Value> {
    let check = params
        .get("check")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("production check is required"))?;

    let (script, timeout_duration) = production_check_spec(check)?;
    let root = production_project_root()?;
    let pnpm_bin = env::var("CODEX_WEBUI_PNPM_BIN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "pnpm".to_string());

    let started_at = now_unix_ms();
    let mut command = Command::new(&pnpm_bin);
    command
        .arg(script)
        .current_dir(&root)
        .kill_on_drop(true)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = tokio::time::timeout(timeout_duration, command.output())
        .await
        .map_err(|_| {
            anyhow!(
                "{{"code":"PRODUCTION_CHECK_TIMEOUT","message":"Production check timed out."}}"
            )
        })?
        .with_context(|| format!("run production check with {pnpm_bin}"))?;

    let completed_at = now_unix_ms();
    let (stdout, stdout_truncated) = truncate_check_output(&output.stdout);
    let (stderr, stderr_truncated) = truncate_check_output(&output.stderr);
    let success = output.status.success();

    Ok(json!({
        "ok": success,
        "check": check,
        "script": script,
        "cwd": root,
        "exitCode": output.status.code(),
        "startedAt": started_at,
        "completedAt": completed_at,
        "durationMs": completed_at.saturating_sub(started_at),
        "stdout": stdout,
        "stderr": stderr,
        "truncated": stdout_truncated || stderr_truncated
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_checks_are_allowlisted() {
        assert_eq!(production_check_spec("release").unwrap().0, "release:check");
        assert_eq!(production_check_spec("foundry").unwrap().0, "foundry:doctor");
        assert_eq!(production_check_spec("production").unwrap().0, "prod:doctor");
        assert_eq!(production_check_spec("mcp").unwrap().0, "mcp:doctor");
        assert!(production_check_spec("rm -rf /").is_err());
    }

    #[test]
    fn production_check_output_is_bounded() {
        let source = vec![b'x'; PRODUCTION_CHECK_OUTPUT_LIMIT + 100];
        let (value, truncated) = truncate_check_output(&source);
        assert!(truncated);
        assert!(value.contains("output truncated"));
        assert!(value.len() <= PRODUCTION_CHECK_OUTPUT_LIMIT + 128);
    }
}
