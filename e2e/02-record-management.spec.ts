import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';

test.describe('Record Management', () => {
  let miscPage: MiscPage;

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();
  });

  test('Creating multiple records', async ({ page: _page }) => {
    // Given the input field is empty
    await expect(miscPage.inputField).toHaveValue('');

    // When I create multiple records
    await miscPage.createRecord('проект deadline понедельник');
    await miscPage.createRecord('покупки молоко хлеб');
    await miscPage.createRecord('идея startup мобильное приложение');

    // Then I should have 3 records in total
    const recordCount = await miscPage.getRecordCount();
    expect(recordCount).toBe(3);

    // And each record should be saved with its original tag order
    const records = await miscPage.getVisibleRecords();
    expect(records).toContain('проект deadline понедельник');
    expect(records).toContain('покупки молоко хлеб');
    expect(records).toContain('идея startup мобильное приложение');
  });

  test('Editing an existing record', async ({ page: _page }) => {
    // Given I have a record
    await miscPage.createRecord('встреча Петров 15:00');

    // When I search for it
    await miscPage.searchFor('встреча');
    await miscPage.waitForSearchResults();

    // And I click on the record
    await miscPage.clickRecord(0);

    // Then the record content should load in the input field
    await expect(miscPage.inputField).toHaveValue('встреча Петров 15:00');

    // When I modify it
    await miscPage.inputField.clear();
    await miscPage.createRecord('встреча Петров 16:00 перенос');

    // Then the record should be updated
    await miscPage.searchFor('Петров');
    await miscPage.waitForSearchResults();

    const records = await miscPage.getVisibleRecords();
    expect(records.some(record => record.includes('16:00 перенос'))).toBe(true);
  });

  test('Deleting a record', async ({ page: _page }) => {
    // Given I have a record
    await miscPage.createRecord('старая задача');

    // When I search for it and delete it
    await miscPage.searchFor('старая');
    await miscPage.waitForSearchResults();
    await miscPage.selectRecordWithKeyboard(0);
    await miscPage.deleteSelectedRecord();

    // Then it should not appear in search results
    await miscPage.searchFor('старая');
    await miscPage.waitForSearchResults();

    const hasNoResults = await miscPage.hasNoResults();
    expect(hasNoResults).toBe(true);
  });

  test('Record uniqueness by tag set', async ({ page: _page }) => {
    // Given I have a record
    await miscPage.createRecord('проект дедлайн понедельник');

    let initialCount = await miscPage.getRecordCount();
    expect(initialCount).toBe(1);

    // When I try to create a duplicate with different order
    await miscPage.inputField.fill('понедельник проект дедлайн');
    await miscPage.inputField.press('Enter');

    // The input might not clear automatically for duplicate records,
    // so let's wait a moment and check the result
    await miscPage.page.waitForTimeout(500);

    // Then the system should recognize it as a duplicate
    const finalCount = await miscPage.getRecordCount();
    expect(finalCount).toBe(1); // No new record should be created

    // Check the existing record (behavior may vary - either keeps original order or updates to new order)
    const records = await miscPage.getVisibleRecords();
    // The app might either keep the original order or update to the new input order
    expect(records[0]).toMatch(/^(проект дедлайн понедельник|понедельник проект дедлайн)$/);
  });
});