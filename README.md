# misc-poc

## Требования

- Node.js 22.18.0 (см. `.nvmrc`)
- Yarn 3.6.4

## Быстрый старт

```bash
# Установить правильную версию Node
nvm use

# Установить зависимости
yarn install

# Запустить веб-приложение
yarn dev
```

## База данных (PostgreSQL)

Проект использует PostgreSQL в Docker Compose для разработки и тестирования.

### Быстрый старт базы данных

```bash
# Настроить переменные окружения
cp .env.example .env

# Запустить базу данных
docker-compose up -d postgres

# Проверить готовность
./scripts/wait-for-db.sh
```

### Основные команды базы данных

```bash
# Проверка здоровья базы данных
./scripts/db-health-check.sh

# Создание резервной копии
./scripts/db-backup.sh

# Восстановление из резервной копии
./scripts/db-backup.sh restore backup_file.sql

# Сброс базы данных (удаляет все данные!)
./scripts/db-reset.sh

# Тестовая база данных
docker-compose -f docker-compose.test.yml up -d postgres-test
```

### Конфигурация

- **Основная БД**: `misc_poc_dev` на порту 5432
- **Тестовая БД**: `misc_poc_test` на порту 5433
- **Данные**: Сохраняются в `./data/postgres/`
- **Резервные копии**: Сохраняются в `./data/backups/`

📖 **Подробная документация**: [docs/database-setup.md](docs/database-setup.md)

## Команды для разработки

### Основные команды

```bash
# Тестирование всех пакетов (автоматически собирает зависимые пакеты)
yarn test

# Тестирование без автоматической сборки (быстрее, если пакеты уже собраны)
yarn test:no-build

# Строгое тестирование (останавливается при первой ошибке)
yarn test:strict

# Линтинг всех пакетов
yarn lint

# Проверка типов всех пакетов
yarn typecheck

# Сборка всех пакетов (включая веб-приложение)
yarn build

# Сборка только TypeScript пакетов (без веб-приложения)
yarn build:packages

# Очистка всех пакетов
yarn clean
```

### ⚠️ Важно: Зависимости сборки

Этот монорепо использует TypeScript workspace ссылки. Некоторые пакеты зависят от скомпилированного вывода других пакетов:

- `@misc-poc/presentation-web` импортирует из `@misc-poc/shared`, `@misc-poc/application`, и других
- Эти пакеты должны быть собраны **до** запуска тестов веб-приложения

**Автоматическое решение:**

- `yarn test` теперь автоматически собирает необходимые пакеты
- `yarn dev` автоматически собирает зависимости перед запуском

**Если у вас есть ошибки импорта:**

```bash
yarn build:packages  # Собрать все TypeScript пакеты
yarn test           # Теперь тесты должны работать
```

### Веб-приложение

```bash
# Development сервер (быстрая перезагрузка, HMR)
yarn workspace @misc-poc/presentation-web dev
# → http://localhost:5173/

# Production preview (собранная версия для тестирования)
yarn dev  # автоматически очищает + собирает + запускает preview
yarn web:start  # альтернатива без автоочистки
# → http://localhost:4173/

# Только сборка веб-приложения
yarn workspace @misc-poc/presentation-web build

# Только preview сервер (после сборки)
yarn workspace @misc-poc/presentation-web preview

# Тестирование веб-приложения
yarn workspace @misc-poc/presentation-web test
```

**⚠️ Node.js v22 совместимость**: Из-за изменений в Node.js v22 и Buffer API, Vite иногда не может правильно очистить папку `dist`. Команда `yarn dev` теперь автоматически очищает веб-пакет перед сборкой, чтобы избежать этой проблемы.

### Тестирование

#### Unit тесты

```bash
# Все unit тесты (259 тестов: shared + domain + другие пакеты)
yarn test

# Тесты отдельных пакетов (используйте workspace команды)
yarn workspace @misc-poc/shared test  # 229 тестов shared пакета
yarn workspace @misc-poc/domain test  # 30 тестов domain пакета (TagNormalizer и др.)
```

#### E2E тесты (End-to-End)

```bash
# Все E2E тесты (17 тестов пользовательских сценариев)
yarn test:e2e

# Только Chromium (быстрее)
yarn test:e2e --project=chromium

# С видимым браузером (для отладки)
yarn test:e2e:headed

# Интерактивный режим
yarn test:e2e:ui

# Режим отладки (пошаговое выполнение)
yarn test:e2e:debug

# Один конкретный тест
yarn test:e2e --project=chromium --grep "First record creation"
```

**E2E тесты покрывают:**

- 🎯 **Первое использование**: Создание записей, обратная связь, пустое состояние
- 📝 **Управление записями**: CRUD операции, уникальность, редактирование
- 🔍 **Поиск и обнаружение**: Реальное время поиска, мульти-тег логика, облако тегов
- ⌨️ **Навигация клавиатурой**: Горячие клавиши, навигация результатами
- 💾 **Импорт/Экспорт**: Сохранение и миграция данных

**Устранение неисправностей E2E:**

```bash
# Проверить конфликты портов (Linux/WSL)
lsof -i :4173

# Проверить конфликты портов (Windows)
netstat -ano | findstr :4173

# Убить процесс на порту 4173
kill <PID>  # Linux/WSL
taskkill /PID <PID> /F  # Windows

# Тестовый запуск сервера вручную
yarn test:e2e:server

# Проверить доступность приложения
curl -I http://localhost:4173/  # Должен вернуть HTTP 200
```

**Если E2E тесты не работают:**

1. ✅ Убедитесь, что порт 4173 свободен
2. ✅ Запустите `yarn test:e2e:server` чтобы проверить сборку
3. ✅ Откройте http://localhost:4173/ в браузере
4. ✅ Проверьте, что input поле видимо и фокусировано

### Команды для конкретных пакетов

```bash
# Запустить тесты конкретного пакета
yarn workspace @misc-poc/shared test
yarn workspace @misc-poc/domain test
yarn workspace @misc-poc/application test
yarn workspace @misc-poc/infrastructure-localstorage test
yarn workspace @misc-poc/presentation-cli test  # ❌ No tests found
yarn workspace @misc-poc/presentation-web test

# Запустить тесты с покрытием
yarn workspace @misc-poc/shared test --coverage
yarn workspace @misc-poc/domain test --coverage
yarn workspace @misc-poc/application test --coverage
yarn workspace @misc-poc/infrastructure-localstorage test --coverage
yarn workspace @misc-poc/presentation-cli test --coverage
yarn workspace @misc-poc/presentation-web test --coverage

# Линтинг конкретного пакета (eslint установлен на уровне root)
yarn lint  # Линтинг всех пакетов - рекомендуется
# Или для отдельных пакетов:
yarn exec eslint packages/shared/src --ext .ts
yarn exec eslint packages/domain/src --ext .ts
yarn exec eslint packages/application/src --ext .ts
yarn exec eslint packages/infrastructure/localStorage/src --ext .ts
yarn exec eslint packages/presentation/web/src --ext .ts,.tsx

# Проверка типов конкретного пакета
yarn workspace @misc-poc/shared typecheck
yarn workspace @misc-poc/domain typecheck
yarn workspace @misc-poc/application typecheck
yarn workspace @misc-poc/infrastructure-localstorage typecheck
yarn workspace @misc-poc/presentation-cli typecheck
yarn workspace @misc-poc/presentation-web typecheck

# Сборка конкретного пакета
yarn workspace @misc-poc/shared build
yarn workspace @misc-poc/domain build
yarn workspace @misc-poc/application build
yarn workspace @misc-poc/infrastructure-localstorage build
yarn workspace @misc-poc/presentation-cli build
yarn workspace @misc-poc/presentation-web build
```

## Контроль качества при коммитах

Проект настроен с автоматическими проверками качества при каждом коммите:

### Что проверяется автоматически

- **ESLint**: Проверка и автоисправление кода
- **Prettier**: Автоформатирование кода
- **TypeScript**: Проверка типов
- **Jest**: Запуск тестов (без покрытия для быстроты)
- **TaskMaster**: Соответствие workflow задач

### Последовательность проверок

1. ESLint исправляет проблемы кода
2. Prettier форматирует код
3. TypeScript проверяет типы
4. Jest запускает тесты
5. TaskMaster проверяет статус задачи
6. Коммит выполняется только если все проверки прошли

Это обеспечивает высокое качество кода и соблюдение стандартов проекта.
