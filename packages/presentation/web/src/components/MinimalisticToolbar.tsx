import React, { useCallback, useRef, useState } from 'react'
import { useApplicationContext } from '../contexts/ApplicationContext'
import { cn } from '@/lib/utils'

interface MinimalisticToolbarProps {
  className?: string
  onImportSuccess?: () => Promise<void>
}

export const MinimalisticToolbar: React.FC<MinimalisticToolbarProps> = ({
  className,
  onImportSuccess
}) => {
  const { exportDataUseCase, importDataUseCase } = useApplicationContext()

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export functionality
  const handleExport = useCallback(async () => {
    if (!exportDataUseCase) return

    setIsExporting(true)

    try {
      const result = await exportDataUseCase.execute({
        format: 'json',
        includeMetadata: true
      })

      if (result.isOk()) {
        const { exportData } = result.unwrap()
        const jsonString = JSON.stringify(exportData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = `misc-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [exportDataUseCase])

  // Import functionality
  const handleImport = useCallback(async (file: File) => {
    if (!importDataUseCase) return

    setIsImporting(true)

    try {
      const fileContent = await file.text()
      const parsedData = JSON.parse(fileContent)

      const result = await importDataUseCase.execute(parsedData)

      if (result.isOk()) {
        const importResult = result.unwrap()
        if (importResult.success && onImportSuccess) {
          await onImportSuccess()
        }
      }
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }, [importDataUseCase, onImportSuccess])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImport(file)
    }
  }, [handleImport])

  return (
    <div className={cn('flex gap-1', className)}>
      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting || !exportDataUseCase}
        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Export data"
        aria-label="Export data"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {/* Import Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting || !importDataUseCase}
        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Import data"
        aria-label="Import data"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17,8 12,3 7,8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}