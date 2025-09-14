import React, { useState } from 'react';
import { useRecordsSync } from '../hooks/useRecordsSync';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface ComponentAProps {
  title: string;
}

const ComponentA: React.FC<ComponentAProps> = ({ title }) => {
  const { records, isLoading, error, createRecord, deleteRecord } = useRecordsSync();
  const [newTags, setNewTags] = useState('');

  const handleCreate = async (): Promise<void> => {
    if (newTags.trim()) {
      const tags = newTags.trim().split(/\s+/);
      const success = await createRecord(tags);
      if (success) {
        setNewTags('');
      }
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    await deleteRecord(id);
  };

  return (
    <Card className="p-4 m-2">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>

      <div className="mb-4">
        <div className="flex gap-2">
          <Input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Enter tags separated by spaces"
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={isLoading}>
            Create
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error.message}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Records ({records.length}):</h3>
        {isLoading && <div className="text-gray-500">Loading...</div>}
        {records.map((record) => (
          <div key={record.id} className="flex items-center justify-between p-2 border rounded">
            <span>{record.tags.join(' ')}</span>
            <Button
              onClick={() => handleDelete(record.id)}
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          </div>
        ))}
        {!isLoading && records.length === 0 && (
          <div className="text-gray-500">No records found</div>
        )}
      </div>
    </Card>
  );
};

const ComponentB: React.FC<ComponentAProps> = ({ title }) => {
  const { records, isLoading, error, updateRecord, refresh } = useRecordsSync();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState('');

  const handleEdit = (record: { id: string; tags: string[] }): void => {
    setEditingId(record.id);
    setEditTags(record.tags.join(' '));
  };

  const handleUpdate = async (): Promise<void> => {
    if (editingId && editTags.trim()) {
      const tags = editTags.trim().split(/\s+/);
      const success = await updateRecord(editingId, tags);
      if (success) {
        setEditingId(null);
        setEditTags('');
      }
    }
  };

  const handleCancel = (): void => {
    setEditingId(null);
    setEditTags('');
  };

  return (
    <Card className="p-4 m-2">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>

      <div className="mb-4">
        <Button onClick={refresh} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error.message}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Records for editing ({records.length}):</h3>
        {isLoading && <div className="text-gray-500">Loading...</div>}
        {records.map((record) => (
          <div key={record.id} className="p-2 border rounded">
            {editingId === record.id ? (
              <div className="flex gap-2">
                <Input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdate()}
                />
                <Button onClick={handleUpdate} size="sm">Save</Button>
                <Button onClick={handleCancel} variant="outline" size="sm">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span>{record.tags.join(' ')}</span>
                <Button onClick={() => handleEdit(record)} variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            )}
          </div>
        ))}
        {!isLoading && records.length === 0 && (
          <div className="text-gray-500">No records found</div>
        )}
      </div>
    </Card>
  );
};

export const RecordsSyncExample: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">
        Global State Synchronization Demo
      </h1>
      <p className="text-center mb-6 text-gray-600">
        These two components share the same state. Actions in one component
        automatically sync to the other component without prop drilling.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComponentA title="Component A (Create & Delete)" />
        <ComponentB title="Component B (Edit & Refresh)" />
      </div>
    </div>
  );
};