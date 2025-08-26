# MISC - Архитектурная спецификация (v5)

## 1. Обзор архитектуры

### 1.1 Принципы

- **Clean Architecture**: Независимость бизнес-логики от деталей реализации
- **Dependency Inversion**: Зависимости направлены внутрь (к домену)
- **Ports & Adapters**: Изоляция внешних систем через адаптеры
- **Shared Nothing**: Слои не делят состояние, только контракты

### 1.2 Слои и их ответственность

| Слой | Ответственность | Зависит от |
|------|-----------------|------------|
| Presentation | UI, обработка пользовательского ввода | Application |
| Application | Orchestration, use cases | Domain |
| Domain | Бизнес-логика, правила | Ничего |
| Infrastructure | Хранение, внешние сервисы | Domain (через интерфейсы) |

## 2. Domain Layer

### 2.1 Сущности (Entities)

#### Record

**Описание**: Запись - основная сущность системы, представляет сохранённую пользователем информацию.

**Поля:**

- `id`: RecordId - уникальный идентификатор записи
- `content`: RecordContent - содержимое записи как ввёл пользователь
- `tagIds`: TagId[] - упорядоченный массив идентификаторов тегов
- `createdAt`: Date - дата создания
- `updatedAt`: Date - дата последнего обновления

**Поведение:**

- `getTagIds()`: TagId[] - возвращает идентификаторы тегов в порядке их появления
- `equals(other: Record)`: boolean - сравнение по ID
- `hasSameTagSet(other: Record)`: boolean - проверка на одинаковый набор тегов

**Инварианты:**

- ID неизменен после создания
- Content не может быть пустым
- Content должен содержать хотя бы один валидный тег
- Порядок tagIds соответствует порядку тегов в content

#### Tag

**Описание**: Тег как сущность - уникальный концепт, объединяющий различные написания одного тега.

**Поля:**

- `id`: TagId - уникальный идентификатор тега
- `normalizedValue`: string - каноническеое(умолчательное) визуальное представление тега

**Поведение:**

- `equals(other: Tag)`: boolean - сравнение по ID
- `matches(normalizedValue: string)`: boolean - проверка совпадения по нормализованному значению

**Инварианты:**

- ID неизменен после создания
- normalizedValue уникален в системе
- normalizedValue не может быть изменён после создания (для изменения создаётся новый тег)

### 2.2 Value Objects

#### RecordId

**Описание**: Идентификатор записи.

**Поля:**

- `value`: UUID

**Поведение:**

- `toString()`: string
- `equals(other: RecordId)`: boolean

#### TagId

**Описание**: Идентификатор тега.

**Поля:**

- `value`: UUID

**Поведение:**

- `toString()`: string
- `equals(other: TagId)`: boolean

#### RecordContent

**Описание**: Содержимое записи - оригинальная строка тегов, введённая пользователем.

**Поля:**

- `value`: string - например, "ToDo встреча Петров завтра 15:00"

**Поведение:**

- `parseTokens()`: string[] - разбивает на токены по пробелам
- `isEmpty()`: boolean
- `toString()`: string

**Правила:**

- Не может быть пустой
- Сохраняет оригинальное написание и порядок тегов
- Должна содержать хотя бы один валидный токен после парсинга

#### SearchQuery

**Описание**: Поисковый запрос пользователя.

**Поля:**

- `value`: string - исходная строка запроса
- `normalizedTokens`: string[] - нормализованные токены для поиска

**Поведение:**

- `getNormalizedTokens()`: string[]
- `isEmpty()`: boolean

### 2.3 Domain Services

#### TagNormalizer

**Описание**: Сервис нормализации тегов согласно конфигурации.

**Методы:**

- `normalize(value: string)`: string

**Правила нормализации:**

- По умолчанию: приведение к нижнему регистру
- Опционально: удаление диакритики
- Опционально: транслитерация

#### TagParser

**Описание**: Сервис парсинга content в теги.

**Методы:**

- `parse(content: RecordContent): ParsedTag[]`

**ParsedTag:**

```typescript
interface ParsedTag {
  originalValue: string  // как написано в content
  normalizedValue: string  // для поиска тега
  position: number  // позиция в content (0, 1, 2...)
}
```

#### RecordMatcher

**Описание**: Сервис проверки соответствия записи поисковому запросу.

**Методы:**

- `matches(record: Record, query: SearchQuery, tags: Map<TagId, Tag>)`: boolean

**Логика:**

- Все токены из запроса должны присутствовать в записи (AND логика)
- Сравнение по нормализованным значениям

#### RecordUniquenessChecker

**Описание**: Сервис проверки уникальности записи.

**Методы:**

- `isDuplicate(tagIds: TagId[], existingRecords: Record[])`: boolean
- `findDuplicate(tagIds: TagId[], existingRecords: Record[])`: Record | null

**Логика:**

- Записи считаются дубликатами, если имеют одинаковый набор тегов (tagIds)
- Порядок тегов не важен для определения дубликата

#### TagRenameService (для будущей реализации)

**Описание**: Сервис переименования тегов.

**Методы:**

- `canRename(oldTag: Tag, newNormalizedValue: string, existingTags: Tag[])`: boolean
- `prepareRenameOperations(tag: Tag, affectedRecords: Record[])`: RenameOperation[]

### 2.4 Domain Events

| Событие | Когда возникает | Данные |
|---------|-----------------|--------|
| RecordCreated | После создания записи | recordId, content, tagIds, createdAt |
| RecordUpdated | После обновления записи | recordId, oldContent, newContent, oldTagIds, newTagIds, updatedAt |
| RecordDeleted | После удаления записи | recordId, deletedAt |
| TagCreated | После создания нового тега | tagId, normalizedValue, createdAt |
| TagRenamed (future) | После переименования тега | tagId, oldValue, newValue, affectedRecordIds |

### 2.5 Спецификации

#### TokenSpecification

**Описание**: Проверка валидности токена (будущего тега).

**Методы:**

- `isSatisfiedBy(value: string)`: boolean

**Правила:**

- Длина от 1 до 100 символов
- Не содержит запрещённых символов: `{}[]:,"\`
- Не содержит пробелов

## 3. Application Layer

### 3.1 Use Cases

| Use Case | Вход | Выход | Логика |
|----------|------|-------|---------|
| CreateRecord | content: string | RecordDTO | Парсинг content → Нормализация → Поиск/создание тегов → Проверка уникальности → Создание Record → Сохранение → События |
| SearchRecords | query: string | SearchResultDTO | Парсинг запроса → Поиск тегов → Поиск записей → Определение режима отображения |
| UpdateRecord | id: string, content: string | RecordDTO | Поиск записи → Парсинг нового content → Поиск/создание тегов → Проверка уникальности → Обновление → События |
| DeleteRecord | id: string | void | Поиск записи → Удаление → Очистка неиспользуемых тегов → События |
| GetTagSuggestions | partial: string | string[] | Получение всех тегов → Фильтрация по префиксу → Возврат нормализованных значений |
| ExportData | format: string | ExportDTO | Получение всех записей и тегов → Форматирование |
| ImportData | data: string, format: string | ImportResultDTO | Парсинг → Валидация → Создание тегов → Импорт записей |

### 3.2 Порты (интерфейсы для Infrastructure)

```typescript
interface RecordRepository {
  save(record: Record): Promise<void>
  findById(id: RecordId): Promise<Record | null>
  findByTagIds(tagIds: TagId[]): Promise<Record[]>
  findAll(): Promise<Record[]>
  delete(id: RecordId): Promise<void>
  batchUpdate(records: Record[]): Promise<void>
}

interface TagRepository {
  save(tag: Tag): Promise<void>
  findById(id: TagId): Promise<Tag | null>
  findByNormalizedValue(value: string): Promise<Tag | null>
  findByIds(ids: TagId[]): Promise<Map<TagId, Tag>>
  findAll(): Promise<Tag[]>
  getUsageCount(tagId: TagId): Promise<number>
  deleteUnused(): Promise<number>
}

interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}

interface UnitOfWork {
  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}
```

### 3.3 DTO (Data Transfer Objects)

```typescript
interface RecordDTO {
  id: string
  content: string  // оригинальное написание
  createdAt: string
  updatedAt: string
}

interface SearchResultDTO {
  mode: 'list' | 'cloud'
  records?: RecordDTO[]  // для режима list
  tagCloud?: TagCloudItemDTO[]  // для режима cloud
  total: number
}

interface TagCloudItemDTO {
  normalizedValue: string  // что показываем пользователю
  count: number  // частота использования
  size: number  // размер в облаке (1-5)
}

interface ExportDTO {
  version: string
  records: ExportedRecord[]
  metadata: {
    exportedAt: string
    recordCount: number
    tagCount: number
  }
}

interface ExportedRecord {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

interface ImportResultDTO {
  imported: number
  skipped: number
  errors: string[]
}
```

## 4. Infrastructure Layer

### 4.1 Схема хранения (Прототип - localStorage)

```json
{
  "version": "2.0",
  "tags": {
    "uuid-tag-1": {
      "id": "uuid-tag-1",
      "normalizedValue": "todo"
    },
    "uuid-tag-2": {
      "id": "uuid-tag-2",
      "normalizedValue": "встреча"
    }
  },
  "records": {
    "uuid-record-1": {
      "id": "uuid-record-1",
      "content": "ToDo встреча Петров 15:00",
      "tagIds": ["uuid-tag-1", "uuid-tag-2", "uuid-tag-3", "uuid-tag-4"],
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  },
  "indexes": {
    "normalizedToTagId": {
      "todo": "uuid-tag-1",
      "встреча": "uuid-tag-2",
      "петров": "uuid-tag-3",
      "15:00": "uuid-tag-4"
    },
    "tagToRecords": {
      "uuid-tag-1": ["uuid-record-1"],
      "uuid-tag-2": ["uuid-record-1"],
      "uuid-tag-3": ["uuid-record-1"],
      "uuid-tag-4": ["uuid-record-1"]
    }
  }
}
```

### 4.2 Схема БД (MVP - PostgreSQL)

```sql
-- Таблица тегов
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  normalized_value VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tags_normalized ON tags(normalized_value);

-- Таблица записей
CREATE TABLE records (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Связь записей и тегов с сохранением порядка
CREATE TABLE record_tags (
  record_id UUID REFERENCES records(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (record_id, tag_id)
);

CREATE INDEX idx_record_tags_tag ON record_tags(tag_id);
CREATE INDEX idx_record_tags_record_position ON record_tags(record_id, position);

-- Представление для статистики тегов
CREATE VIEW tag_stats AS
SELECT 
  t.id,
  t.normalized_value,
  COUNT(rt.record_id) as usage_count
FROM tags t
LEFT JOIN record_tags rt ON t.id = rt.tag_id
GROUP BY t.id, t.normalized_value;
```

## 5. Presentation Layer

### 5.1 Компоненты Web

| Компонент | Ответственность | Props |
|-----------|-----------------|--------|
| SearchInput | Универсальное поле ввода/поиска | value, onChange, onSubmit, isSearching |
| RecordList | Отображение списка записей | records, onEdit, onDelete |
| TagCloud | Облако тегов с размерами | tags, onTagClick |
| AutoComplete | Подсказки при вводе | suggestions, onSelect |
| SearchIndicator | Индикатор поиска | isSearching |
| RecordEditor | Режим редактирования записи | record, onSave, onCancel |

### 5.2 CLI команды

```bash
misc add "content"       # Создать запись
misc search "query"      # Найти записи  
misc edit <id>          # Редактировать
misc delete <id>        # Удалить
misc export             # Экспорт данных
misc import <file>      # Импорт данных
misc stats              # Статистика тегов
misc cloud "query"      # Показать облако тегов для запроса
```

## 6. Shared UI Logic

### 6.1 Презентеры

```typescript
interface RecordPresenter {
  // Форматирование записей для отображения
  format(record: RecordDTO): string
  formatList(records: RecordDTO[]): string[]
}

interface TagCloudPresenter {
  // Подготовка облака тегов
  prepareCloud(tags: TagWithCount[]): TagCloudItemDTO[]
  // Логика:
  // - Сортировка по частоте (убывание)  
  // - Линейный расчёт размера: minSize + (freq/maxFreq) * (maxSize - minSize)
  // - Размеры от 1 до 5
}

interface SearchResultPresenter {
  // Определение режима отображения
  determineMode(
    records: RecordDTO[], 
    containerHeight: number,
    recordHeight: number
  ): 'list' | 'cloud'
  // Логика:
  // - Если records.length * recordHeight > containerHeight → 'cloud'
  // - Иначе → 'list'
}

interface AutoCompletePresenter {
  // Формирование подсказок
  prepareSuggestions(
    input: string,
    tags: Tag[],
    limit: number = 10
  ): string[]
  // Возвращает нормализованные значения тегов
}

interface LoadingPresenter {
  // Управление индикаторами загрузки
  showSearchIndicator(isSearching: boolean): void
  showDebounceIndicator(isDebouncing: boolean): void
}
```

### 6.2 Состояния интерфейса

```typescript
enum UIState {
  Empty,           // Начальное состояние, пустое поле
  Typing,          // Пользователь вводит текст
  Debouncing,      // Ожидание окончания ввода
  Searching,       // Идёт поиск
  ShowingList,     // Отображение списка записей
  ShowingCloud,    // Отображение облака тегов
  NoResults,       // Ничего не найдено
  Creating,        // Режим создания записи
  Editing,         // Режим редактирования записи
  Error            // Состояние ошибки
}

interface UIStateData {
  state: UIState
  searchQuery?: string
  results?: SearchResultDTO
  editingRecord?: RecordDTO
  error?: string
}
```

## 7. Конфигурация

### 7.1 Параметры приложения

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| tags.maxLength | 100 | Максимальная длина тега |
| tags.caseSensitive | false | Учитывать регистр при поиске |
| tags.maxPerRecord | 50 | Максимум тегов в записи |
| normalization.removeAccents | false | Удалять диакритические знаки |
| normalization.transliterate | false | Транслитерация кириллицы |
| search.liveSearch | true | Поиск при вводе |
| search.debounceMs | 300 | Задержка поиска |
| display.recordHeight | 60 | Примерная высота записи в пикселях |
| display.minCloudTags | 10 | Минимум тегов для отображения облака |
| storage.maxSizeMB | 5 | Лимит для localStorage |
| storage.cleanupThreshold | 0.9 | Порог для очистки (90% от лимита) |

## 8. Миграция Прототип → MVP

### 8.1 Этапы

1. **Экспорт**: Use case ExportData создаёт JSON со всеми записями
2. **Deploy Backend**: Развёртывание API сервера и PostgreSQL
3. **Миграция структуры**: Конвертация localStorage формата в БД
4. **Импорт**: Use case ImportData загружает данные в PostgreSQL
5. **Переключение**: Frontend начинает работать через REST API

### 8.2 Что меняется

| Компонент | Прототип | MVP |
|-----------|----------|-----|
| Tags | В localStorage как объекты | Таблица tags в PostgreSQL |
| Records | localStorage с tagIds | Таблица records + record_tags |
| Search | По индексу в памяти | SQL JOIN запросы |
| Repository | LocalStorageAdapter | PostgreSQLAdapter |
| Use Cases | Выполняются в браузере | Выполняются на сервере |
| Frontend | Прямой вызов use cases | HTTP API вызовы |

### 8.3 Сохранение обратной совместимости

- UUID тегов и записей сохраняются при миграции
- Структура DTO остаётся неизменной
- API use cases не меняется

## 9. Требования к производительности

| Операция | Целевое время | При объёме |
|----------|---------------|------------|
| Поиск | < 100мс | 10,000 записей, 50,000 тегов |
| Сохранение | < 50мс | - |
| Автодополнение | < 50мс | 10,000 уникальных тегов |
| Загрузка приложения | < 2с | 1,000 записей |
| Определение режима отображения | < 10мс | 100 записей |
| Рендер облака тегов | < 100мс | 500 тегов |
| Экспорт | < 5с | 10,000 записей |

## 10. Подготовка к будущим функциям

### 10.1 Переименование тегов

**Что подготовлено:**
- Tags как entities с UUID
- Метод batchUpdate в RecordRepository
- Событие TagRenamed
- Структура данных позволяет изменить normalized_value

**Что потребуется добавить:**
- UI для переименования
- Use case RenameTag
- Обновление content в затронутых записях

### 10.2 Слияние тегов

**Что подготовлено:**
- Уникальность на уровне набора tagIds
- Метод deleteUnused в TagRepository

**Что потребуется добавить:**
- Use case MergeTags
- UI для выбора тегов для слияния
- Логика переназначения tagIds

### 10.3 Теги-синонимы

**Что подготовлено:**
- Архитектура позволяет несколько normalized значений указывать на один tagId

**Что потребуется добавить:**
- Таблица tag_synonyms
- Расширение поиска для учёта синонимов

## 11. Критерии готовности архитектуры

- [ ] Tag инкапсулирует идентичность и нормализованное значение
- [ ] Record хранит content как единую строку с оригинальным написанием
- [ ] Record хранит упорядоченный массив tagIds
- [ ] Поиск работает по нормализованным значениям через Tag entities
- [ ] Автодополнение показывает нормализованные значения
- [ ] Режим отображения (список/облако) определяется автоматически
- [ ] Индикаторы загрузки отображаются при поиске
- [ ] Use cases оперируют доменными объектами, не знают о деталях хранения
- [ ] Замена localStorage на PostgreSQL требует изменения только в Infrastructure слое
- [ ] Web и CLI используют одни и те же use cases через разные презентационные слои
- [ ] Подготовлена база для переименования тегов без breaking changes