import { useEffect, useRef } from "react";
import "./ResultsPanel.css";

/*
  One results screen for both tools (image + video), so they look and
  behave the same.

  items: [{
    id, name, thumb, bytes, type, ready,
    state: "done" | "stale" | "error" | "processing" | "waiting" | "idle",
    progress, error
  }]
*/

function Icon({ name }) {
  if (name === "remove") {
    return (
      <svg className="rp-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 5l10 10" />
        <path d="M15 5 5 15" />
      </svg>
    );
  }

  if (name === "back") {
    return (
      <svg className="rp-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M16.5 10H4.5" />
        <path d="M9 5.5 4.5 10 9 14.5" />
      </svg>
    );
  }

  if (name === "zip") {
    return (
      <svg className="rp-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 2.75h6.5L15 6.25v11H5z" />
        <path d="M11.5 2.75v3.5H15" />
        <path d="M9 5v1.5M9 8v1.5M9 11v1.5" />
      </svg>
    );
  }

  if (name === "files") {
    return (
      <svg className="rp-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 3.25h7.5v11H7z" />
        <path d="M4.5 6v11h8" />
      </svg>
    );
  }

  return (
    <svg className="rp-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.25v9.2" />
      <path d="m6.1 9.2 3.9 3.9 3.9-3.9" />
      <path d="M4.25 16.75h11.5" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (!bytes) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Checkbox({ checked, indeterminate = false, disabled, onChange, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="rp-check"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
    />
  );
}

function StatusCell({ item }) {
  if (item.state === "processing") {
    const value = Math.round(item.progress || 0);

    return (
      <div className="rp-progress" aria-label={`${value}% done`}>
        <div className="rp-progress-track">
          <div className="rp-progress-fill" style={{ width: `${value}%` }} />
        </div>
        <span>{value}%</span>
      </div>
    );
  }

  if (item.state === "done") {
    return <span className="rp-badge is-done">✓ Ready</span>;
  }

  if (item.state === "stale") {
    return <span className="rp-badge is-stale">Old settings</span>;
  }

  if (item.state === "error") {
    return <span className="rp-badge is-error">Failed</span>;
  }

  if (item.state === "waiting") {
    return <span className="rp-badge is-waiting">Waiting</span>;
  }

  return <span className="rp-badge is-waiting">Not processed</span>;
}

function ResultsPanel({
  noun,
  items,
  isProcessing,
  progress = 0,
  statusMessage = "",
  summary = "",
  errorMessage = "",
  selectedIds,
  onToggle,
  onToggleAll,
  onDownload,
  onRemove,
  onCancel,
  onZipSelected,
  onZipAll,
  onDownloadSeparately,
  zipping = false,
  onEdit,
  onNewBatch,
}) {
  const plural = (count) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  const ready = items.filter((item) => item.ready);
  const selected = ready.filter((item) => selectedIds.includes(item.id));
  const allSelected = ready.length > 0 && selected.length === ready.length;
  const someSelected = selected.length > 0 && !allSelected;
  const selectedBytes = selected.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const failed = items.filter((item) => item.state === "error").length;

  const defaultSummary = `${ready.length} of ${plural(items.length)} ready${
    failed ? ` · ${failed} failed` : ""
  }`;

  return (
    <section className="rp">
      <div className={`rp-status ${isProcessing ? "is-busy" : ""}`} role="status">
        <div className="rp-status-row">
          <div className="rp-status-text">
            <strong>
              {isProcessing ? statusMessage || "Processing..." : summary || defaultSummary}
            </strong>
            {!isProcessing && ready.length > 0 && (
              <span>All finished files are selected. Untick any you don't need.</span>
            )}
          </div>

          {isProcessing && (
            <div className="rp-status-actions">
              <strong className="rp-percent">{progress}%</strong>
              {onCancel && (
                <button type="button" className="rp-btn rp-btn-outline" onClick={onCancel}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="rp-progress-track rp-overall">
            <div className="rp-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="rp-alert" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="rp-card">
        <div className="rp-head">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            disabled={!ready.length}
            onChange={onToggleAll}
            label={allSelected ? "Deselect all" : "Select all"}
          />
          <span className="rp-head-name">
            <span className="rp-head-desktop">Name</span>
            <span className="rp-head-mobile">
              {allSelected ? "Deselect all" : "Select all"} · {selected.length} selected
            </span>
          </span>
          <span className="rp-head-desktop">Size</span>
          <span className="rp-head-desktop">Type</span>
          <span className="rp-head-desktop">Status</span>
          <span className="rp-head-desktop rp-head-actions">Actions</span>
        </div>

        <div className="rp-body">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={`rp-row ${isSelected ? "is-selected" : ""} ${
                  item.state === "error" ? "is-error" : ""
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={!item.ready}
                  onChange={() => onToggle(item.id)}
                  label={`Select ${item.name}`}
                />

                <div className="rp-file">
                  {item.thumb ? (
                    <img src={item.thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="rp-thumb-fallback" aria-hidden="true">
                      ▶
                    </span>
                  )}
                  <div className="rp-file-text">
                    <strong title={item.name}>{item.name}</strong>
                    {item.state === "error" && item.error && (
                      <small className="rp-row-error">{item.error}</small>
                    )}
                  </div>
                </div>

                <span className="rp-size">{item.ready ? formatBytes(item.bytes) : "—"}</span>
                <span className="rp-type">{item.type}</span>

                <div className="rp-status-cell">
                  <StatusCell item={item} />
                </div>

                <div className="rp-actions">
                  <button
                    type="button"
                    className="rp-icon-btn"
                    disabled={!item.ready}
                    onClick={() => onDownload(item.id)}
                    aria-label={`Download ${item.name}`}
                    title="Download"
                  >
                    <Icon name="download" />
                  </button>

                  {onRemove && (
                    <button
                      type="button"
                      className="rp-icon-btn is-danger"
                      disabled={isProcessing}
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.name}`}
                      title="Remove"
                    >
                      <Icon name="remove" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rp-downloads">
        <div className="rp-downloads-info">
          <strong>
            {selected.length} of {plural(ready.length)} selected
          </strong>
          <span>{selected.length ? `Total ${formatBytes(selectedBytes)}` : "Tick files to download them"}</span>
        </div>

        <div className="rp-downloads-actions">
          <button
            type="button"
            className="rp-btn rp-btn-primary"
            disabled={!selected.length || zipping || isProcessing}
            onClick={onZipSelected}
          >
            <Icon name="zip" />
            {zipping ? "Preparing ZIP..." : `Download selected (${selected.length}) as ZIP`}
          </button>

          <button
            type="button"
            className="rp-btn rp-btn-outline"
            disabled={!ready.length || zipping || isProcessing}
            onClick={onZipAll}
          >
            <Icon name="zip" />
            All as ZIP
          </button>

          <button
            type="button"
            className="rp-btn rp-btn-outline"
            disabled={!ready.length || isProcessing}
            onClick={onDownloadSeparately}
          >
            <Icon name="files" />
            All separately
          </button>
        </div>
      </div>

      <div className="rp-footer">
        <button
          type="button"
          className="rp-btn rp-btn-outline"
          disabled={isProcessing}
          onClick={onEdit}
        >
          <Icon name="back" />
          Edit settings
        </button>

        <button
          type="button"
          className="rp-btn rp-btn-dark"
          disabled={isProcessing}
          onClick={onNewBatch}
        >
          Start new batch
        </button>
      </div>
    </section>
  );
}

export default ResultsPanel;
