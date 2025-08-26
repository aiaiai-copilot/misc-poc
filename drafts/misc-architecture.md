# MISC - Архитектурная спецификация (v4)

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
- `id`: RecordId - уникальный идентификатор
- `content`: RecordContent - содержимое записи как ввёл пользователь
- `createdAt`: Date - дата создания
- `updatedAt`: Date - дата последнего обновления

**Поведение:**
- `getTags()`: TagCollection - извлекает коллекцию тегов из content
- `equals(other: Record)`: boolean - сравнение по ID
- `hasSameTags(other: Record)`: boolean - проверка на одинаковые теги (по нормализованным значениям)

**Инварианты:**
- ID неизменен после создания
- Content не может быть пустым
- Content должен содержать хотя бы один валидный тег

### 2.2 Value Objects

#### RecordId
**Описание**: Идентификатор записи.

**Поля:**
- `value`: UUID

**Поведение:**
- `toString()`: string
- `equals(other: RecordId)`: boolean

#### Tag
**Описание**: Отдельный тег - основная единица информации в системе.

**Поля:**
- `value`: string - исходное значение как ввёл пользователь (например, "ToDo")
- `normalizedValue`: string - нормализованная форма для поиска (например, "todo")

**Поведение:**
- `equals(other: Tag)`: boolean - сравнение по нормализованному значению
- `matches(other: Tag)`: boolean - проверка совпадения для поиска
- `isValid()`: boolean - проверка валидности

**Правила создания:**
- Не может быть пустым
- Не содержит пробелов
- Не содержит символов: `{}[]:,"\`
- Максимальная длина: 100 символов (настраиваемо)
- Нормализация происходит при создании согласно конфигурации

#### RecordContent
**Описание**: Содержимое записи - строка тегов как ввёл пользователь.

**Поля:**
- `value`: string - например, "ToDo встреча Петров завтра 15:00"

**Поведение:**
- `toTagCollection()`: TagCollection - парсит строку в коллекцию тегов
- `isEmpty()`: boolean
- `toString()`: string

**Правила:**
- Не может быть пустой
- Должна содержать хотя бы один валидный тег после парсинга

#### TagCollection
**Описание**: Упорядоченная коллекция тегов.

**Поля:**
- `tags`: Tag[] - массив тегов в порядке их появления

**Поведение:**
- `contains(tag: Tag)`: boolean - содержит ли тег (по нормализованному значению)
- `containsAll(tags: Tag[])`: boolean - содержит ли все теги
- `toArray()`: Tag[]
- `toStringArray()`: string[] - массив исходных значений
- `getNormalizedSet()`: Set<string> - уникальные нормализованные значения
- `size()`: number

**Инварианты:**
- Сохраняет порядок тегов
- Теги уникальны по нормализованному значению

#### SearchQuery
**Описание**: Поисковый запрос пользователя.

**Поля:**
- `value`: string - исходная строка запроса
- `tags`: TagCollection - распарсенные теги запроса

**Поведение:**
- `getTags()`: TagCollection
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

#### RecordMatcher
**Описание**: Сервис проверки соответствия записи поисковому запросу.

**Методы:**
- `matches(record: Record, query: SearchQuery)`: boolean

**Логика:**
- Все теги из запроса должны присутствовать в записи (AND логика)
- Сравнение по нормализованным значениям

#### RecordUniquenessChecker
**Описание**: Сервис проверки уникальности записи.

**Методы:**
- `isDuplicate(content: RecordContent, existingRecords: Record[])`: boolean
- `findDuplicate(content: RecordContent, existingRecords: Record[])`: Record | null

**Логика:**
- Записи считаются дубликатами, если имеют одинаковый набор нормализованных тегов
- Порядок тегов не важен для определения дубликата

### 2.4 Domain Events

| Событие | Когда возникает | Данные |
|---------|-----------------|--------|
| RecordCreated | После создания записи | recordId, content, createdAt |
| RecordUpdated | После обновления записи | recordId, oldContent, newContent, updatedAt |
| RecordDeleted | После удаления записи | recordId, deletedAt |

### 2.5 Спецификации

#### TagSpecification
**Описание**: Проверка валидности тега.

**Методы:**
- `isSatisfiedBy(value: string)`: boolean

**Правила:**
- Длина от 1 до 100 символов
- Не содержит запрещённых символов
- Не содержит пробелов

## 3. Application Layer

### 3.1 Use Cases

| Use Case | Вход | Выход | Логика |
|----------|------|-------|---------|
| CreateRecord | content: string | RecordDTO | Создание RecordContent → Проверка валидности → Проверка уникальности → Создание Record → Сохранение → Публикация события |
| SearchRecords | query: string | RecordDTO[] или TagCloudDTO | Создание SearchQuery → Поиск записей → Формирование результата или облака тегов |
| UpdateRecord | id: string, content: string | RecordDTO | Поиск записи → Создание нового RecordContent → Проверка уникальности → Обновление → Публикация события |
| DeleteRecord | id: string | void | Поиск записи → Удаление → Публикация события |
| GetTagSuggestions | partial: string | string[] | Получение всех тегов → Фильтрация по префиксу → Возврат уникальных вариантов |
| ExportData | format: string | ExportDTO | Получение всех записей → Форматирование согласно формату |
| ImportData | data: string, format: string | ImportResultDTO | Парсинг данных → Валидация → Импорт с обработкой дубликатов |

### 3.2 Порты (интерфейсы для Infrastructure)

```typescript
interface RecordRepository {
  save(record: Record): Promise<void>
  findById(id: string): Promise<Record | null>
  findByTags(tags: Tag[]): Promise<Record[]>
  delete(id: string): Promise<void>
  getAll(): Promise<Record[]>
}

interface TagRepository {
  getAllUniqueTags(): Promise<Tag[]>
  getTagFrequency(): Promise<Map<Tag, number>>
}

interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}
```

### 3.3 DTO (Data Transfer Objects)

| DTO | Поля | Назначение |
|-----|------|------------|
| RecordDTO | id, content, createdAt, updatedAt | Представление записи для UI |
| TagCloudDTO | tags: TagCloudItemDTO[] | Облако тегов |
| TagCloudItemDTO | value, count, size | Элемент облака тегов |
| ExportDTO | version, records, metadata | Данные для экспорта |
| ImportResultDTO | imported, skipped, errors | Результат импорта |

## 4. Infrastructure Layer

### 4.1 Схема хранения (Прототип - localStorage)

```json
{
  "version": "1.0",
  "records": {
    "uuid-1": {
      "id": "uuid-1",
      "content": "ToDo встреча Петров 15:00",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  },
  "indexes": {
    "tagToRecords": {
      "todo": ["uuid-1"],
      "встреча": ["uuid-1"],
      "петров": ["uuid-1"],
      "15:00": ["uuid-1"]
    },
    "tagVariants": {
      "todo": "ToDo",
      "встреча": "встреча",
      "петров": "Петров"
    }
  }
}
```

### 4.2 Схема БД (MVP - PostgreSQL)

```sql
-- Таблица записей
CREATE TABLE records (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Индекс для полнотекстового поиска
CREATE INDEX idx_records_content ON records 
  USING GIN (to_tsvector('simple', lower(content)));

-- Таблица для кеша тегов
CREATE TABLE tag_cache (
  normalized_value VARCHAR(100) PRIMARY KEY,
  original_value VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 5. Presentation Layer

### 5.1 Компоненты Web

| Компонент | Ответственность |
|-----------|-----------------|
| SearchInput | Универсальное поле ввода/поиска |
| RecordList | Отображение списка записей |
| TagCloud | Облако тегов с размерами по частоте |
| AutoComplete | Подсказки при вводе на основе существующих тегов |
| RecordEditor | Режим редактирования записи |

### 5.2 CLI команды

```bash
misc add "content"       # Создать запись
misc search "query"      # Найти записи  
misc edit <id>          # Редактировать
misc delete <id>        # Удалить
misc export             # Экспорт данных
misc import <file>      # Импорт данных
misc stats              # Статистика тегов
```

## 6. Shared UI Logic

### 6.1 Презентеры

| Презентер | Ответственность |
|-----------|-----------------|
| RecordPresenter | Форматирование записей для отображения |
| TagCloudPresenter | Расчёт размеров тегов в облаке на основе частоты |
| SearchResultPresenter | Определение режима отображения (список/облако) |
| AutoCompletePresenter | Формирование подсказок с учётом контекста |

### 6.2 Состояния интерфейса

**SearchState:**
- Empty: начальное состояние, пустое поле
- Typing: пользователь вводит текст
- Searching: идёт поиск
- ShowingResults: отображение результатов (список или облако)
- NoResults: ничего не найдено, предложение создать
- Creating: режим создания новой записи
- Editing: режим редактирования существующей записи

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
| display.cloudThreshold | 20 | Когда показывать облако вместо списка |
| storage.maxSizeMB | 5 | Лимит для localStorage |

## 8. Миграция Прототип → MVP

### 8.1 Этапы

1. **Экспорт**: Use case ExportData создаёт JSON со всеми записями
2. **Deploy Backend**: Развёртывание API сервера и PostgreSQL
3. **Импорт**: Use case ImportData загружает JSON в новое хранилище
4. **Переключение**: Frontend начинает работать через REST API

### 8.2 Что меняется

| Компонент | Прототип | MVP |
|-----------|----------|-----|
| Storage | LocalStorageAdapter | PostgreSQLAdapter |
| Use Cases | Выполняются в браузере | Выполняются на сервере |
| Frontend | Прямой вызов use cases | HTTP API вызовы |
| Поиск | По индексу в localStorage | PostgreSQL full-text search |
| Теги | Индекс в памяти | Кеш-таблица в БД |

## 9. Требования к производительности

| Операция | Целевое время | При объёме |
|----------|---------------|------------|
| Поиск | < 100мс | 10,000 записей |
| Сохранение | < 50мс | - |
| Автодополнение | < 50мс | 10,000 уникальных тегов |
| Загрузка приложения | < 2с | 1,000 записей |
| Экспорт | < 5с | 10,000 записей |

## 10. Критерии готовности архитектуры

- [ ] Tag инкапсулирует логику валидации и нормализации
- [ ] Record хранит content как единую строку
- [ ] TagCollection обеспечивает работу с упорядоченным набором тегов
- [ ] Поиск работает по нормализованным значениям Tag
- [ ] Use cases оперируют доменными объектами, не знают о деталях хранения
- [ ] Замена localStorage на PostgreSQL требует изменения только в Infrastructure слое
- [ ] Web и CLI используют одни и те же use cases через разные презентационные слои