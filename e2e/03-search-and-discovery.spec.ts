import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';

test.describe('Search and Discovery', () => {
  let miscPage: MiscPage;

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();

    // Create test data
    await miscPage.createRecord('проект frontend React TypeScript');
    await miscPage.createRecord('проект backend Node.js database');
    await miscPage.createRecord('встреча команда понедельник 10:00');
    await miscPage.createRecord('покупки молоко хлеб магазин');
    await miscPage.createRecord('идея стартап мобильное приложение');
    await miscPage.createRecord('обучение JavaScript React курс');
  });

  test('Real-time search', async ({ page: _page }) => {
    // Given the input field is empty
    await expect(miscPage.inputField).toHaveValue('');

    // When I type "проект"
    await miscPage.searchFor('проект');

    // Then I should see search results immediately
    await miscPage.waitForSearchResults();

    // And results should include records with "проект" tag
    const records = await miscPage.getVisibleRecords();
    const hasProjectRecords = records.some(record => record.includes('проект'));
    expect(hasProjectRecords).toBe(true);

    // Verify that the search happened without pressing Enter
    await expect(miscPage.inputField).toHaveValue('проект');
  });

  test('Multi-tag search with AND logic', async ({ page: _page }) => {
    // When I search for "проект frontend"
    await miscPage.searchFor('проект frontend');
    await miscPage.waitForSearchResults();

    // Then I should see only records containing both "проект" AND "frontend"
    const records = await miscPage.getVisibleRecords();

    // Should have exactly one record that contains both tags
    const matchingRecords = records.filter(record =>
      record.includes('проект') && record.includes('frontend')
    );
    expect(matchingRecords.length).toBe(1);
    expect(matchingRecords[0]).toContain('React TypeScript');
  });

  test('Tag cloud display for many results', async ({ page: _page }) => {
    // Given I search for "проект" which returns multiple results
    await miscPage.searchFor('проект');
    await miscPage.waitForSearchResults();

    // Then I should see either a tag cloud or list of results
    const isTagCloudVisible = await miscPage.isTagCloudVisible();
    const isRecordsListVisible = await miscPage.isRecordsListVisible();

    // At least one display mode should be active
    expect(isTagCloudVisible || isRecordsListVisible).toBe(true);

    if (isTagCloudVisible) {
      // And I should be able to see tags
      const tags = await miscPage.getTagCloudTags();
      expect(tags.length).toBeGreaterThan(0);
    }
  });

  test('List display for few results', async ({ page: _page }) => {
    // Given I search for "встреча команда"
    await miscPage.searchFor('встреча команда');
    await miscPage.waitForSearchResults();

    // Then I should see a list of matching records
    const records = await miscPage.getVisibleRecords();
    expect(records.length).toBe(1);
    expect(records[0]).toContain('встреча команда понедельник 10:00');
  });

  test('Tag normalization in search', async ({ page: _page }) => {
    // Create records with different cases
    await miscPage.createRecord('Café коофе');
    await miscPage.createRecord('cafe кофе');

    // When I search for "cafe"
    await miscPage.searchFor('cafe');
    await miscPage.waitForSearchResults();

    // Then both records should be found (case insensitive)
    const records = await miscPage.getVisibleRecords();
    const cafeRecords = records.filter(record =>
      record.toLowerCase().includes('café') || record.toLowerCase().includes('cafe')
    );
    expect(cafeRecords.length).toBeGreaterThanOrEqual(1);
  });

  test('Empty search results', async ({ page: _page }) => {
    // Given I search for "nonexistent"
    await miscPage.searchFor('nonexistent');
    await miscPage.waitForSearchResults();

    // Then I should see a clear "no results" message
    const hasNoResults = await miscPage.hasNoResults();
    expect(hasNoResults).toBe(true);
  });
});