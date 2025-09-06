import React, {
  useState,
  useCallback,
  useRef,
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
} from 'react';

// Define types locally for now (would normally import from @misc-poc/application)
interface ExportDTO {
  records: Record<string, unknown>[];
  format: 'json' | 'csv' | 'xml' | 'yaml';
  exportedAt: string;
  version: string;
  metadata: {
    totalRecords: number;
    exportSource: string;
  };
}

interface ImportResultDTO {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  importedAt: string;
  duration: number;
  summary: {
    recordsCreated: number;
    recordsUpdated: number;
    recordsSkipped: number;
    recordsFailed: number;
  };
}

interface ImportExportProps {
  className?: string;
  hasExistingData?: boolean;
  progress?: number;
  exportFilenamePrefix?: string;
  defaultExportFormat?: 'json' | 'csv' | 'xml' | 'yaml';
  onImport?: (file: File) => Promise<ImportResultDTO>;
  onExport?: (format: 'json' | 'csv' | 'xml' | 'yaml') => Promise<ExportDTO>;
}

interface FileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
}

const SUPPORTED_FORMATS = ['.json', '.csv', '.xml', '.yaml'];
// Removed SUPPORTED_MIME_TYPES as it's not currently used

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const generateFilename = (prefix?: string, format: string = 'json'): string => {
  const date = new Date().toISOString().split('T')[0];
  const basePrefix = prefix || 'data-export';
  return `${basePrefix}-${date}.${format}`;
};

export const ImportExport: React.FC<ImportExportProps> = ({
  className = '',
  hasExistingData = false,
  progress,
  exportFilenamePrefix,
  defaultExportFormat = 'json',
  onImport,
  onExport,
}) => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResultDTO | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'xml' | 'yaml'>(defaultExportFormat);
  const [exportedFilename, setExportedFilename] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const validateFile = (file: File): string | null => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      return 'Unsupported file format. Please select a JSON, CSV, XML, or YAML file.';
    }

    return null;
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
    setImportResult(null);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const { dataTransfer } = event;
    
    if (dataTransfer.items) {
      const items = Array.from(dataTransfer.items);
      const fileItems = items.filter(item => item.kind === 'file');
      
      if (fileItems.length === 0) {
        setError('Only files are allowed for import.');
        return;
      }

      const files = fileItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      if (files.length > 0) {
        // Create a simple FileList-like object
        const fileList = {
          length: files.length,
          item: (index: number) => files[index] || null,
          [Symbol.iterator]: () => files[Symbol.iterator](),
          ...files
        } as FileList;
        handleFileSelect(fileList);
      }
    } else if (dataTransfer.files) {
      handleFileSelect(dataTransfer.files);
    }
  };

  const handleDropZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
      fileInputRef.current?.focus();
    }
  };

  const handleImportClick = async () => {
    if (!selectedFile || !onImport) return;

    if (hasExistingData) {
      setShowConfirmDialog(true);
      return;
    }

    await performImport();
  };

  const performImport = async () => {
    if (!selectedFile || !onImport) return;

    setError(null);
    setImportResult(null);
    setIsImporting(true);
    setShowConfirmDialog(false);

    try {
      const result = await onImport(selectedFile.file);
      setImportResult(result);
      if (result.success || result.successCount > 0) {
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportClick = async () => {
    if (!onExport) return;

    setError(null);
    setIsExporting(true);

    try {
      const result = await onExport(exportFormat);
      const filename = generateFilename(exportFilenamePrefix, exportFormat);
      setExportedFilename(filename);
      
      // In a real implementation, you would trigger file download here
      console.log('Export completed:', { result, filename });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmImport = () => {
    performImport();
  };

  const handleCancelImport = () => {
    setShowConfirmDialog(false);
  };

  // Clear error when starting new operations
  useEffect(() => {
    if (isImporting || isExporting) {
      setError(null);
    }
  }, [isImporting, isExporting]);

  const renderProgressBar = (label: string) => (
    <div className="progress-container" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-label">{label}</div>
      {progress !== undefined && (
        <>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-percentage">{progress}%</div>
        </>
      )}
    </div>
  );

  const renderImportResult = () => {
    if (!importResult) return null;

    if (importResult.success) {
      return (
        <div className="result-message success" role="status">
          Successfully imported {importResult.successCount} records. {importResult.summary.recordsCreated} created.
        </div>
      );
    } else if (importResult.successCount > 0) {
      return (
        <div className="result-message warning" role="status">
          {importResult.successCount} of {importResult.totalProcessed} records imported successfully. {importResult.summary.recordsFailed} failed.
        </div>
      );
    }

    return null;
  };

  const renderConfirmDialog = () => {
    if (!showConfirmDialog) return null;

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="dialog" aria-labelledby="confirm-dialog-title" aria-modal="true">
          <h3 id="confirm-dialog-title">Confirm Import</h3>
          <p>This will replace your existing data. Are you sure you want to continue?</p>
          <div className="dialog-actions">
            <button type="button" onClick={handleCancelImport}>
              Cancel
            </button>
            <button type="button" onClick={handleConfirmImport} className="primary">
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-testid="import-export-container" className={`import-export-container ${className}`}>
      {/* Import Section */}
      <section 
        data-testid="import-section"
        aria-labelledby="import-heading"
        role="region"
        aria-label="Import data section"
      >
        <h2 id="import-heading">Import Data</h2>
        
        <div
          ref={dropZoneRef}
          data-testid="drop-zone"
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onKeyDown={handleDropZoneKeyDown}
          tabIndex={0}
          aria-label="Drop files here to import"
        >
          <div className="file-input-container">
            <input
              ref={fileInputRef}
              type="file"
              id="file-input"
              accept={SUPPORTED_FORMATS.join(',')}
              onChange={handleInputChange}
              aria-describedby="file-input-help"
              disabled={isImporting}
            />
            <label htmlFor="file-input">
              Choose File
            </label>
            <div id="file-input-help">
              Supported formats: JSON, CSV, XML, YAML
            </div>
          </div>
          
          {selectedFile && (
            <div className="selected-file">
              <div className="file-info">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{formatBytes(selectedFile.size)}</span>
              </div>
              <button 
                type="button" 
                onClick={handleClearFile}
                aria-label="Clear selected file"
                disabled={isImporting}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {isImporting && renderProgressBar('Importing...')}

        <button
          type="button"
          onClick={handleImportClick}
          disabled={!selectedFile || isImporting || isExporting}
          className="import-button"
        >
          Import
        </button>

        {renderImportResult()}
      </section>

      {/* Export Section */}
      <section 
        data-testid="export-section"
        aria-labelledby="export-heading"
        role="region"
        aria-label="Export data section"
      >
        <h2 id="export-heading">Export Data</h2>
        
        <div className="export-options">
          <label htmlFor="export-format">Export Format:</label>
          <select
            id="export-format"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv' | 'xml' | 'yaml')}
            disabled={isExporting}
            aria-label="Select export format"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xml">XML</option>
            <option value="yaml">YAML</option>
          </select>
        </div>

        {isExporting && renderProgressBar('Exporting...')}

        <button
          type="button"
          onClick={handleExportClick}
          disabled={isImporting || isExporting}
          className="export-button"
        >
          Export
        </button>

        {exportedFilename && (
          <div className="export-result">
            <span>Exported as: {exportedFilename}</span>
          </div>
        )}
      </section>

      {/* Error Display */}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {/* Confirmation Dialog */}
      {renderConfirmDialog()}
    </div>
  );
};

ImportExport.displayName = 'ImportExport';