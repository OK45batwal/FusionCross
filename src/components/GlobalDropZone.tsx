import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bottle } from "../services/tauri";
import { DownloadCloud, Sparkles, FolderArchive, ArrowRight } from "lucide-react";

interface GlobalDropZoneProps {
  bottles: Bottle[];
  selectedBottleId: string | null;
  onFileDropped: (filePath: string, targetBottleId: string) => void;
}

export function GlobalDropZone({
  bottles,
  selectedBottleId,
  onFileDropped,
}: GlobalDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredFileNames, setHoveredFileNames] = useState<string[]>([]);
  const [dragTargetBottleId, setDragTargetBottleId] = useState<string>(
    selectedBottleId || (bottles.length > 0 ? bottles[0].id : "")
  );

  const effectiveTargetId =
    dragTargetBottleId || selectedBottleId || (bottles.length > 0 ? bottles[0].id : "");

  const targetBottle = bottles.find((b) => b.id === effectiveTargetId) || bottles[0];

  const handleDropPaths = useCallback(
    (paths: string[]) => {
      setIsDragging(false);
      setHoveredFileNames([]);
      if (!paths || paths.length === 0) return;

      const firstPath = paths[0];
      const targetId = effectiveTargetId || (bottles.length > 0 ? bottles[0].id : "");
      onFileDropped(firstPath, targetId);
    },
    [effectiveTargetId, bottles, onFileDropped]
  );

  // 1. Tauri Native Window Drag-Drop Listener (macOS Finder native paths)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupTauriDragDrop = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "enter") {
            setIsDragging(true);
            if (event.payload.paths && event.payload.paths.length > 0) {
              const names = event.payload.paths.map((p) => p.split("/").pop() || p);
              setHoveredFileNames(names);
            }
          } else if (event.payload.type === "over") {
            if (!isDragging) setIsDragging(true);
          } else if (event.payload.type === "drop") {
            handleDropPaths(event.payload.paths);
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
            setHoveredFileNames([]);
          }
        });
      } catch (err) {
        console.warn("Tauri onDragDropEvent listener not available in this environment:", err);
      }
    };

    setupTauriDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, [handleDropPaths, isDragging]);

  // 2. DOM Fallback Drag-Drop Listeners
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only dismiss if leaving window
      if (!e.relatedTarget || (e.clientX <= 0 && e.clientY <= 0)) {
        setIsDragging(false);
        setHoveredFileNames([]);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setHoveredFileNames([]);

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        // On macOS webviews, file objects often carry .path
        const paths = files
          .map((f) => (f as unknown as { path?: string }).path || f.name)
          .filter(Boolean);
        if (paths.length > 0) {
          handleDropPaths(paths);
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDropPaths, isDragging]);

  if (!isDragging) return null;

  return (
    <div
      className="fixed inset-0 z-100 pointer-events-auto flex items-center justify-center p-8 bg-black/70 backdrop-blur-md animate-fade-in"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="relative max-w-lg w-full rounded-2xl border-2 border-dashed border-(--accent) bg-(--bg-glass)/90 backdrop-blur-2xl p-10 flex flex-col items-center text-center shadow-2xl shadow-(--accent)/10 animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-(--accent)/10 border border-(--accent)/30 flex items-center justify-center text-(--accent) mb-5 shadow-inner">
          <DownloadCloud className="w-8 h-8 animate-bounce" />
        </div>

        <h2 className="text-[18px] font-semibold text-(--text-primary) tracking-tight mb-2">
          Drop Windows Application to Install
        </h2>

        <p className="text-[13px] text-(--text-secondary) mb-6 max-w-sm leading-relaxed">
          Supports <span className="font-mono text-(--text-primary) font-medium">.exe</span>,{" "}
          <span className="font-mono text-(--text-primary) font-medium">.msi</span>,{" "}
          <span className="font-mono text-(--text-primary) font-medium">.bat</span> installers and standalones.
        </p>

        {hoveredFileNames.length > 0 && (
          <div className="w-full bg-(--bg-card) border border-(--border-color) rounded-lg px-4 py-2.5 mb-6 flex items-center gap-3 text-left">
            <FolderArchive className="w-4 h-4 text-(--accent) shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-(--text-tertiary) uppercase font-mono tracking-wider">
                Incoming File
              </div>
              <div className="text-[12px] font-mono text-(--text-primary) truncate">
                {hoveredFileNames.join(", ")}
              </div>
            </div>
          </div>
        )}

        {bottles.length > 0 ? (
          <div className="w-full bg-(--bg-subtle) border border-(--border-color) rounded-xl p-3.5 mb-2 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[11px] text-(--text-secondary) block">Target Bottle</span>
              <span className="text-[13px] font-medium text-(--text-primary) flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {targetBottle?.name || "Select Bottle"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Target Bottle"
                value={effectiveTargetId}
                onChange={(e) => setDragTargetBottleId(e.target.value)}
                className="bg-(--bg-card) border border-(--border-color) text-[12px] rounded-md px-2.5 py-1 text-(--text-primary) font-sans focus:outline-none focus:border-(--accent)"
              >
                {bottles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.windows_version})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            A new gaming bottle will be automatically created for this application.
          </div>
        )}

        <div className="text-[11px] text-(--text-tertiary) flex items-center gap-1.5 mt-3">
          Release file in this window to inspect & execute <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
