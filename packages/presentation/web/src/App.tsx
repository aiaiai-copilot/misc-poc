import { useState } from 'react'
import { MiscInput } from './components/MiscInput'
import { RecordsList } from './components/RecordsList'
import { TagCloud } from './components/TagCloud'
import './App.css'

interface Record {
  id: string
  content: string
  tags: string[]
  createdAt: Date
}

function App() {
  const [records, setRecords] = useState<Record[]>([
    {
      id: '1',
      content: 'Sample record with some tags',
      tags: ['work', 'notes', 'important'],
      createdAt: new Date('2024-01-15')
    },
    {
      id: '2', 
      content: 'Another example record',
      tags: ['personal', 'ideas', 'draft'],
      createdAt: new Date('2024-01-16')
    }
  ])
  
  const [inputValue, setInputValue] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  
  const allTags = Array.from(new Set(records.flatMap(r => r.tags)))
  
  const handleSubmit = (tags: string[]) => {
    if (inputValue.trim() && tags.length > 0) {
      const newRecord: Record = {
        id: Math.random().toString(36).substr(2, 9),
        content: inputValue,
        tags: tags,
        createdAt: new Date()
      }
      setRecords([newRecord, ...records])
      setInputValue('')
    }
  }
  
  const filteredRecords = selectedTags.length > 0
    ? records.filter(record => 
        selectedTags.some(tag => record.tags.includes(tag))
      )
    : records

  return (
    <div className="app">
      <header className="app-header">
        <h1>Records App</h1>
        <p>Manage your records with tags</p>
      </header>
      
      <main className="app-main">
        <section className="input-section">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your record content..."
            className="content-input"
          />
          <MiscInput
            value=""
            onChange={() => {}}
            onSubmit={handleSubmit}
            onEscape={() => {}}
            allTags={allTags}
            placeholder="Add tags (space-separated)..."
            className="tag-input"
          />
        </section>
        
        <section className="tags-section">
          <h2>Filter by tags</h2>
          <TagCloud
            tags={allTags}
            selectedTags={selectedTags}
            onTagSelect={(tag) => {
              setSelectedTags(prev => 
                prev.includes(tag) 
                  ? prev.filter(t => t !== tag)
                  : [...prev, tag]
              )
            }}
          />
          {selectedTags.length > 0 && (
            <button 
              onClick={() => setSelectedTags([])}
              className="clear-filters"
            >
              Clear filters
            </button>
          )}
        </section>
        
        <section className="records-section">
          <h2>Records ({filteredRecords.length})</h2>
          <RecordsList 
            records={filteredRecords.map(r => ({
              ...r,
              createdAt: r.createdAt.toISOString()
            }))}
            selectedTags={selectedTags}
            onTagSelect={(tag) => {
              setSelectedTags(prev => 
                prev.includes(tag) 
                  ? prev.filter(t => t !== tag)
                  : [...prev, tag]
              )
            }}
          />
        </section>
      </main>
    </div>
  )
}

export default App