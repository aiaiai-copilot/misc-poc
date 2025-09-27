import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import { RecordsList, RecordsListRef } from './RecordsList';
import { useApplicationContext } from '../contexts/ApplicationContext';
import { Record } from '../types/Record';
import { toast } from 'sonner';

interface UpdatedRecord {
  id: string;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface DeleteResponse {
  deletedRecordId: string;
  deletedOrphanedTags: string[];
}

interface RecordsListIntegratedProps {
  records: Record[];
  onEdit: (record: Record) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
  onNavigateUp?: () => void;
  onRecordUpdated?: (record: UpdatedRecord) => void;
  onRecordDeleted?: (deleteResponse: DeleteResponse) => void;
}

export interface RecordsListIntegratedRef extends RecordsListRef {
  updateRecord: (id: string, content: string) => Promise<void>;
}

export const RecordsListIntegrated = forwardRef<
  RecordsListIntegratedRef,
  RecordsListIntegratedProps
>(
  (
    {
      records,
      onEdit,
      onDelete,
      searchQuery,
      onNavigateUp,
      onRecordUpdated,
      onRecordDeleted,
      ...props
    },
    ref
  ) => {
    const { updateRecordUseCase, deleteRecordUseCase } =
      useApplicationContext();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const recordsListRef = useRef<RecordsListRef>(null);

    const updateRecord = useCallback(
      async (id: string, content: string): Promise<void> => {
        if (isUpdating || isDeleting) {
          return; // Prevent concurrent operations
        }

        if (!updateRecordUseCase) {
          toast.error('Update feature not available');
          return;
        }

        setIsUpdating(true);

        try {
          const result = await updateRecordUseCase.execute({ id, content });

          if (result.isOk()) {
            const response = result.unwrap();
            toast.success('Record updated successfully');
            onRecordUpdated?.(response.record);
          } else {
            const error = result.unwrapErr();
            toast.error(`Failed to update record: ${error.message}`);
          }
        } catch (error) {
          console.error('Update error:', error);
          toast.error('An unexpected error occurred while updating record');
        } finally {
          setIsUpdating(false);
        }
      },
      [updateRecordUseCase, isUpdating, isDeleting, onRecordUpdated]
    );

    const handleDelete = useCallback(
      async (id: string): Promise<void> => {
        if (isUpdating || isDeleting) {
          return; // Prevent concurrent operations
        }

        if (!deleteRecordUseCase) {
          toast.error('Delete feature not available');
          return;
        }

        setIsDeleting(true);

        try {
          const result = await deleteRecordUseCase.execute({ id });

          if (result.isOk()) {
            const response = result.unwrap();
            toast.success('Record deleted successfully');
            onRecordDeleted?.(response);
            onDelete(id); // Call original callback after successful deletion
          } else {
            const error = result.unwrapErr();
            toast.error(`Failed to delete record: ${error.message}`);
          }
        } catch (error) {
          console.error('Delete error:', error);
          toast.error('An unexpected error occurred while deleting record');
        } finally {
          setIsDeleting(false);
        }
      },
      [deleteRecordUseCase, isUpdating, isDeleting, onRecordDeleted, onDelete]
    );

    useImperativeHandle(
      ref,
      (): RecordsListIntegratedRef => ({
        focusFirst: (): void => {
          recordsListRef.current?.focusFirst();
        },
        updateRecord,
      })
    );

    // Show loading overlay when performing operations
    const showLoadingOverlay = isUpdating || isDeleting;
    const loadingMessage = isUpdating
      ? 'Updating record...'
      : isDeleting
        ? 'Deleting record...'
        : '';

    return (
      <div data-testid="records-list-integrated" className="relative">
        <RecordsList
          ref={recordsListRef}
          records={records}
          onEdit={onEdit}
          onDelete={handleDelete}
          searchQuery={searchQuery}
          onNavigateUp={onNavigateUp}
          {...props}
        />

        {showLoadingOverlay && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded">
            <div className="bg-background border rounded-lg px-4 py-2 shadow-lg">
              <span className="text-sm text-muted-foreground">
                {loadingMessage}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

RecordsListIntegrated.displayName = 'RecordsListIntegrated';
