use crate::core::errors::FusionError;
use std::process::{Command, ExitStatus};
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::{Duration, Instant};

/// 0 = cancellable, 1 = cancellation requested, 2 = committing/finished.
#[derive(Debug, Default)]
pub struct JobControl(AtomicU8);

impl JobControl {
    pub fn cancel(&self) -> bool {
        self.0
            .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }
    pub fn can_cancel(&self) -> bool {
        self.0.load(Ordering::SeqCst) == 0
    }
    pub fn check(&self) -> Result<(), FusionError> {
        if self.0.load(Ordering::SeqCst) == 1 {
            Err(FusionError::Cancelled)
        } else {
            Ok(())
        }
    }
    pub fn seal(&self) -> Result<(), FusionError> {
        self.0
            .compare_exchange(0, 2, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| ())
            .or_else(|_| self.check())
    }
    pub fn run(&self, command: &mut Command) -> Result<ExitStatus, FusionError> {
        use std::os::unix::process::CommandExt;
        self.check()?;
        let mut child = command
            .process_group(0)
            .stdin(std::process::Stdio::null())
            .spawn()
            .map_err(|_| FusionError::LaunchFailed)?;
        let mut stopping = None;
        loop {
            if self.check().is_err() && stopping.is_none() {
                unsafe {
                    libc::kill(-(child.id() as i32), libc::SIGTERM);
                }
                stopping = Some(Instant::now());
            }
            match child.try_wait() {
                Ok(Some(status)) => {
                    // The worker can exit on TERM while descendants ignore it.
                    // Finish stopping its process group before reporting cancellation.
                    if self.check().is_err() {
                        unsafe {
                            libc::kill(-(child.id() as i32), libc::SIGKILL);
                        }
                    }
                    self.check()?;
                    return Ok(status);
                }
                Ok(None) => {}
                Err(_) => {
                    unsafe {
                        libc::kill(-(child.id() as i32), libc::SIGKILL);
                    }
                    let _ = child.wait();
                    return Err(FusionError::LaunchFailed);
                }
            }
            if stopping.is_some_and(|time| time.elapsed() >= Duration::from_secs(3)) {
                unsafe {
                    libc::kill(-(child.id() as i32), libc::SIGKILL);
                }
                let _ = child.wait();
                return Err(FusionError::Cancelled);
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_reaps_the_worker_and_commit_disables_cancellation() {
        let control = std::sync::Arc::new(JobControl::default());
        let worker = control.clone();
        let thread = std::thread::spawn(move || worker.run(Command::new("/bin/sleep").arg("30")));
        std::thread::sleep(Duration::from_millis(100));
        assert!(control.cancel());
        assert_eq!(thread.join().unwrap().unwrap_err(), FusionError::Cancelled);
        let completed = JobControl::default();
        completed.seal().unwrap();
        assert!(!completed.cancel());
    }
}
