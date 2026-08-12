// ponytail: new_id is wired into commands in the next layer.
#![allow(dead_code)]
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// Short, collision-resistant stable ID.
///
/// Time nanos + process id + monotonic counter hashed down to 12 lowercase hex chars.
/// Deterministic enough to test, unique enough for a single-user desktop app.
pub fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = std::process::id() as u64;

    let mut mix = nanos as u64 ^ (pid.wrapping_mul(0x9E3779B97F4A7C15)) ^ counter;
    // xorshift64* to diffuse
    mix ^= mix >> 30;
    mix = mix.wrapping_mul(0xBF58476D1CE4E5B9);
    mix ^= mix >> 27;
    mix = mix.wrapping_mul(0x94D049BB133111EB);
    mix ^= mix >> 31;
    mix &= (1u64 << 48) - 1; // keep it to 12 hex digits

    format!("{mix:012x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_unique_and_formatted() {
        let mut seen = std::collections::HashSet::new();
        for _ in 0..10_000 {
            let id = new_id();
            assert_eq!(id.len(), 12);
            assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
            seen.insert(id);
        }
        assert_eq!(seen.len(), 10_000);
    }
}
