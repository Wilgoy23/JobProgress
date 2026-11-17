import { useRef } from 'react';

export default function Header({ onAdd, onExportJson, onExportCsv, onImportFile }) {
  const fileInput = useRef(null);

  return (
    <header className="app-header">
      <div className="brand">
        <h1>Job Progress</h1>
        <p className="subtitle">Every application, one place.</p>
      </div>
      <div className="header-actions">
        <button type="button" className="btn btn-ghost" onClick={onExportJson}>Export JSON</button>
        <button type="button" className="btn btn-ghost" onClick={onExportCsv}>Export CSV</button>
        <button type="button" className="btn btn-ghost" onClick={() => fileInput.current.click()}>Import</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (file) onImportFile(file);
          }}
        />
        <button type="button" className="btn btn-primary" onClick={onAdd}>+ Add job</button>
      </div>
    </header>
  );
}
