# MISC - Архитектурная спецификация (v5.2 - Обновленный импорт/экспорт)

## 1. Обзор архитектуры

### 1.1 Принципы
- **Clean Architecture**: Независимость бизнес-логики от деталей реализации
- **Dependency Inversion**: Зависимости направлены внутрь (к домену)
- **YAGNI для прототипа**: Не реализуем то, что не нужно сейчас
- **Подготовка к эволюции**: Структура данных готова к будущим изменениям

### 1.2 Слои и их ответственность

| Слой | Ответственность | Зависит от |
|------|-----------------|------------|
| Presentation | UI, обработка пользовательского ввода | Application |
| Application | Orchestration, use cases | Domain |
| Domain | Бизнес-логика, правила | Ничего |
| Infrastructure | Хранение | Domain (через интерфейсы) |

## 2. Domain Layer

### 2.1 Сущности (Entities)

#### Record
**Описание**: Запись - основная сущность системы, представляет сохранённую пользователем информацию.

**Поля:**
- `id`: RecordId - уникальный идентификатор записи
- `content`: RecordContent - содержимое записи как ввёл пользователь (хранит порядок тегов)
- `tagIds`: Set<TagId> - множество идентификаторов тегов (для быстрого поиска)
- `createdAt`: Date - дата создания
- `updatedAt`: Date - дата последнего обновления

**Поведение:**
- `hasTag(tagId: TagId)`: boolean - проверка наличия тега
- `hasSameTagSet(other: Record)`: boolean - проверка на одинаковый набор тегов
- `equals(other: Record)`: boolean - сравнение по ID

**Инварианты:**
- ID неизменен после создания
- Content не может быть пустым
- Content должен содержать хотя бы один валидный тег
- tagIds содержит все теги из content (синхронизация)

#### Tag
**Описание**: Тег как сущность - уникальный концепт в системе.

**Поля:**
- `id`: TagId - уникальный идентификатор тега
- `normalizedValue`: string - нормализованная форма для поиска и уникальности

**Поведение:**
- `equals(other: Tag)`: boolean - сравнение по ID

**Инварианты:**
- ID неизменен после создания
- normalizedValue уникален в системе

### 2.2 Value Objects

#### RecordId
**Описание**: Идентификатор записи.

**Поля:**
- `value`: string (UUID)

**Поведение:**
- `toString()`: string
- `equals(other: RecordId)`: boolean

#### TagId
**Описание**: Идентификатор тега.

**Поля:**
- `value`: string (UUID)

**Поведение:**
- `toString()`: string
- `equals(other: TagId)`: boolean

#### RecordContent
**Описание**: Содержимое записи - строка тегов как ввёл пользователь.

**Поля:**
- `value`: string - например, "ToDo встреча Петров завтра 15:00"

**Поведение:**
- `parseTokens()`: string[] - разбивает на токены по пробелам
- `isEmpty()`: boolean
- `toString()`: string

**Правила:**
- Не может быть пустой
- Сохраняет оригинальное написание и порядок тегов

#### SearchQuery
**Описание**: Поисковый запрос пользователя.

**Поля:**
- `value`: string - исходная строка запроса
- `normalizedTokens`: string[] - нормализованные токены для поиска

**Поведение:**
- `isEmpty()`: boolean

### 2.3 Domain Services

#### TagNormalizer
**Описание**: Сервис нормализации тегов.

**Методы:**
- `normalize(value: string)`: string

**Правила:**
- Приведение к нижнему регистру
- Опционально: удаление диакритики (в конфигурации)

#### TagParser
**Описание**: Сервис парсинга content в теги.

**Методы:**
- `parse(content: RecordContent, normalizer: TagNormalizer): string[]`

**Возвращает**: Массив нормализованных значений тегов для поиска/создания Tag entities

#### TagValidator
**Описание**: Валидация токенов.

**Методы:**
- `isValid(token: string)`: boolean

**Правила:**
- Длина от 1 до 100 символов (настраиваемо)
- Не содержит запрещённых символов: `{}[]:,"\`
- Не содержит пробелов

#### RecordMatcher
**Описание**: Сервис проверки соответствия записи поисковому запросу.

**Методы:**
- `matches(record: Record, query: SearchQuery, tags: Map<TagId, Tag>)`: boolean

**Логика:**
- Все токены из запроса должны присутствовать в записи (AND логика)
- Сравнение по нормализованным значениям

#### RecordDuplicateChecker
**Описание**: Сервис проверки уникальности записи.

**Методы:**
- `findDuplicate(tagIds: Set<TagId>, existingRecords: Record[]): Record | null`

**Логика:**
- Записи дубликаты, если имеют одинаковый набор tagIds
- Порядок не важен

## 3. Application Layer

### 3.1 Use Cases

#### CreateRecord
**Вход:** `{ content: string }`
**Выход:** `RecordDTO`
**Логика:**
1. Парсим content в токены
2. Валидируем каждый токен
3. Нормализуем токены
4. Находим или создаём теги для каждого уникального normalized значения
5. Проверяем на дубликат
6. Создаём Record с Set<TagId>
7. Сохраняем в репозитории
8. Возвращаем DTO

#### SearchRecords
**Вход:** `{ query: string }`
**Выход:** `SearchResultDTO`
**Логика:**
1. Парсим и нормализуем запрос
2. Находим теги по normalized значениям
3. Находим записи, содержащие ВСЕ теги из запроса
4. Определяем режим отображения (список/облако)
5. Формируем результат

#### UpdateRecord
**Вход:** `{ id: string, content: string }`
**Выход:** `RecordDTO`
**Логика:**
1. Находим запись
2. Парсим новый content
3. Находим/создаём теги
4. Проверяем на дубликат (исключая текущую запись)
5. Обновляем запись
6. Очищаем неиспользуемые теги
7. Возвращаем DTO

#### DeleteRecord
**Вход:** `{ id: string }`
**Выход:** `void`
**Логика:**
1. Находим и удаляем запись
2. Проверяем и удаляем неиспользуемые теги

#### GetTagSuggestions
**Вход:** `{ partial: string }`
**Выход:** `string[]`
**Логика:**
1. Нормализуем partial
2. Находим все теги, начинающиеся с partial
3. Возвращаем normalized значения для автодополнения

#### ExportData
**Вход:** `{ format: 'json' }`
**Выход:** `ExportDTO`
**Логика:**
1. Получаем все записи
2. Формируем JSON с content и метаданными
3. НЕ экспортируем UUID записей и тегов (только content и даты)

#### ImportData
**Вход:** `{ data: string, format: 'json' }`
**Выход:** `ImportResultDTO`
**Логика:**
1. **ПОЛНЫЙ ИМПОРТ**: Удаляем все существующие записи и теги
2. Парсим JSON данные
3. Для каждой записи из импорта:
   - Парсим content
   - Создаём новые теги (с новыми UUID)
   - Создаём новую запись (с новым UUID)
   - Сохраняем в репозитории
4. Возвращаем статистику импорта

**⚠️ Важно**: Импорт полностью заменяет все данные в системе!

### 3.2 Порты (интерфейсы для Infrastructure)

```typescript
interface RecordRepository {
  save(record: Record): Promise<void>
  findById(id: RecordId): Promise<Record | null>
  findByTagIds(tagIds: Set<TagId>): Promise<Record[]>
  findAll(): Promise<Record[]>
  delete(id: RecordId): Promise<void>
  deleteAll(): Promise<void>  // Для полного импорта
  update(record: Record): Promise<void>
}

interface TagRepository {
  save(tag: Tag): Promise<void>
  findById(id: TagId): Promise<Tag | null>
  findByNormalizedValue(value: string): Promise<Tag | null>
  findByIds(ids: Set<TagId>): Promise<Map<TagId, Tag>>
  findAll(): Promise<Tag[]>
  deleteAll(): Promise<void>  // Для полного импорта
  deleteUnused(): Promise<number>
}
```

### 3.3 DTO (Data Transfer Objects)

```typescript
interface RecordDTO {
  id: string
  content: string  // оригинальное написание как ввёл пользователь
  createdAt: string
  updatedAt: string
}

interface SearchResultDTO {
  mode: 'list' | 'cloud'
  records?: RecordDTO[]           // для режима list
  tagCloud?: TagCloudItemDTO[]    // для режима cloud
  total: number
}

interface TagCloudItemDTO {
  value: string    // нормализованное значение тега
  count: number    // частота использования
  size: number     // размер в облаке (1-5)
}

interface ExportDTO {
  version: string
  records: Array<{
    content: string      // Только content - UUID не экспортируются
    createdAt: string
    updatedAt: string
  }>
  metadata: {
    exportedAt: string
    recordCount: number
  }
}

interface ImportResultDTO {
  imported: number     // Количество импортированных записей
  errors: string[]     // Ошибки парсинга, если были
  replacedAll: boolean // true - всегда полная замена данных
}
```

## 4. Infrastructure Layer

### 4.1 Схема хранения (localStorage)

```javascript
{
  "version": "2.1",
  
  // Теги - объект для O(1) доступа по ID
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
  
  // Записи - объект для O(1) доступа по ID
  "records": {
    "uuid-record-1": {
      "id": "uuid-record-1",
      "content": "ToDo встреча Петров 15:00",
      "tagIds": ["uuid-tag-1", "uuid-tag-2", "uuid-tag-3", "uuid-tag-4"],
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  },
  
  // Индексы для быстрого поиска
  "indexes": {
    // normalized значение → ID тега
    "normalizedToTagId": {
      "todo": "uuid-tag-1",
      "встреча": "uuid-tag-2",
      "петров": "uuid-tag-3"
    },
    
    // ID тега → массив ID записей
    "tagToRecords": {
      "uuid-tag-1": ["uuid-record-1", "uuid-record-2"],
      "uuid-tag-2": ["uuid-record-1"]
    }
  }
}
```

**Почему объекты, а не массивы:**
- O(1) доступ по ID вместо O(n) поиска
- Для 10,000 записей это критично
- Проще обновление и удаление

### 4.2 Адаптеры

Реализация репозиториев через localStorage с поддержкой:
- Индексов для быстрого поиска
- Метода deleteAll() для полного импорта

## 5. Presentation Layer

### 5.1 Компоненты Web

| Компонент | Ответственность |
|-----------|-----------------|
| SearchInput | Универсальное поле ввода с debounce |
| RecordList | Список записей с действиями |
| TagCloud | Облако тегов с кликабельными элементами |
| AutoComplete | Dropdown с подсказками |
| LoadingIndicator | Индикатор поиска/загрузки |
| ImportExport | Компонент для работы с данными |

### 5.2 Состояния UI

```typescript
type UIMode = 
  | { type: 'empty' }
  | { type: 'searching'; query: string }
  | { type: 'list'; records: RecordDTO[] }
  | { type: 'cloud'; tags: TagCloudItemDTO[] }
  | { type: 'creating'; content: string }
  | { type: 'editing'; record: RecordDTO }
  | { type: 'no-results'; query: string }
  | { type: 'importing'; progress?: number }
  | { type: 'export-ready'; data: ExportDTO }
```

### 5.3 Презентеры

**SearchResultPresenter**: Определяет режим отображения (список/облако) на основе количества записей и размера контейнера.

**TagCloudPresenter**: Подготавливает данные для облака тегов с расчетом размеров и сортировкой по частоте.

**ImportExportPresenter**: Подготавливает имена файлов для экспорта и валидирует данные импорта.

## 6. Конфигурация

```typescript
interface AppConfig {
  tags: {
    maxLength: number;        // 100
    maxPerRecord: number;     // 50
  };
  normalization: {
    caseSensitive: boolean;   // false
    removeAccents: boolean;   // false
  };
  search: {
    debounceMs: number;       // 300
    liveSearch: boolean;      // true
  };
  display: {
    recordHeight: number;     // 60
  };
  storage: {
    maxSizeMB: number;        // 5
  };
  importExport: {
    warningThreshold: number; // 1000 записей
    backupBeforeImport: boolean; // true
  };
}
```

## 7. Алгоритм работы основного интерфейса

### Поток ввода в единое поле:

```
Пользователь вводит текст
    ↓
Debounce 300ms
    ↓
Поиск записей
    ↓
Найдено?
  ├─ Да → Помещается на экран?
  │       ├─ Да → Показать список
  │       └─ Нет → Показать облако тегов
  └─ Нет → Предложить создать запись
          └─ Enter → Создать
```

### Поток импорта/экспорта:

```
Экспорт:
  Пользователь → Кнопка "Экспорт" → JSON файл (без UUID)

Импорт:
  Пользователь → Выбирает файл → Предупреждение о замене всех данных
    ↓
  Подтверждение → Полное удаление → Импорт записей → Создание новых UUID
```

### Клавиатурные команды:
- **Enter**: Создать запись / Открыть для редактирования
- **Escape**: Очистить поле
- **Tab**: Автодополнение
- **↑/↓**: Навигация по списку
- **Delete**: Удалить выбранную запись

## 8. Требования к производительности

| Операция | Цель | При объёме |
|----------|------|------------|
| Поиск | < 100мс | 10,000 записей |
| Сохранение | < 50мс | - |
| Автодополнение | < 50мс | 10,000 тегов |
| Определение режима | < 10мс | 100 записей |
| Полный импорт | < 2сек | 1,000 записей |
| Экспорт | < 1сек | 10,000 записей |

## 9. Безопасность импорта/экспорта

### Экспорт:
- **Не экспортируются**: UUID записей и тегов
- **Экспортируются**: Content, даты создания/обновления
- **Формат**: Стандартный JSON с версионированием
- **Размер**: Предупреждение при экспорте > 1000 записей

### Импорт:
- **Полная замена**: Все существующие данные удаляются
- **Предупреждение**: Обязательное подтверждение пользователя
- **Резервная копия**: Автоматическое создание перед импортом
- **Валидация**: Проверка структуры JSON перед импортом
- **Новые UUID**: Все записи и теги получают новые идентификаторы

## 10. Подготовка к будущему (НЕ реализуем в прототипе)

### Что заложено в структуре:
1. **Tags как entities** - позволит переименование
2. **UUID для всего** - позволит синхронизацию
3. **Нормализация в одном месте** - легко изменить правила
4. **Чистые слои** - легко заменить localStorage на API
5. **Версионирование экспорта** - позволит миграции формата

### Что НЕ делаем сейчас:
1. ❌ События и EventBus
2. ❌ Переименование тегов
3. ❌ Слияние тегов
4. ❌ История изменений
5. ❌ Синхронизация
6. ❌ Инкрементальный импорт
7. ❌ Сложная валидация

## 11. Критерии готовности прототипа

**Domain Layer:**
- [ ] Record с content и Set<TagId>
- [ ] Tag с id и normalizedValue
- [ ] Сервисы парсинга и нормализации
- [ ] Валидация токенов

**Application Layer:**
- [ ] CreateRecord use case
- [ ] SearchRecords с автоопределением режима
- [ ] UpdateRecord с проверкой дубликатов
- [ ] DeleteRecord с очисткой тегов
- [ ] GetTagSuggestions для автодополнения
- [ ] ExportData без UUID
- [ ] ImportData с полной заменой

**Infrastructure Layer:**
- [ ] localStorage адаптеры
- [ ] Индексы для быстрого поиска
- [ ] deleteAll() методы для импорта
- [ ] Экспорт/импорт JSON

**Presentation Layer:**
- [ ] Единое поле ввода
- [ ] Автопереключение список/облако
- [ ] Клавиатурная навигация
- [ ] Индикаторы загрузки
- [ ] UI импорта/экспорта с предупреждениями

**Тестирование:**
- [ ] 95% покрытие Domain
- [ ] 90% покрытие Use Cases
- [ ] Интеграционные тесты Storage
- [ ] Тесты импорта/экспорта с проверкой полной замены