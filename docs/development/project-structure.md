# Project Structure

Структура монорепозитория для MISC системы на основе Clean Architecture.

## Общая структура

```
misc/
├── packages/                    # Пакеты монорепозитория
│   ├── domain/                  # Доменный слой (ядро)
│   ├── application/             # Прикладной слой (use cases)
│   ├── infrastructure/          # Инфраструктурный слой
│   │   └── localStorage/        # Реализация через localStorage
│   ├── presentation/            # Презентационный слой
│   │   ├── web/                # Web приложение (React)
│   │   └── cli/                # CLI приложение (Ink)
│   └── shared/                  # Общие утилиты и типы
├── docs/                        # Документация
├── scripts/                     # Скрипты сборки и деплоя
└── config/                      # Конфигурационные файлы
```

## Детальная структура пакетов

### packages/domain/

```
domain/
├── src/
│   ├── entities/
│   │   ├── Record.ts
│   │   ├── Tag.ts
│   │   └── index.ts
│   ├── value-objects/
│   │   ├── RecordId.ts
│   │   ├── TagId.ts
│   │   ├── RecordContent.ts
│   │   ├── SearchQuery.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── TagNormalizer.ts
│   │   ├── TagParser.ts
│   │   ├── TagValidator.ts
│   │   ├── RecordMatcher.ts
│   │   ├── RecordDuplicateChecker.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── DomainError.ts
│   │   ├── InvalidRecordContentError.ts
│   │   ├── InvalidTagError.ts
│   │   ├── DuplicateRecordError.ts
│   │   ├── TagLimitExceededError.ts
│   │   └── index.ts
│   ├── factories/
│   │   ├── RecordFactory.ts
│   │   ├── TagFactory.ts
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── entities/
│   │   ├── Record.test.ts
│   │   └── Tag.test.ts
│   ├── value-objects/
│   │   ├── RecordId.test.ts
│   │   ├── TagId.test.ts
│   │   ├── RecordContent.test.ts
│   │   └── SearchQuery.test.ts
│   ├── services/
│   │   ├── TagNormalizer.test.ts
│   │   ├── TagParser.test.ts
│   │   ├── TagValidator.test.ts
│   │   ├── RecordMatcher.test.ts
│   │   └── RecordDuplicateChecker.test.ts
│   └── test-utils/
│       ├── builders.ts
│       └── fixtures.ts
├── package.json
├── tsconfig.json
└── README.md
```

### packages/application/

```
application/
├── src/
│   ├── use-cases/
│   │   ├── CreateRecord/
│   │   │   ├── CreateRecordUseCase.ts
│   │   │   ├── CreateRecordInput.ts
│   │   │   └── CreateRecordUseCase.test.ts
│   │   ├── SearchRecords/
│   │   │   ├── SearchRecordsUseCase.ts
│   │   │   ├── SearchRecordsInput.ts
│   │   │   └── SearchRecordsUseCase.test.ts
│   │   ├── UpdateRecord/
│   │   │   ├── UpdateRecordUseCase.ts
│   │   │   ├── UpdateRecordInput.ts
│   │   │   └── UpdateRecordUseCase.test.ts
│   │   ├── DeleteRecord/
│   │   │   ├── DeleteRecordUseCase.ts
│   │   │   ├── DeleteRecordInput.ts
│   │   │   └── DeleteRecordUseCase.test.ts
│   │   ├── GetTagSuggestions/
│   │   │   ├── GetTagSuggestionsUseCase.ts
│   │   │   ├── GetTagSuggestionsInput.ts
│   │   │   └── GetTagSuggestionsUseCase.test.ts
│   │   ├── ExportData/
│   │   │   ├── ExportDataUseCase.ts
│   │   │   ├── ExportDataInput.ts
│   │   │   └── ExportDataUseCase.test.ts
│   │   ├── ImportData/
│   │   │   ├── ImportDataUseCase.ts
│   │   │   ├── ImportDataInput.ts
│   │   │   └── ImportDataUseCase.test.ts
│   │   └── index.ts
│   ├── ports/
│   │   ├── RecordRepository.ts
│   │   ├── TagRepository.ts
│   │   ├── UnitOfWork.ts
│   │   └── index.ts
│   ├── dto/
│   │   ├── RecordDTO.ts
│   │   ├── SearchResultDTO.ts
│   │   ├── TagCloudItemDTO.ts
│   │   ├── ExportDTO.ts
│   │   ├── ImportResultDTO.ts
│   │   ├── ValidationResultDTO.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── SearchModeDetector.ts
│   │   ├── TagCloudBuilder.ts
│   │   ├── ImportValidator.ts
│   │   ├── ExportFormatter.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── ApplicationError.ts
│   │   ├── RecordNotFoundError.ts
│   │   ├── TagNotFoundError.ts
│   │   ├── ImportError.ts
│   │   ├── ExportError.ts
│   │   ├── StorageQuotaExceededError.ts
│   │   └── index.ts
│   ├── config/
│   │   ├── ApplicationConfig.ts
│   │   └── defaultConfig.ts
│   └── container/
│       ├── ApplicationContainer.ts
│       └── ApplicationContainerFactory.ts
├── tests/
│   ├── use-cases/
│   │   └── ...test files
│   ├── services/
│   │   └── ...test files
│   └── test-utils/
│       ├── mocks.ts
│       └── helpers.ts
├── package.json
├── tsconfig.json
└── README.md
```

### packages/infrastructure/localStorage/

```
localStorage/
├── src/
│   ├── repositories/
│   │   ├── LocalStorageRecordRepository.ts
│   │   ├── LocalStorageTagRepository.ts
│   │   └── index.ts
│   ├── unit-of-work/
│   │   ├── LocalStorageUnitOfWork.ts
│   │   └── LocalStorageUnitOfWorkFactory.ts
│   ├── storage/
│   │   ├── StorageSchema.ts
│   │   ├── StorageManager.ts
│   │   ├── IndexManager.ts
│   │   └── MigrationManager.ts
│   ├── mappers/
│   │   ├── RecordMapper.ts
│   │   ├── TagMapper.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── StorageError.ts
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── repositories/
│   │   ├── LocalStorageRecordRepository.test.ts
│   │   └── LocalStorageTagRepository.test.ts
│   ├── storage/
│   │   ├── StorageManager.test.ts
│   │   └── IndexManager.test.ts
│   └── integration/
│       ├── persistence.test.ts
│       └── migration.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### packages/presentation/web/

```
web/
├── src/
│   ├── components/
│   │   ├── SearchInput/
│   │   │   ├── SearchInput.tsx
│   │   │   ├── SearchInput.test.tsx
│   │   │   └── SearchInput.module.css
│   │   ├── RecordList/
│   │   │   ├── RecordList.tsx
│   │   │   ├── RecordItem.tsx
│   │   │   ├── RecordList.test.tsx
│   │   │   └── RecordList.module.css
│   │   ├── TagCloud/
│   │   │   ├── TagCloud.tsx
│   │   │   ├── TagCloudItem.tsx
│   │   │   ├── TagCloud.test.tsx
│   │   │   └── TagCloud.module.css
│   │   ├── AutoComplete/
│   │   │   ├── AutoComplete.tsx
│   │   │   ├── AutoComplete.test.tsx
│   │   │   └── AutoComplete.module.css
│   │   ├── LoadingIndicator/
│   │   │   ├── LoadingIndicator.tsx
│   │   │   └── LoadingIndicator.module.css
│   │   ├── ImportExport/
│   │   │   ├── ImportExport.tsx
│   │   │   ├── ImportDialog.tsx
│   │   │   ├── ExportButton.tsx
│   │   │   └── ImportExport.test.tsx
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Layout.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useLocalStorage.ts
│   │   └── useApplicationContainer.ts
│   ├── contexts/
│   │   ├── ApplicationContext.tsx
│   │   ├── ConfigContext.tsx
│   │   └── UIStateContext.tsx
│   ├── pages/
│   │   ├── MainPage.tsx
│   │   └── SettingsPage.tsx
│   ├── presenters/
│   │   ├── SearchResultPresenter.ts
│   │   ├── TagCloudPresenter.ts
│   │   └── ImportExportPresenter.ts
│   ├── utils/
│   │   ├── keyboard.ts
│   │   ├── formatting.ts
│   │   └── validation.ts
│   ├── styles/
│   │   ├── variables.css
│   │   ├── global.css
│   │   └── theme.css
│   ├── App.tsx
│   ├── index.tsx
│   └── setupTests.ts
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── favicon.ico
├── tests/
│   ├── e2e/
│   │   ├── user-journey.test.ts
│   │   └── data-integrity.test.ts
│   └── integration/
│       └── app.test.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### packages/presentation/cli/

```
cli/
├── src/
│   ├── commands/
│   │   ├── add.ts
│   │   ├── search.ts
│   │   ├── update.ts
│   │   ├── delete.ts
│   │   ├── export.ts
│   │   ├── import.ts
│   │   └── index.ts
│   ├── components/
│   │   ├── RecordList.tsx
│   │   ├── TagCloud.tsx
│   │   ├── SearchBox.tsx
│   │   └── StatusBar.tsx
│   ├── utils/
│   │   ├── formatting.ts
│   │   └── input.ts
│   ├── index.ts
│   └── cli.tsx
├── tests/
│   ├── commands/
│   │   └── ...test files
│   └── integration/
│       └── cli.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### packages/shared/

```
shared/
├── src/
│   ├── types/
│   │   ├── Result.ts
│   │   ├── Specification.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── uuid.ts
│   │   ├── date.ts
│   │   ├── string.ts
│   │   └── index.ts
│   ├── constants/
│   │   ├── limits.ts
│   │   ├── defaults.ts
│   │   └── index.ts
│   └── index.ts
├── tests/
│   └── utils/
│       └── ...test files
├── package.json
├── tsconfig.json
└── README.md
```

## Корневые файлы

### Корневая директория

```
misc/
├── .github/
│   └── workflows/
│       ├── ci.yml           # CI pipeline
│       └── release.yml      # Release automation
├── docs/
│   ├── architecture.md      # Архитектурная документация
│   ├── prd.md              # Product Requirements
│   ├── api.md              # API документация
│   └── contributing.md     # Руководство для контрибьюторов
├── scripts/
│   ├── build.js            # Сборка всех пакетов
│   ├── test.js             # Запуск всех тестов
│   ├── lint.js             # Линтинг
│   └── release.js          # Релиз
├── config/
│   ├── jest.config.base.js # Базовая конфигурация Jest
│   └── tsconfig.base.json  # Базовая конфигурация TypeScript
├── package.json             # Корневой package.json для workspaces
├── yarn.lock               # Lock файл Yarn
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── lerna.json              # Конфигурация Lerna (опционально)
└── README.md
```

## Конфигурационные файлы

### Корневой package.json

```json
{
  "name": "misc",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages/infrastructure/*",
    "packages/presentation/*"
  ],
  "scripts": {
    "build": "node scripts/build.js",
    "test": "node scripts/test.js",
    "test:domain": "yarn workspace @misc/domain test",
    "test:app": "yarn workspace @misc/application test",
    "test:coverage": "jest --coverage --collectCoverageFrom='packages/*/src/**/*.ts'",
    "lint": "eslint packages/*/src --ext .ts,.tsx",
    "format": "prettier --write 'packages/*/src/**/*.{ts,tsx,css}'",
    "clean": "rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo",
    "dev:web": "yarn workspace @misc/web dev",
    "dev:cli": "yarn workspace @misc/cli dev"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

### packages/domain/package.json (пример)

```json
{
  "name": "@misc/domain",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "@misc/shared": "workspace:*",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

### Базовый tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Соглашения и правила

### Именование

- **Пакеты**: `@misc/package-name`
- **Файлы**: PascalCase для классов/интерфейсов, camelCase для функций
- **Тесты**: `*.test.ts` или `*.spec.ts`
- **Стили**: CSS Modules с `*.module.css`

### Зависимости между пакетами

```
shared → никого
   ↑
domain → shared
   ↑
application → domain, shared
   ↑
infrastructure → domain, application, shared
   ↑
presentation → application, shared
```

### Структура компонента React

```
ComponentName/
├── ComponentName.tsx        # Компонент
├── ComponentName.test.tsx   # Тесты
├── ComponentName.module.css # Стили
├── ComponentName.stories.tsx # Storybook (опционально)
└── index.ts                 # Экспорт
```

### Правила импортов

- Абсолютные импорты внутри пакета: `@/entities/Record`
- Импорты между пакетами: `@misc/domain`
- Группировка импортов: внешние → пакеты misc → локальные
