use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};

use crate::error::{Error, Result};

/// Callback das threads do pty: `Some(bytes)` = output, `None` = sessão encerrou.
pub type OnData = Arc<dyn Fn(Option<Vec<u8>>) + Send + Sync + 'static>;

struct Session {
    master: Box<dyn MasterPty + Send>,
    /// Arc próprio: escrever NÃO pode segurar o lock do registry —
    /// write_all bloqueia se o pipe do ConPTY estiver cheio.
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pid: Option<u32>,
}

/// Mata o processo e a árvore inteira dele (shell + filhos), sem shell string.
/// `clone_killer` do portable-pty devolve handle inválido no Windows; taskkill
/// por PID é o caminho confiável e ainda encerra processos filhos do shell.
fn kill_tree(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

pub struct PtyRegistry {
    sessions: Arc<Mutex<HashMap<u32, Session>>>,
    next_id: AtomicU32,
}

pub struct SpawnSpec<'a> {
    pub program: &'a str,
    pub args: &'a [&'a str],
    pub cwd: &'a Path,
    pub cols: u16,
    pub rows: u16,
}

impl PtyRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicU32::new(1),
        }
    }

    pub fn spawn(&self, spec: SpawnSpec, on_data: OnData) -> Result<u32> {
        let pty = native_pty_system()
            .openpty(PtySize {
                rows: spec.rows,
                cols: spec.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| Error::Pty(e.to_string()))?;

        let mut cmd = CommandBuilder::new(spec.program);
        cmd.args(spec.args);
        cmd.cwd(spec.cwd);

        let mut child = pty
            .slave
            .spawn_command(cmd)
            .map_err(|e| Error::Pty(e.to_string()))?;
        // O lado slave fica só com o filho; segurar aqui atrasa o EOF do reader.
        drop(pty.slave);

        let mut reader = pty
            .master
            .try_clone_reader()
            .map_err(|e| Error::Pty(e.to_string()))?;
        let writer = pty
            .master
            .take_writer()
            .map_err(|e| Error::Pty(e.to_string()))?;
        let pid = child.process_id();

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.sessions.lock().unwrap().insert(
            id,
            Session {
                master: pty.master,
                writer: Arc::new(Mutex::new(writer)),
                pid,
            },
        );

        let epoch = std::time::Instant::now();
        let last_activity = Arc::new(std::sync::atomic::AtomicU64::new(0));

        // Thread leitora: só encaminha bytes. No Windows o EOF chega depois
        // que a waiter dropa o master (ClosePseudoConsole).
        {
            let on_data = Arc::clone(&on_data);
            let last_activity = Arc::clone(&last_activity);
            std::thread::spawn(move || {
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            last_activity
                                .store(epoch.elapsed().as_millis() as u64, Ordering::Relaxed);
                            on_data(Some(buf[..n].to_vec()));
                        }
                    }
                }
            });
        }

        // Thread waiter: dona do Child. Depois do wait(), espera a leitora drenar o
        // buffer do ConPTY (quiescência) antes de dropar o master — dropar cedo
        // descarta output pendente.
        {
            let sessions = Arc::clone(&self.sessions);
            std::thread::spawn(move || {
                let _ = child.wait();
                let drain_deadline =
                    std::time::Instant::now() + std::time::Duration::from_millis(500);
                loop {
                    let idle_ms = epoch
                        .elapsed()
                        .as_millis()
                        .saturating_sub(last_activity.load(Ordering::Relaxed) as u128);
                    if idle_ms >= 60 || std::time::Instant::now() >= drain_deadline {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(15));
                }
                sessions.lock().unwrap().remove(&id);
                on_data(None);
            });
        }

        Ok(id)
    }

    pub fn write(&self, id: u32, data: &[u8]) -> Result<()> {
        // Clona o Arc e SOLTA o lock do registry antes de escrever.
        let writer = {
            let sessions = self.sessions.lock().unwrap();
            Arc::clone(&sessions.get(&id).ok_or(Error::PtyNotFound(id))?.writer)
        };
        let mut w = writer.lock().unwrap();
        w.write_all(data)?;
        w.flush()?;
        Ok(())
    }

    pub fn resize(&self, id: u32, cols: u16, rows: u16) -> Result<()> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(&id).ok_or(Error::PtyNotFound(id))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| Error::Pty(e.to_string()))
    }

    /// Pede o encerramento; a limpeza fica com a thread waiter (que reapa e remove).
    pub fn kill(&self, id: u32) -> Result<()> {
        let pid = {
            let sessions = self.sessions.lock().unwrap();
            sessions.get(&id).ok_or(Error::PtyNotFound(id))?.pid
        };
        if let Some(pid) = pid {
            kill_tree(pid);
        }
        Ok(())
    }

    /// Mata todas as sessões — chamado no encerramento do app para não vazar conhost.
    pub fn kill_all(&self) {
        let pids: Vec<u32> = {
            let sessions = self.sessions.lock().unwrap();
            sessions.values().filter_map(|s| s.pid).collect()
        };
        for pid in pids {
            kill_tree(pid);
        }
    }

    #[cfg(test)]
    fn contains(&self, id: u32) -> bool {
        self.sessions.lock().unwrap().contains_key(&id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn collect_until_exit(
        registry: &PtyRegistry,
        id: u32,
        rx: &mpsc::Receiver<Option<Vec<u8>>>,
        secs: u64,
    ) -> (String, bool) {
        let mut collected = Vec::new();
        let mut saw_exit = false;
        let mut answered_dsr = false;
        let deadline = std::time::Instant::now() + Duration::from_secs(secs);
        while std::time::Instant::now() < deadline {
            match rx.recv_timeout(Duration::from_millis(300)) {
                Ok(Some(bytes)) => {
                    collected.extend_from_slice(&bytes);
                    // ConPTY pede posição do cursor (DSR) e trava até a resposta;
                    // o xterm.js responde sozinho no app — aqui respondemos na mão.
                    if !answered_dsr
                        && String::from_utf8_lossy(&collected).contains("\x1b[6n")
                    {
                        answered_dsr = true;
                        let _ = registry.write(id, b"\x1b[1;1R");
                    }
                }
                Ok(None) => {
                    saw_exit = true;
                    break;
                }
                Err(_) => {}
            }
        }
        (String::from_utf8_lossy(&collected).into_owned(), saw_exit)
    }

    #[test]
    fn spawn_echo_produces_output_and_exit() {
        let registry = PtyRegistry::new();
        let (tx, rx) = mpsc::channel::<Option<Vec<u8>>>();
        let id = registry
            .spawn(
                SpawnSpec {
                    program: "cmd.exe",
                    args: &["/c", "echo olimpo-pty-ok"],
                    cwd: Path::new("C:\\"),
                    cols: 80,
                    rows: 24,
                },
                Arc::new(move |chunk| {
                    let _ = tx.send(chunk);
                }),
            )
            .expect("spawn deve funcionar");

        let (text, saw_exit) = collect_until_exit(&registry, id, &rx, 10);
        assert!(text.contains("olimpo-pty-ok"), "output: {text}");
        assert!(saw_exit, "sessão deve sinalizar encerramento");
        assert!(!registry.contains(id), "sessão deve sair do registry");
    }

    #[test]
    fn write_to_unknown_session_errors() {
        let registry = PtyRegistry::new();
        assert!(matches!(
            registry.write(999, b"x"),
            Err(Error::PtyNotFound(999))
        ));
    }

    #[test]
    fn kill_terminates_interactive_session() {
        let registry = PtyRegistry::new();
        let (tx, rx) = mpsc::channel::<Option<Vec<u8>>>();
        let id = registry
            .spawn(
                SpawnSpec {
                    // cmd interativo: ficaria vivo para sempre sem o kill.
                    program: "cmd.exe",
                    args: &[],
                    cwd: Path::new("C:\\"),
                    cols: 80,
                    rows: 24,
                },
                Arc::new(move |chunk| {
                    let _ = tx.send(chunk);
                }),
            )
            .unwrap();

        registry.kill(id).expect("kill deve funcionar");
        let (_, saw_exit) = collect_until_exit(&registry, id, &rx, 10);
        assert!(saw_exit, "kill deve levar ao encerramento");
        assert!(!registry.contains(id), "sessão deve sair do registry");
    }
}
