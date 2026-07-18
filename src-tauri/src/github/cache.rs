use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Cache em memória com TTL — evita estourar rate limit do GitHub.
pub struct TtlCache {
    ttl: Duration,
    map: Mutex<HashMap<String, (Instant, serde_json::Value)>>,
}

impl TtlCache {
    pub fn new(ttl: Duration) -> Self {
        Self {
            ttl,
            map: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, key: &str) -> Option<serde_json::Value> {
        let map = self.map.lock().unwrap();
        map.get(key).and_then(|(at, value)| {
            (at.elapsed() < self.ttl).then(|| value.clone())
        })
    }

    pub fn put(&self, key: &str, value: serde_json::Value) {
        self.map
            .lock()
            .unwrap()
            .insert(key.to_string(), (Instant::now(), value));
    }

    pub fn clear(&self) {
        self.map.lock().unwrap().clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn respeita_ttl() {
        let cache = TtlCache::new(Duration::from_millis(30));
        cache.put("k", serde_json::json!({"a": 1}));
        assert!(cache.get("k").is_some());
        std::thread::sleep(Duration::from_millis(40));
        assert!(cache.get("k").is_none());
    }

    #[test]
    fn clear_limpa_tudo() {
        let cache = TtlCache::new(Duration::from_secs(60));
        cache.put("k", serde_json::json!(1));
        cache.clear();
        assert!(cache.get("k").is_none());
    }
}
