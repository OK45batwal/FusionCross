import { useEffect, useRef, useState } from "react";
import { cancelJob, listJobs, type Job } from "../services/tauri";
import { errorMessage } from "../services/errors";

export function JobPanel({ onCompleted }: { onCompleted: () => Promise<void> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const statuses = useRef(new Map<string, Job["status"]>());
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await listJobs();
        if (disposed) return;
        const completed = next.some((job) => ["done", "failed", "cancelled"].includes(job.status) && statuses.current.get(job.id) !== job.status);
        statuses.current = new Map(next.map((job) => [job.id, job.status]));
        setJobs(next);
        setError(null);
        if (completed) await onCompleted();
      } catch (cause) {
        if (!disposed) setError(errorMessage(cause, "Task status is unavailable."));
      } finally {
        if (!disposed) timer = setTimeout(poll, 1500);
      }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [onCompleted]);
  if (!jobs.length && !error) return null;
  const active = jobs.filter((job) => ["running", "cancelling"].includes(job.status));
  const visible = [...active, ...jobs.filter((job) => !active.includes(job)).slice(-5)];
  return <details className="shrink-0 border-b border-(--border-color) px-6 py-2 text-xs">
    <summary className="cursor-pointer">Background tasks ({active.length} active){error ? " — status unavailable" : ""}</summary>
    {error && <p role="alert">{error}</p>}
    <ul className="max-h-40 overflow-y-auto space-y-2 py-2">
      {visible.map((job) => <li key={job.id} className="flex items-center justify-between gap-3">
        <span><strong>{job.title}</strong> — {job.status}<span className="block text-(--text-muted)">{job.message}</span></span>
        {job.can_cancel && <button className="underline" onClick={async () => {
          try { await cancelJob(job.id); }
          catch (cause) { setError(errorMessage(cause, "Could not cancel the task.")); }
        }} aria-label={`Cancel ${job.title}`}>Cancel</button>}
      </li>)}
    </ul>
  </details>;
}
