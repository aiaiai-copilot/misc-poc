# End-to-End Testing Guidelines

## Overview

This directory contains end-to-end tests for the Misc POC application using [Playwright](https://playwright.dev/). E2E tests ensure the complete user experience works correctly across different browsers and scenarios.

## 📁 Directory Structure

```
e2e/
├── README.md                     # This file
├── 01-first-use.spec.ts         # Initial user experience
├── 02-record-management.spec.ts  # CRUD operations
├── 03-search-and-discovery.spec.ts # Search functionality
├── 04-import-export.spec.ts     # Export/import features
├── 05-keyboard-navigation.spec.ts # Accessibility
├── support/
│   └── page-objects/
│       └── MiscPage.ts           # Page Object Model
├── test-data/                    # Generated test files (gitignored)
└── downloads/                    # Downloaded files (gitignored)
```

## 🎯 Test Categories & Naming

### Naming Convention: `XX-feature-name.spec.ts`

- **01-**: Initial user experience, onboarding flows
- **02-**: Core CRUD operations (Create, Read, Update, Delete)
- **03-**: Search, filtering, discovery features
- **04-**: Data operations (import/export, backup/restore)
- **05-**: Accessibility, keyboard navigation, screen readers
- **06-**: Performance, large datasets, stress testing
- **07-**: Integration with external services
- **08-**: Error scenarios, edge cases
- **09-**: Cross-browser compatibility
- **10+**: Feature-specific tests (themes, settings, etc.)

## 🏗️ Page Object Model

### MiscPage Class (`support/page-objects/MiscPage.ts`)

The main page object containing all selectors and interaction methods:

```typescript
// Navigation & Setup
await miscPage.goto();
await miscPage.clearLocalStorage();

// Input Operations
await miscPage.typeInInput('search term');
await miscPage.createRecord('tag1 tag2 tag3');
await miscPage.clearInput();

// Results & Verification
const count = await miscPage.getRecordCount();
const records = await miscPage.getVisibleRecords();
const tags = await miscPage.getTagCloudTags();

// Export/Import
await miscPage.exportData();
await miscPage.importData('/path/to/file.json');

// Navigation
await miscPage.navigateWithArrows('down', 3);
await miscPage.selectRecordWithKeyboard(0);
```

### Adding New Page Object Methods

When adding UI components, extend the page object:

```typescript
// 1. Add locator property
readonly newFeatureButton: Locator;

constructor(page: Page) {
  // 2. Initialize selector
  this.newFeatureButton = page.locator('[data-testid="new-feature-btn"]');
}

// 3. Add interaction method
async clickNewFeature(): Promise<void> {
  await this.newFeatureButton.click();
}

// 4. Add verification method
async isNewFeatureVisible(): Promise<boolean> {
  return await this.newFeatureButton.isVisible();
}
```

## 📝 Test Structure & Best Practices

### Standard Test Template

```typescript
import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';

test.describe('Feature Name', () => {
  let miscPage: MiscPage;

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();
  });

  test.describe('Sub-feature Group', () => {
    test('should perform specific action', async () => {
      // Given - setup initial state
      await miscPage.createRecord('initial data');

      // When - perform action
      await miscPage.typeInInput('search query');

      // Then - verify results
      const results = await miscPage.getVisibleRecords();
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
```

### Test Naming Convention

Use descriptive BDD-style names:

```typescript
// ✅ Good - Clear intent and expected outcome
test('should display search results when entering valid query');
test('should show error message for invalid JSON import');
test('should navigate to next record with arrow key');

// ❌ Bad - Vague or technical focus
test('test search functionality');
test('error handling');
test('keyboard events');
```

## 🔧 Selector Strategy

### Priority Order for Element Selection

1. **Semantic Test IDs** (Preferred)

   ```typescript
   page.locator('[data-testid="main-input"]');
   page.locator('[data-testid="export-button"]');
   ```

2. **Semantic Attributes**

   ```typescript
   page.locator('button[title="Export data"]');
   page.locator('input[type="file"][accept=".json"]');
   ```

3. **Accessible Roles & Labels**

   ```typescript
   page.locator('button', { hasText: 'Export' });
   page.getByRole('button', { name: 'Import data' });
   ```

4. **CSS Classes** (Last Resort)
   ```typescript
   page.locator('.export-button'); // Only if no other options
   ```

### Avoid Brittle Selectors

```typescript
// ❌ Fragile - breaks with styling changes
page.locator('.btn.btn-primary.export-btn');
page.locator('div > div > button:nth-child(2)');

// ✅ Robust - survives refactoring
page.locator('[data-testid="export-button"]');
page.locator('button[title="Export data"]');
```

## 🌐 Multilingual Testing

Match the application's language usage:

```typescript
// Use actual application text
await miscPage.createRecord('проект deadline понедельник');
await miscPage.typeInInput('покупки молоко хлеб');

// Verify multilingual content
expect(records).toContain('идея startup приложение');
```

## 🧪 Test Categories & Examples

### 1. Functionality Tests

```typescript
test('should create record with multiple tags', async () => {
  await miscPage.typeInInput('работа проект срочно');
  await miscPage.page.keyboard.press('Enter');

  const count = await miscPage.getRecordCount();
  expect(count).toBe(1);
});
```

### 2. User Flow Tests

```typescript
test('should complete full export-import cycle', async () => {
  // Create data
  await miscPage.createRecord('test data');

  // Export
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    miscPage.exportData(),
  ]);

  // Clear and import
  await miscPage.clearLocalStorage();
  await miscPage.importData(downloadPath);

  // Verify restoration
  const records = await miscPage.getVisibleRecords();
  expect(records).toContain('test data');
});
```

### 3. Accessibility Tests

```typescript
test('should support keyboard navigation', async () => {
  await miscPage.inputField.focus();
  await page.keyboard.press('Tab'); // Export button
  await expect(page.locator('[title="Export data"]')).toBeFocused();

  await page.keyboard.press('Tab'); // Import button
  await expect(page.locator('[title="Import data"]')).toBeFocused();
});
```

### 4. Error Handling Tests

```typescript
test('should handle invalid JSON gracefully', async () => {
  const invalidFile = path.join(testDataPath, 'invalid.json');
  await fs.writeFile(invalidFile, 'invalid json content');

  await miscPage.importData(invalidFile);

  // Application should remain functional
  await expect(miscPage.inputField).toBeVisible();
  await miscPage.typeInInput('still works');
});
```

## 🚀 Running Tests

### Local Development

```bash
# Run all E2E tests
yarn test:e2e

# Run with browser UI
yarn test:e2e:ui

# Run in headed mode (see browser)
yarn test:e2e:headed

# Debug specific test
yarn test:e2e:debug -- --grep "export functionality"

# Run specific test file
npx playwright test e2e/04-import-export.spec.ts
```

### Test Configuration

Tests are configured via `playwright.config.ts` in the project root.

### Parallel Execution

Tests run in parallel by default. Ensure test independence:

```typescript
test.beforeEach(async ({ page }) => {
  // Always start with clean state
  await miscPage.clearLocalStorage();
  await miscPage.goto();
});
```

## 🔍 Debugging Failed Tests

### 1. Enable Debug Mode

```bash
yarn test:e2e:debug -- --grep "failing test name"
```

### 2. Add Debug Statements

```typescript
// Pause test for manual inspection
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug-screenshot.png' });

// Log page content
console.log(await page.content());

// Check element state
console.log(await element.isVisible());
console.log(await element.textContent());
```

### 3. Verify Selectors

```typescript
// Test if selector exists
const element = page.locator('[data-testid="my-element"]');
await expect(element).toBeVisible({ timeout: 1000 });

// List all matching elements
const elements = await page.locator('[data-testid]').all();
console.log(elements.length);
```

## 📊 Test Data Management

### Dynamic Test Data

```typescript
// Generate unique test data
const testId = `test-${Date.now()}`;
const testData = {
  records: [
    {
      id: testId,
      tags: ['тест', 'данные', testId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};
```

### File Management

```typescript
test.beforeAll(async () => {
  // Setup test directories
  await fs.mkdir(testDataPath, { recursive: true });
});

test.afterEach(async () => {
  // Cleanup generated files
  try {
    const files = await fs.readdir(downloadPath);
    for (const file of files) {
      await fs.unlink(path.join(downloadPath, file));
    }
  } catch {
    // Directory might not exist
  }
});
```

## 🎭 Browser-Specific Considerations

### File Downloads

Different browsers handle downloads differently:

```typescript
// Universal approach
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('[data-testid="export-button"]'),
]);

const filePath = path.join(downloadPath, download.suggestedFilename());
await download.saveAs(filePath);
```

### File Uploads

```typescript
// Set files on input element
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(pathToFile);
```

## ⚡ Performance Guidelines

### Efficient Waiting

```typescript
// ✅ Wait for specific conditions
await expect(page.locator('[data-testid="results"]')).toBeVisible();
await page.waitForLoadState('networkidle');

// ❌ Avoid arbitrary timeouts
await page.waitForTimeout(5000); // Only when absolutely necessary
```

### Minimize Page Navigation

```typescript
// ✅ Reuse page instance
test.beforeEach(async ({ page }) => {
  miscPage = new MiscPage(page);
  await miscPage.goto(); // Single navigation per test
});

// ❌ Avoid multiple navigations
test('should work', async () => {
  await page.goto('/');
  await page.goto('/other-page'); // Unnecessary
});
```

## 🏷️ Test Tagging & Organization

### Test Categories

Use test.describe() blocks to group related tests:

```typescript
test.describe('Export Functionality', () => {
  test.describe('Valid Data Export', () => {
    test('should export empty data');
    test('should export with records');
  });

  test.describe('Export Errors', () => {
    test('should handle network failures');
    test('should handle permission errors');
  });
});
```

### Conditional Tests

```typescript
// Skip tests based on conditions
test.skip(process.env.CI === 'true', 'Flaky in CI environment');

// Run only specific tests
test.only('should focus on this test during development');
```

## 📋 Checklist for New E2E Tests

When adding new E2E tests:

- [ ] **Named descriptively** with BDD-style descriptions
- [ ] **Grouped logically** with test.describe() blocks
- [ ] **Uses page objects** instead of direct page interactions
- [ ] **Starts with clean state** (clearLocalStorage, fresh navigation)
- [ ] **Tests happy path** and error scenarios
- [ ] **Includes accessibility** checks (keyboard navigation, ARIA)
- [ ] **Uses semantic selectors** (data-testid, titles, roles)
- [ ] **Handles async operations** properly (waitForEvent, expect)
- [ ] **Cleans up test data** (files, localStorage, etc.)
- [ ] **Documents complex scenarios** with inline comments

## 🆘 Common Issues & Solutions

### Issue: Test Times Out

```typescript
// Solution: Increase timeout for slow operations
await expect(element).toBeVisible({ timeout: 10000 });
await page.waitForLoadState('networkidle', { timeout: 30000 });
```

### Issue: Element Not Found

```typescript
// Solution: Wait for element before interaction
await page.waitForSelector('[data-testid="my-element"]');
await expect(page.locator('[data-testid="my-element"]')).toBeVisible();
```

### Issue: Flaky Tests

```typescript
// Solution: Add proper waits and retries
await expect(async () => {
  const count = await miscPage.getRecordCount();
  expect(count).toBe(expectedCount);
}).toPass({ timeout: 5000 });
```

### Issue: File Operations Fail

```typescript
// Solution: Ensure directories exist and permissions are correct
await fs.mkdir(testDataPath, { recursive: true });
await fs.access(filePath, fs.constants.R_OK);
```

---

## 🎯 Remember

**The goal of E2E tests is to verify the complete user experience.**

- Test from the user's perspective
- Use realistic data and scenarios
- Cover both happy paths and error cases
- Maintain tests alongside UI changes
- Keep tests fast, reliable, and independent

**Every UI change must have corresponding E2E test updates!**

For questions or improvements to this guide, update this README.md file.
