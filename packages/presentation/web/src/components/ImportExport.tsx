import React, { useState, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Label } from './ui/label'
import { useApplicationContext } from '../contexts/ApplicationContext'
import { cn } from '@/lib/utils'

interface ImportExportProps {
  className?: string
}

interface ImportValidation {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    code: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    field: string
    message: string
    type: string
    severity: 'warning'
  }>
}

export const ImportExport: React.FC<ImportExportProps> = ({ className }) => {
  const { exportDataUseCase, importDataUseCase } = useApplicationContext()

  // Export state
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'xml' | 'yaml'>('json')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importValidation, setImportValidation] = useState<ImportValidation | null>(null)
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export functionality
  const handleExport = useCallback(async () => {
    if (!exportDataUseCase) {
      setExportError('Export functionality not available')
      return
    }

    setIsExporting(true)
    setExportError(null)

    try {
      const result = await exportDataUseCase.execute({
        format: exportFormat,
        includeMetadata: true
      })

      if (result.isOk()) {
        const { exportData } = result.unwrap()

        // Create downloadable file
        const jsonString = JSON.stringify(exportData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        // Trigger download
        const link = document.createElement('a')
        link.href = url
        link.download = `misc-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Clean up
        URL.revokeObjectURL(url)
      } else {
        const error = result.unwrapErr()
        setExportError(error.message || 'Export failed')
      }
    } catch (error) {
      setExportError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }, [exportDataUseCase, exportFormat])

  // File validation
  const validateFile = useCallback(async (file: File) => {
    if (!importDataUseCase) {
      setImportError('Import functionality not available')
      return
    }

    setIsValidating(true)
    setImportError(null)
    setImportValidation(null)

    try {
      // Read file content
      const fileContent = await file.text()
      let parsedData: unknown

      try {
        parsedData = JSON.parse(fileContent)
      } catch {
        setImportError('Invalid JSON format')
        setIsValidating(false)
        return
      }

      // Validate with use case
      const validationResult = await importDataUseCase.validateOnly(parsedData)

      if (validationResult.isOk()) {
        const validation = validationResult.unwrap()
        setImportValidation({
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings
        })

        // Show warning dialog if there are warnings
        if (validation.warnings.length > 0) {
          setShowWarningDialog(true)
        }
      } else {
        const error = validationResult.unwrapErr()
        setImportError(error.message || 'Validation failed')
      }
    } catch (error) {
      setImportError(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsValidating(false)
    }
  }, [importDataUseCase])

  // File selection handler
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    validateFile(file)
  }, [validateFile])

  // File input change handler
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  // Drag and drop handlers
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)

    const file = event.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  // Import execution
  const handleImport = useCallback(async () => {
    if (!importDataUseCase || !selectedFile) {
      return
    }

    setIsImporting(true)
    setImportError(null)

    try {
      const fileContent = await selectedFile.text()
      const parsedData = JSON.parse(fileContent)

      const result = await importDataUseCase.execute(parsedData)

      if (result.isOk()) {
        const importResult = result.unwrap()
        if (importResult.success) {
          // Reset form on success
          setSelectedFile(null)
          setImportValidation(null)
          setShowWarningDialog(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          alert('Import completed successfully!')
        } else {
          setImportError('Import failed')
        }
      } else {
        const error = result.unwrapErr()
        setImportError(error.message || 'Import failed')
      }
    } catch (error) {
      setImportError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsImporting(false)
    }
  }, [importDataUseCase, selectedFile])

  // Cancel import
  const handleCancelImport = useCallback(() => {
    setShowWarningDialog(false)
    setSelectedFile(null)
    setImportValidation(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Confirm import with warnings
  const handleConfirmImport = useCallback(() => {
    setShowWarningDialog(false)
    handleImport()
  }, [handleImport])

  const canImport = selectedFile && importValidation?.isValid && !isImporting && !isValidating

  return (
    <div className={cn('space-y-6', className)}>
      {/* Export Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Export Data</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="export-format">Export Format</Label>
            <select
              id="export-format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
              className="w-full mt-1 p-2 border rounded-md"
              disabled={isExporting}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xml">XML</option>
              <option value="yaml">YAML</option>
            </select>
          </div>

          {exportError && (
            <div className="text-red-600 text-sm">{exportError}</div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting || !exportDataUseCase}
            className="w-full"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </Card>

      {/* Import Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Import Data</h3>

        <div className="space-y-4">
          {/* File Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragOver ? 'border-blue-500 bg-blue-50 drag-over' : 'border-gray-300',
              'hover:border-gray-400'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="space-y-2">
              <p className="text-gray-600">Drag and drop your file here, or</p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isValidating || isImporting}
              >
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.xml,.yaml"
                onChange={handleFileInputChange}
                className="hidden"
                aria-label="Select file for import"
              />
            </div>
          </div>

          {/* File Info */}
          {selectedFile && (
            <div className="text-sm text-gray-600">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}

          {/* Validation Status */}
          {isValidating && (
            <div className="text-blue-600 text-sm">Validating file...</div>
          )}

          {/* Validation Errors */}
          {importValidation && !importValidation.isValid && (
            <div className="space-y-2">
              <p className="text-red-600 font-medium">Validation Errors:</p>
              {importValidation.errors.map((error, index) => (
                <div key={index} className="text-red-600 text-sm">
                  {error.message}
                </div>
              ))}
            </div>
          )}

          {/* Import Error */}
          {importError && (
            <div className="text-red-600 text-sm">{importError}</div>
          )}

          <Button
            onClick={handleImport}
            disabled={!canImport}
            className="w-full"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </Card>

      {/* Warning Dialog */}
      {showWarningDialog && importValidation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold mb-4">Import Warning</h4>

            <div className="space-y-3 mb-6">
              {importValidation.warnings.map((warning, index) => (
                <div key={index} className="text-yellow-700 text-sm p-3 bg-yellow-50 rounded">
                  {warning.message}
                </div>
              ))}
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handleCancelImport}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                className="flex-1"
              >
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}