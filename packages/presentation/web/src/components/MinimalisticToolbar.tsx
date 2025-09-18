import React, { useCallback, useRef, useState } from 'react';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MinimalisticToolbarProps {
  className?: string;
  onImportSuccess?: () => Promise<void>;
}

export const MinimalisticToolbar: React.FC<MinimalisticToolbarProps> = ({
  className: _className,
  onImportSuccess,
}) => {
  const { exportDataUseCase, importDataUseCase } = useApplicationContext();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export functionality
  const handleExport = useCallback(async () => {
    if (!exportDataUseCase) return;

    setIsExporting(true);

    try {
      const result = await exportDataUseCase.execute({
        format: 'json',
        includeMetadata: true,
      });

      if (result.isOk()) {
        const { exportData } = result.unwrap();
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `misc-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [exportDataUseCase]);

  // Import functionality
  const handleImport = useCallback(
    async (file: File) => {
      if (!importDataUseCase) return;

      setIsImporting(true);

      try {
        const fileContent = await file.text();
        const parsedData = JSON.parse(fileContent);

        const result = await importDataUseCase.execute(parsedData);

        if (result.isOk()) {
          const importResult = result.unwrap();
          if (importResult.success && onImportSuccess) {
            await onImportSuccess();
          }
        }
      } catch (error) {
        console.error('Import failed:', error);
      } finally {
        setIsImporting(false);
      }
    },
    [importDataUseCase, onImportSuccess]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleImport(file);
      }
    },
    [handleImport]
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded-none hover:bg-muted transition-colors"
            type="button"
            title="Menu"
            aria-label="Menu"
          >
            <Menu size={16} className="text-gray-900 hover:text-gray-700" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleExport}
            disabled={isExporting || !exportDataUseCase}
          >
            Export
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || !importDataUseCase}
          >
            Import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
};
