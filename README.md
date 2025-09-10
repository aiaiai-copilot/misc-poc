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
# Запустить веб-приложение (сборка + preview сервер)
yarn dev
# или альтернативная команда
yarn web:start

# Приложение будет доступно на http://localhost:4173/

# Только сборка веб-приложения
yarn workspace @misc-poc/presentation-web build

# Только preview сервер (после сборки)
yarn workspace @misc-poc/presentation-web preview

# Тестирование веб-приложения
yarn workspace @misc-poc/presentation-web test
```

**Примечание**: Development сервер на порту 3000 недоступен из-за проблем совместимости Node.js v22 с Yarn PnP. Используется production preview сервер на порту 4173, который предоставляет ту же функциональность.

### Тестирование

```bash
# Все тесты (259 тестов: shared + domain + другие пакеты)
yarn test

# Тесты отдельных пакетов (используйте workspace команды)
yarn workspace @misc-poc/shared test  # 229 тестов shared пакета
yarn workspace @misc-poc/domain test  # 30 тестов domain пакета (TagNormalizer и др.)
```

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

# Линтинг конкретного пакета
yarn workspace @misc-poc/shared lint  # ❌ PnP compatibility issue - use 'yarn lint' instead
yarn workspace @misc-poc/domain lint  # ❌ PnP compatibility issue - use 'yarn lint' instead
yarn workspace @misc-poc/application lint  # ❌ PnP compatibility issue - use 'yarn lint' instead
yarn workspace @misc-poc/infrastructure-localstorage lint  # ❌ PnP compatibility issue - use 'yarn lint' instead
yarn workspace @misc-poc/presentation-cli lint
yarn workspace @misc-poc/presentation-web lint  # ❌ PnP compatibility issue - use 'yarn lint' instead

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
