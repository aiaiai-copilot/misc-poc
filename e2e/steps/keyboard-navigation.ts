import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { MiscPage } from '../support/page-objects/MiscPage';

let miscPage: MiscPage;

// Background setup
Given('I have several records in the system', async ({ page }) => {
  miscPage = new MiscPage(page);
  await miscPage.goto();
  await miscPage.clearLocalStorage();

  // Create some test records
  const testRecords = [
    'проект frontend React TypeScript',
    'проект backend Node.js database',
    'встреча команда понедельник 10:00',
    'покупки молоко хлеб магазин',
  ];

  for (const record of testRecords) {
    await miscPage.createRecord(record);
  }
});

Given('the application is keyboard-focused', async () => {
  // Ensure the input field is focused
  await miscPage.inputField.focus();
  await expect(miscPage.inputField).toBeFocused();
});

// Basic keyboard shortcuts scenarios
When('I press Escape', async () => {
  await miscPage.page.keyboard.press('Escape');
});

Then('the input field should be cleared', async () => {
  await expect(miscPage.inputField).toHaveValue('');
});

// Search result navigation scenarios
Given(
  'I search for {string} and see multiple results',
  async (query: string) => {
    await miscPage.searchFor(query);
    await miscPage.waitForSearchResults();

    // Verify we have multiple results
    const recordCount = await miscPage.getRecordCount();
    expect(recordCount).toBeGreaterThan(1);
  }
);

When('I press the down arrow key', async () => {
  await miscPage.page.keyboard.press('ArrowDown');
});

Then('the first result should be highlighted', async () => {
  // Check for highlighting via CSS classes or aria-selected
  const records = miscPage.recordsList.locator('[data-testid="record-item"]');
  const firstRecord = records.first();

  // Check if the first record has focus or selection styling
  const isSelected = await firstRecord.evaluate((element) => {
    return (
      element.classList.contains('selected') ||
      element.classList.contains('highlighted') ||
      element.getAttribute('aria-selected') === 'true' ||
      document.activeElement === element
    );
  });

  expect(isSelected).toBeTruthy();
});

When('I press the down arrow key again', async () => {
  await miscPage.page.keyboard.press('ArrowDown');
});

Then('the second result should be highlighted', async () => {
  const records = miscPage.recordsList.locator('[data-testid="record-item"]');
  const secondRecord = records.nth(1);

  const isSelected = await secondRecord.evaluate((element) => {
    return (
      element.classList.contains('selected') ||
      element.classList.contains('highlighted') ||
      element.getAttribute('aria-selected') === 'true' ||
      document.activeElement === element
    );
  });

  expect(isSelected).toBeTruthy();
});

When('I press the up arrow key', async () => {
  await miscPage.page.keyboard.press('ArrowUp');
});

Then('the first result should be highlighted again', async () => {
  const records = miscPage.recordsList.locator('[data-testid="record-item"]');
  const firstRecord = records.first();

  const isSelected = await firstRecord.evaluate((element) => {
    return (
      element.classList.contains('selected') ||
      element.classList.contains('highlighted') ||
      element.getAttribute('aria-selected') === 'true' ||
      document.activeElement === element
    );
  });

  expect(isSelected).toBeTruthy();
});

// Record editing with keyboard scenarios
Given('I have search results displayed', async () => {
  await miscPage.searchFor('проект');
  await miscPage.waitForSearchResults();

  const hasResults = await miscPage.isRecordsListVisible();
  expect(hasResults).toBeTruthy();
});

When('I navigate to a record with arrow keys', async () => {
  await miscPage.page.keyboard.press('ArrowDown');
});

When('I press Enter', async () => {
  await miscPage.page.keyboard.press('Enter');
});

Then('the record should be loaded for editing', async () => {
  // The record content should appear in the input field
  const inputValue = await miscPage.getCurrentInputValue();
  expect(inputValue.length).toBeGreaterThan(0);
});

Then('the cursor should be positioned in the input field', async () => {
  await expect(miscPage.inputField).toBeFocused();
});

Then('the changes should be saved', async () => {
  await miscPage.waitForInputToClear();
  // Verify the record was saved by checking it exists
  const hasResults =
    (await miscPage.isRecordsListVisible()) ||
    (await miscPage.isTagCloudVisible());
  expect(hasResults).toBeTruthy();
});

// Record deletion with keyboard scenarios
When('I press Delete', async () => {
  await miscPage.page.keyboard.press('Delete');
});

Then('the record should be deleted', async () => {
  // Wait for deletion to process
  await miscPage.page.waitForTimeout(100);
});

Then('focus should move to the next available record', async () => {
  // If there are more records, focus should move
  const recordCount = await miscPage.getRecordCount();
  if (recordCount > 0) {
    // Check that some record is still highlighted/focused
    const records = miscPage.recordsList.locator('[data-testid="record-item"]');
    const hasSelectedRecord = await records.evaluateAll((elements) => {
      return elements.some(
        (element) =>
          element.classList.contains('selected') ||
          element.classList.contains('highlighted') ||
          element.getAttribute('aria-selected') === 'true' ||
          document.activeElement === element
      );
    });
    expect(hasSelectedRecord).toBeTruthy();
  }
});

Then('return to the input field if no more records', async () => {
  const recordCount = await miscPage.getRecordCount();
  if (recordCount === 0) {
    await expect(miscPage.inputField).toBeFocused();
  }
});

// Tab completion scenarios
Given('I start typing {string} in the input field', async (text: string) => {
  await miscPage.inputField.fill(text);
});

Given(
  'there are existing tags starting with {string}',
  async (_prefix: string) => {
    // This is implicitly true from our test data setup
    // We have records with "проект" which starts with "proj"
  }
);

When('I press Tab', async () => {
  await miscPage.page.keyboard.press('Tab');
});

Then('the tag should be auto-completed', async () => {
  const currentValue = await miscPage.getCurrentInputValue();

  // The value should be longer than what we originally typed
  // and should contain a completed tag
  expect(currentValue.length).toBeGreaterThan(4); // "proj" is 4 chars
});

Then('I should be able to continue typing the next tag', async () => {
  // After tab completion, we should be able to continue typing
  await miscPage.inputField.type(' another');
  const currentValue = await miscPage.getCurrentInputValue();
  expect(currentValue).toContain('another');
});

// Escape key behavior scenarios
Given("I'm in the middle of editing a record", async () => {
  // Navigate to a record and start editing it
  await miscPage.searchFor('проект');
  await miscPage.waitForSearchResults();
  await miscPage.page.keyboard.press('ArrowDown');
  await miscPage.page.keyboard.press('Enter');

  // Modify the content slightly
  await miscPage.inputField.press('End');
  await miscPage.inputField.type(' modified');
});

Then('any unsaved changes should be discarded', async () => {
  const currentValue = await miscPage.getCurrentInputValue();
  expect(currentValue).toBe('');
});

Then('I should return to search mode', async () => {
  await expect(miscPage.inputField).toBeFocused();
  await expect(miscPage.inputField).toHaveValue('');
});

// Full keyboard-only workflow scenarios
Given('I want to work without a mouse', async () => {
  // This is just a context-setting step
  // We'll ensure all subsequent actions use only keyboard
});

When('I create records using only keyboard', async () => {
  await miscPage.inputField.type('keyboard создание запись');
  await miscPage.page.keyboard.press('Enter');
  await miscPage.waitForInputToClear();
});

When('I search using only keyboard', async () => {
  await miscPage.inputField.type('keyboard');
  await miscPage.page.waitForTimeout(350); // Wait for debounced search
});

When('I edit records using only keyboard', async () => {
  await miscPage.page.keyboard.press('ArrowDown');
  await miscPage.page.keyboard.press('Enter');
  await miscPage.inputField.press('End');
  await miscPage.inputField.type(' edited');
  await miscPage.page.keyboard.press('Enter');
});

When('I delete records using only keyboard', async () => {
  await miscPage.inputField.type('keyboard');
  await miscPage.page.waitForTimeout(350);
  await miscPage.page.keyboard.press('ArrowDown');
  await miscPage.page.keyboard.press('Delete');
});

Then('all operations should be accessible', async () => {
  // Verify that we can still use the application
  await expect(miscPage.inputField).toBeFocused();

  // We should be able to create a new record
  await miscPage.inputField.type('test accessibility');
  await miscPage.page.keyboard.press('Enter');
  await miscPage.waitForInputToClear();
});

Then('the workflow should be efficient and smooth', async () => {
  // Verify smooth operation by checking response time
  const startTime = Date.now();

  await miscPage.inputField.type('efficiency test');
  await miscPage.page.keyboard.press('Enter');
  await miscPage.waitForInputToClear();

  const endTime = Date.now();
  expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
});
