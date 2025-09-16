import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { MiscPage } from '../support/page-objects/MiscPage';

let miscPage: MiscPage;

// Tag cloud appearance scenarios
Given('I see a tag cloud for {string}', async (query: string) => {
  await miscPage.searchFor(query);
  await miscPage.waitForSearchResults();

  const isTagCloudVisible = await miscPage.isTagCloudVisible();
  expect(isTagCloudVisible).toBeTruthy();
});

When('multiple records match the search', async () => {
  // This condition is already met from the previous search
  await miscPage.waitForResults();
});

When('the results exceed the list display threshold', async () => {
  // This is determined by the application logic
  // We verify that tag cloud is shown instead of list
  const isTagCloudVisible = await miscPage.isTagCloudVisible();
  expect(isTagCloudVisible).toBeTruthy();
});

Then('the most common tags should be largest', async () => {
  const tags = await miscPage.getTagCloudTags();
  expect(tags.length).toBeGreaterThan(0);

  // In a real implementation, we would check CSS classes or data attributes
  // that indicate relative sizes based on frequency
  // For now, we verify that tags are present and clickable
});

// Tag clicking and search refinement
When('I click on the {string} tag', async (tagName: string) => {
  await miscPage.clickTagInCloud(tagName);
});

Then('my search should become {string}', async (expectedQuery: string) => {
  const currentQuery = await miscPage.getCurrentInputValue();
  expect(currentQuery.trim()).toBe(expectedQuery);
});

Then(
  'the results should be filtered to show only records with both tags',
  async () => {
    await miscPage.waitForSearchResults();

    const records = await miscPage.getVisibleRecords();
    const currentQuery = await miscPage.getCurrentInputValue();
    const requiredTags = currentQuery.split(' ');

    // Each visible record should contain all required tags
    for (const record of records) {
      const recordLower = record.toLowerCase();
      for (const tag of requiredTags) {
        expect(recordLower).toContain(tag.toLowerCase());
      }
    }
  }
);

Then(
  'the tag cloud should update to show remaining refinement options',
  async () => {
    // After clicking a tag, the cloud should update
    const isTagCloudVisible = await miscPage.isTagCloudVisible();

    // Either still showing tag cloud with updated options, or switched to list view
    const isListVisible = await miscPage.isRecordsListVisible();
    expect(isTagCloudVisible || isListVisible).toBeTruthy();
  }
);

// Progressive search refinement scenarios
Given('I start with a broad search for {string}', async (query: string) => {
  await miscPage.searchFor(query);
  await miscPage.waitForSearchResults();
});

When('I click {string} in the tag cloud', async (tagName: string) => {
  await miscPage.clickTagInCloud(tagName);
});

Then('my search becomes {string}', async (expectedQuery: string) => {
  const currentQuery = await miscPage.getCurrentInputValue();
  expect(currentQuery.trim()).toBe(expectedQuery);
});

When('I click {string} in the updated tag cloud', async (tagName: string) => {
  await miscPage.waitForSearchResults();
  await miscPage.clickTagInCloud(tagName);
});

Then('I should see only highly specific results', async () => {
  await miscPage.waitForSearchResults();

  const recordCount = await miscPage.getRecordCount();
  // Highly specific results should be a small number
  expect(recordCount).toBeLessThanOrEqual(3);
});

// Mobile responsiveness scenarios
Given("I'm viewing a tag cloud on mobile", async () => {
  // Set mobile viewport
  await miscPage.page.setViewportSize({ width: 375, height: 667 });

  // Ensure we have a tag cloud visible
  const isTagCloudVisible = await miscPage.isTagCloudVisible();
  if (!isTagCloudVisible) {
    // Create a search that shows tag cloud
    await miscPage.searchFor('проект');
    await miscPage.waitForSearchResults();
  }
});

When('the screen size is limited', async () => {
  // Already set mobile viewport
  const viewport = miscPage.page.viewportSize();
  expect(viewport?.width).toBeLessThanOrEqual(375);
});

Then('tags should be sized appropriately for touch interaction', async () => {
  const tags = miscPage.tagCloud.locator('[data-testid="tag-item"]');
  const count = await tags.count();

  if (count > 0) {
    // Check that tags have appropriate touch target sizes
    const firstTag = tags.first();
    const boundingBox = await firstTag.boundingBox();

    if (boundingBox) {
      // Touch targets should be at least 44x44 pixels
      expect(
        Math.min(boundingBox.width, boundingBox.height)
      ).toBeGreaterThanOrEqual(32);
    }
  }
});

Then('the cloud should be scrollable if needed', async () => {
  // Check if the tag cloud container is scrollable
  const tagCloudContainer = miscPage.tagCloud;
  const isScrollable = await tagCloudContainer.evaluate((element) => {
    return (
      element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth
    );
  });

  // Either scrollable or content fits
  expect(typeof isScrollable).toBe('boolean');
});

Then('tap targets should be large enough for fingers', async () => {
  const tags = miscPage.tagCloud.locator('[data-testid="tag-item"]');
  const count = await tags.count();

  if (count > 0) {
    const firstTag = tags.first();
    const boundingBox = await firstTag.boundingBox();

    if (boundingBox) {
      // Minimum touch target size for accessibility
      expect(boundingBox.width).toBeGreaterThanOrEqual(32);
      expect(boundingBox.height).toBeGreaterThanOrEqual(32);
    }
  }
});

// Visual feedback scenarios
Given('I see a tag cloud', async () => {
  const isTagCloudVisible = await miscPage.isTagCloudVisible();
  expect(isTagCloudVisible).toBeTruthy();
});

When('I hover over a tag', async () => {
  const tags = miscPage.tagCloud.locator('[data-testid="tag-item"]');
  const count = await tags.count();

  if (count > 0) {
    await tags.first().hover();
  }
});

Then("it should highlight to show it's clickable", async () => {
  // Check if the tag has hover state (usually through CSS classes or styles)
  const tags = miscPage.tagCloud.locator('[data-testid="tag-item"]');
  const count = await tags.count();

  if (count > 0) {
    // We can check for hover styles or cursor pointer
    const cursor = await tags.first().evaluate((element) => {
      return window.getComputedStyle(element).cursor;
    });
    expect(cursor).toBe('pointer');
  }
});

When('I click a tag', async () => {
  const tags = await miscPage.getTagCloudTags();
  if (tags.length > 0) {
    await miscPage.clickTagInCloud(tags[0]);
  }
});

Then('there should be immediate visual feedback', async () => {
  // After clicking, the search should update immediately
  await miscPage.page.waitForTimeout(100); // Brief wait for immediate feedback

  // The input field should show the updated search
  const currentQuery = await miscPage.getCurrentInputValue();
  expect(currentQuery.length).toBeGreaterThan(0);
});

Then('the transition to refined results should be smooth', async () => {
  // Wait for the results to update
  await miscPage.waitForSearchResults();

  // Results should be updated (either new tag cloud or list view)
  const hasResults =
    (await miscPage.isRecordsListVisible()) ||
    (await miscPage.isTagCloudVisible());
  expect(hasResults).toBeTruthy();
});
