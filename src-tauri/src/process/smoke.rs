//! Opt-in real Wine smoke test. Never uses a user's existing prefix.
use super::*;
use std::path::PathBuf;
use std::process::Command;

struct TestPrefix {
    path: PathBuf,
    wine: PathBuf,
}
impl Drop for TestPrefix {
    fn drop(&mut self) {
        if let Some(parent) = self.wine.parent() {
            let _ = Command::new(parent.join("wineserver"))
                .env("WINEPREFIX", &self.path)
                .arg("-k")
                .status();
        }
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

#[test]
#[ignore = "Requires a local Wine runtime and launches Wine in a disposable prefix"]
fn native_wine_smoke() {
    let wine = PathBuf::from(
        std::env::var("FUSIONCROSS_TEST_WINE")
            .expect("Set FUSIONCROSS_TEST_WINE to an installed Wine binary"),
    );
    assert!(wine.is_absolute() && wine.is_file());
    let prefix = TestPrefix {
        path: std::env::temp_dir().join(format!(
            "fusioncross-wine-smoke-{}",
            crate::core::ids::new_id()
        )),
        wine,
    };
    std::fs::create_dir(&prefix.path).unwrap();
    let control = Arc::new(job::JobControl::default());
    let timeout_control = control.clone();
    let (done, wait_done) = std::sync::mpsc::channel();
    let deadline = std::thread::spawn(move || {
        if wait_done.recv_timeout(Duration::from_secs(120)).is_err() {
            timeout_control.cancel();
        }
    });
    let boot = control.run(
        Command::new(&prefix.wine)
            .env("WINEPREFIX", &prefix.path)
            .env("WINEDEBUG", "-all")
            .env("WINEDLLOVERRIDES", "mscoree,mshtml=")
            .args(["wineboot", "-i"]),
    );
    let _ = done.send(());
    deadline.join().unwrap();
    assert!(boot
        .expect("Wine initialization failed or timed out")
        .success());
    assert!(crate::wine::prefix::prefix_prepared(&prefix.path));

    let (send, receive) = std::sync::mpsc::channel();
    let manager = ProcessManager::new(Arc::new(move |record| {
        let _ = send.send(record);
    }));
    let log = prefix.path.join("smoke.log");
    manager
        .spawn(
            "smoke",
            "test-prefix",
            "Windows command smoke",
            prefix.wine.to_str().unwrap(),
            prefix.path.to_str().unwrap(),
            "cmd",
            &["/c".into(), "echo FUSIONCROSS_WINE_SMOKE_OK".into()],
            &[("WINEDEBUG".into(), "-all".into())],
            "mscoree,mshtml=",
            Some(&log),
        )
        .unwrap();
    let record = receive
        .recv_timeout(Duration::from_secs(30))
        .expect("Wine command did not finish");
    assert_eq!(record.exit_code, Some(0));
    assert!(std::fs::read_to_string(log)
        .unwrap()
        .contains("FUSIONCROSS_WINE_SMOKE_OK"));
    assert!(manager.running().is_empty());
    println!("Native Wine initialization, Windows command execution, logging, and session tracking passed.");
}
