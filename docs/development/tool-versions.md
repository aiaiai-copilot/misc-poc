# Tool Versions Specification

## Статус

- **Дата утверждения**: 2025-08-30
- **Этап**: Прототип
- **Приоритет**: Минимизация рисков несовместимости

## Runtime

| Инструмент | Версия | Обоснование |
|------------|--------|-------------|
| **Node.js** | 22.18.0 | Уже определено в проекте |

## Основные зависимости

### Core

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **TypeScript** | 5.3.3 | Стабильная версия, не самая новая, но с полной поддержкой необходимых features |
| **React** | 18.2.0 | Последняя LTS-подобная версия с хорошей экосистемой |
| **React DOM** | 18.2.0 | Соответствует версии React |

### Build Tools

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **Vite** | 5.0.12 | Стабильная версия 5.0.x, проверенная совместимость с React 18 |
| **Yarn** | 3.6.4 | Modern Yarn с PnP support (альтернатива: 1.22.22 для Classic) |

### Testing

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **Jest** | 29.7.0 | Последняя из 29.x ветки, стабильная и проверенная |
| **@types/jest** | 29.5.12 | Соответствует версии Jest |
| **ts-jest** | 29.1.2 | Совместима с Jest 29.x и TypeScript 5.x |
| **@testing-library/react** | 14.2.1 | Совместима с React 18 |
| **@testing-library/jest-dom** | 6.4.2 | Последняя стабильная |

### Code Quality

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **ESLint** | 8.56.0 | Версия 8.x для избежания breaking changes из 9.x |
| **Prettier** | 3.2.5 | Стабильная версия из 3.x ветки |
| **@typescript-eslint/parser** | 6.21.0 | Совместима с TypeScript 5.3.x и ESLint 8.x |
| **@typescript-eslint/eslint-plugin** | 6.21.0 | Соответствует версии parser |

### CLI Dependencies (Ink)

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **Ink** | 3.2.0 | Последняя из 3.x, не используем 4.x alpha |
| **ink-text-input** | 4.0.3 | Совместима с Ink 3.x |
| **ink-select-input** | 4.2.2 | Совместима с Ink 3.x |

### Utility Libraries

| Пакет | Версия | Обоснование |
|-------|--------|-------------|
| **uuid** | 9.0.1 | Стабильная версия для генерации UUID |
| **@types/uuid** | 9.0.8 | Типы для uuid |

## Конфигурация TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx"
  }
}