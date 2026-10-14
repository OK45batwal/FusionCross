import { listJobs } from "./tauri";

export async function waitForJob(id: string, signal: AbortSignal, onProgress: (message: string) => void): Promise<string> {
  for (let attempt = 0; attempt < 2400; attempt++) {
    signal.throwIfAborted();
    const job = (await listJobs()).find((item) => item.id === id);
    signal.throwIfAborted();
    if (!job) throw new Error("This task is no longer available. Check background tasks before retrying.");
    if (job.status === "done") return job.message || "Installation finished.";
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.message || `Installation ${job.status}.`);
    onProgress(job.message || "Installing…");
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1500);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  throw new Error("Stopped waiting after one hour. The task may still be running; check Background tasks.");
}
