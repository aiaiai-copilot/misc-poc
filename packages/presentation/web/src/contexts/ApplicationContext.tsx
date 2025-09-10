import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  ApplicationContainer, 
  DependencyDescriptor, 
  ServiceLifetime,
  CreateRecordUseCase,
  SearchRecordsUseCase,
  UpdateRecordUseCase,
  DeleteRecordUseCase,
  GetTagSuggestionsUseCase,
  ExportDataUseCase,
  ImportDataUseCase
} from '@misc-poc/application'
import { 
  LocalStorageRecordRepository,
  LocalStorageTagRepository,
  LocalStorageUnitOfWork 
} from '@misc-poc/infrastructure-localstorage'

export interface ApplicationContextValue {
  createRecordUseCase: CreateRecordUseCase | null
  searchRecordsUseCase: SearchRecordsUseCase | null
  updateRecordUseCase: UpdateRecordUseCase | null
  deleteRecordUseCase: DeleteRecordUseCase | null
  getTagSuggestionsUseCase: GetTagSuggestionsUseCase | null
  exportDataUseCase: ExportDataUseCase | null
  importDataUseCase: ImportDataUseCase | null
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null)

export interface ApplicationContextProviderProps {
  children: ReactNode
}

export const ApplicationContextProvider: React.FC<ApplicationContextProviderProps> = ({ children }) => {
  const [contextValue, setContextValue] = useState<ApplicationContextValue>({
    createRecordUseCase: null,
    searchRecordsUseCase: null,
    updateRecordUseCase: null,
    deleteRecordUseCase: null,
    getTagSuggestionsUseCase: null,
    exportDataUseCase: null,
    importDataUseCase: null
  })

  useEffect(() => {
    const initializeContainer = (): void => {
      try {
        const container = new ApplicationContainer()

        // Register repositories
        container.register('recordRepository', new DependencyDescriptor(
          () => new LocalStorageRecordRepository(),
          ServiceLifetime.SINGLETON
        ))

        container.register('tagRepository', new DependencyDescriptor(
          () => new LocalStorageTagRepository(),
          ServiceLifetime.SINGLETON
        ))

        container.register('unitOfWork', new DependencyDescriptor(
          () => new LocalStorageUnitOfWork(),
          ServiceLifetime.SINGLETON
        ))

        // Register use cases
        container.register('createRecordUseCase', new DependencyDescriptor(
          (deps) => new CreateRecordUseCase(
            deps.recordRepository as LocalStorageRecordRepository,
            deps.tagRepository as LocalStorageTagRepository,
            deps.unitOfWork as LocalStorageUnitOfWork
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository', 'tagRepository', 'unitOfWork']
        ))

        container.register('searchRecordsUseCase', new DependencyDescriptor(
          (deps) => new SearchRecordsUseCase(
            deps.recordRepository as LocalStorageRecordRepository
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository']
        ))

        container.register('updateRecordUseCase', new DependencyDescriptor(
          (deps) => new UpdateRecordUseCase(
            deps.recordRepository as LocalStorageRecordRepository,
            deps.tagRepository as LocalStorageTagRepository,
            deps.unitOfWork as LocalStorageUnitOfWork
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository', 'tagRepository', 'unitOfWork']
        ))

        container.register('deleteRecordUseCase', new DependencyDescriptor(
          (deps) => new DeleteRecordUseCase(
            deps.recordRepository as LocalStorageRecordRepository,
            deps.tagRepository as LocalStorageTagRepository,
            deps.unitOfWork as LocalStorageUnitOfWork
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository', 'tagRepository', 'unitOfWork']
        ))

        container.register('getTagSuggestionsUseCase', new DependencyDescriptor(
          (deps) => new GetTagSuggestionsUseCase(
            deps.tagRepository as LocalStorageTagRepository
          ),
          ServiceLifetime.SINGLETON,
          ['tagRepository']
        ))

        container.register('exportDataUseCase', new DependencyDescriptor(
          (deps) => new ExportDataUseCase(
            deps.recordRepository as LocalStorageRecordRepository,
            deps.tagRepository as LocalStorageTagRepository
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository', 'tagRepository']
        ))

        container.register('importDataUseCase', new DependencyDescriptor(
          (deps) => new ImportDataUseCase(
            deps.recordRepository as LocalStorageRecordRepository,
            deps.tagRepository as LocalStorageTagRepository,
            deps.unitOfWork as LocalStorageUnitOfWork
          ),
          ServiceLifetime.SINGLETON,
          ['recordRepository', 'tagRepository', 'unitOfWork']
        ))

        // Resolve all use cases
        const createRecordResult = container.resolve<CreateRecordUseCase>('createRecordUseCase')
        const searchRecordsResult = container.resolve<SearchRecordsUseCase>('searchRecordsUseCase')
        const updateRecordResult = container.resolve<UpdateRecordUseCase>('updateRecordUseCase')
        const deleteRecordResult = container.resolve<DeleteRecordUseCase>('deleteRecordUseCase')
        const getTagSuggestionsResult = container.resolve<GetTagSuggestionsUseCase>('getTagSuggestionsUseCase')
        const exportDataResult = container.resolve<ExportDataUseCase>('exportDataUseCase')
        const importDataResult = container.resolve<ImportDataUseCase>('importDataUseCase')

        if (createRecordResult.isOk() && 
            searchRecordsResult.isOk() && 
            updateRecordResult.isOk() && 
            deleteRecordResult.isOk() && 
            getTagSuggestionsResult.isOk() && 
            exportDataResult.isOk() && 
            importDataResult.isOk()) {
          
          setContextValue({
            createRecordUseCase: createRecordResult.unwrap(),
            searchRecordsUseCase: searchRecordsResult.unwrap(),
            updateRecordUseCase: updateRecordResult.unwrap(),
            deleteRecordUseCase: deleteRecordResult.unwrap(),
            getTagSuggestionsUseCase: getTagSuggestionsResult.unwrap(),
            exportDataUseCase: exportDataResult.unwrap(),
            importDataUseCase: importDataResult.unwrap()
          })
        } else {
          console.error('Failed to resolve use cases from container')
        }

      } catch (error) {
        console.error('Error initializing ApplicationContainer:', error)
      }
    }

    initializeContainer()
  }, [])

  return (
    <ApplicationContext.Provider value={contextValue}>
      {children}
    </ApplicationContext.Provider>
  )
}

export const useApplicationContext = (): ApplicationContextValue => {
  const context = useContext(ApplicationContext)
  
  if (context === null) {
    throw new Error('useApplicationContext must be used within ApplicationContextProvider')
  }
  
  return context
}