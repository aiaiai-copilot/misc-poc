import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';

test.describe('Keyboard Navigation', () => {
  let miscPage: MiscPage;

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();

    // Create test data
    await miscPage.createRecord('проект frontend React');
    await miscPage.createRecord('проект backend Node.js');
    await miscPage.createRecord('встреча команда');
  });

  test('Basic keyboard shortcuts', async ({ page: _page }) => {
    // Given the input field is focused
    await expect(miscPage.inputField).toBeFocused();

    // When I type "test record" and press Enter
    await miscPage.createRecord('test record');

    // Then a new record should be created
    const records = await miscPage.getVisibleRecords();
    expect(records.some(record => record.includes('test record'))).toBe(true);

    // When I press Escape
    await miscPage.inputField.fill('some text');
    await miscPage.clearInputWithEscape();

    // Then the input field should be cleared
    await expect(miscPage.inputField).toHaveValue('');
  });

  test('Search result navigation', async ({ page: _page }) => {
    // Given I search for "проект" and see multiple results
    await miscPage.searchFor('проект');
    await miscPage.waitForSearchResults();

    const initialRecordCount = await miscPage.getRecordCount();
    expect(initialRecordCount).toBeGreaterThan(1);

    // When I navigate with arrow keys
    await miscPage.navigateWithArrows('down');

    // Verify navigation is working (exact behavior depends on implementation)
    // We test that the navigation commands execute without error
    await miscPage.navigateWithArrows('down');
    await miscPage.navigateWithArrows('up');

    // The input field should still have the search term
    await expect(miscPage.inputField).toHaveValue('проект');
  });

  test('Record editing with keyboard', async ({ page: _page }) => {
    // Search for a record
    await miscPage.searchFor('frontend');
    await miscPage.waitForSearchResults();

    // Select and edit the record
    await miscPage.selectRecordWithKeyboard(0);
    await miscPage.editSelectedRecord();

    // Verify the record content is loaded for editing
    const inputValue = await miscPage.getCurrentInputValue();
    expect(inputValue).toContain('frontend');
  });

  test('Record deletion with keyboard', async ({ page: _page }) => {

    // Search for a specific record
    await miscPage.searchFor('встреча');
    await miscPage.waitForSearchResults();

    // Select and delete the record
    await miscPage.selectRecordWithKeyboard(0);
    await miscPage.deleteSelectedRecord();

    // Verify the record was deleted
    await miscPage.searchFor('встреча');
    await miscPage.waitForSearchResults();

    const hasNoResults = await miscPage.hasNoResults();
    expect(hasNoResults).toBe(true);
  });
});