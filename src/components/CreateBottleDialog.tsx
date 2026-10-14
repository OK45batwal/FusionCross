import { useState } from "react";
import { createBottle, type Bottle, type BottleTemplate } from "../services/tauri";
import { errorMessage } from "../services/errors";
import { Modal } from "./Modal";

export function CreateBottleDialog({ templates, onCreated, onClose }: {
  templates: BottleTemplate[]; onCreated: (bottle: Bottle) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(templates[0]?.type || "gaming");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <Modal label="Create New Bottle Environment" onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !name.trim()) return;
      setBusy(true);
      setError(null);
      try { onCreated(await createBottle(name.trim(), template)); }
      catch (cause) { setError(errorMessage(cause, "Could not create the bottle.")); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-lg font-semibold">Create New Bottle Environment</h2>
      {error && <p role="alert">{error}</p>}
      <label className="block">Bottle Name
        <input autoFocus required maxLength={200} value={name} disabled={busy} onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-(--border-color) bg-(--bg-elevated) p-2" />
      </label>
      <fieldset disabled={busy} className="space-y-2">
        <legend>Environment Template</legend>
        {templates.map((item) => <label key={item.type} className="flex gap-2 rounded-lg border border-(--border-color) p-2">
          <input type="radio" name="template" value={item.type} checked={template === item.type} onChange={() => setTemplate(item.type)} />
          <span>{item.label}<span className="block text-xs text-(--text-muted)">{item.description}</span></span>
        </label>)}
      </fieldset>
      <div className="flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" disabled={busy || !name.trim() || templates.length === 0} className="rounded-lg bg-(--accent-primary) px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Creating…" : "Create Bottle"}
        </button>
      </div>
    </form>
  </Modal>;
}
