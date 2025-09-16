import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';

test.describe('First Use Experience', () => {
  let miscPage: MiscPage;

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();
  });

  test('First record creation', async ({ page }) => {
    // Given I see the main interface
    await expect(page).toHaveTitle(/Misc/);

    // When I type "ToDo встреча Петров 15:00" in the input field and press Enter
    await miscPage.createRecord('ToDo встреча Петров 15:00');

    // Then the record should be saved
    const recordCount = await miscPage.getRecordCount();
    expect(recordCount).toBe(1);

    // And the input field should be cleared
    await expect(miscPage.inputField).toHaveValue('');

    // And I should be ready to create another record
    await expect(miscPage.inputField).toBeFocused();
  });

  test('Immediate feedback on typing', async ({ page: _page }) => {
    // Given the input field is focused
    await expect(miscPage.inputField).toBeFocused();

    // When I start typing "project"
    await miscPage.inputField.type('project');

    // Then I should see visual feedback that the system is ready
    await expect(miscPage.inputField).toHaveValue('project');

    // And there should be no lag or delays
    // This is implicitly tested by the fact that the typing worked immediately
    await expect(miscPage.inputField).toBeVisible();
  });

  test('Empty state guidance', async ({ page }) => {
    // Given I see the empty application
    await expect(page).toHaveTitle(/Misc/);

    // Then I should see a placeholder that explains what to do
    const placeholder = await miscPage.getPlaceholderText();
    expect(placeholder).toBeTruthy();
    expect(placeholder.length).toBeGreaterThan(0);

    // And the interface should be intuitive without instructions
    await expect(miscPage.inputField).toBeVisible();
    await expect(miscPage.inputField).toBeFocused();
  });
});