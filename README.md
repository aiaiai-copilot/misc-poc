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

# Запустить разработку
yarn dev
```

## Команды для разработки

### Тестирование

```bash
# Запустить тесты конкретного пакета
yarn workspace @misc-poc/shared test

# Запустить тесты с покрытием
yarn workspace @misc-poc/shared test --coverage
```

### Линтинг

```bash
# Запустить ESLint для всех пакетов
yarn dlx eslint packages/*/src --ext .ts

# Запустить ESLint для конкретного пакета (из корня проекта)
yarn dlx eslint packages/shared/src --ext .ts

# Запустить ESLint с автоисправлением
yarn dlx eslint packages/shared/src --ext .ts --fix

# Из директории пакета
cd packages/shared
yarn dlx eslint src --ext .ts
```

### Проверка типов

```bash
# Проверить типы в конкретном пакете
yarn workspace @misc-poc/shared typecheck
```

### Сборка

```bash
# Собрать конкретный пакет
yarn workspace @misc-poc/shared build
```
