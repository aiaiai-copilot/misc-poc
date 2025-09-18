import { Page, Locator, expect } from '@playwright/test';

export class MiscPage {
  readonly page: Page;
  readonly inputField: Locator;
  readonly recordsList: Locator;
  readonly tagCloud: Locator;
  readonly noResultsMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.inputField = page
      .locator('[data-testid="main-input"]')
      .or(page.locator('input[type="text"]'))
      .first();
    this.recordsList = page.locator('[data-testid="records-list"]');
    this.tagCloud = page.locator('[data-testid="tag-cloud"]');
    this.noResultsMessage = page.locator('[data-testid="no-results"]');
    this.loadingIndicator = page.locator('[data-testid="loading"]');
  }

  async goto(): Promise<void> {
    try {
      console.log('Navigating to base URL...');
      await this.page.goto('/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      console.log('Page loaded, waiting for network idle...');
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('Network idle achieved');

      // Wait for the input field to be available
      console.log('Waiting for input field to be available...');
      await this.inputField.waitFor({ state: 'visible', timeout: 10000 });
      console.log('Input field is visible');
    } catch (error) {
      console.error('Error during page navigation:', error);

      // Debug: Check if page loaded at all
      const url = this.page.url();
      const title = await this.page.title().catch(() => 'Unable to get title');
      console.log(`Current URL: ${url}`);
      console.log(`Page title: ${title}`);

      // Check if any elements are visible
      const body = await this.page
        .locator('body')
        .isVisible()
        .catch(() => false);
      console.log(`Body visible: ${body}`);

      throw error;
    }
  }

  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async createRecord(content: string): Promise<void> {
    await this.inputField.fill(content);
    await this.inputField.press('Enter');
    await this.waitForInputToClear();
  }

  async searchFor(query: string): Promise<void> {
    await this.inputField.fill(query);
    // Wait for debounced search
    await this.page.waitForTimeout(350);
  }

  async waitForInputToClear(): Promise<void> {
    await expect(this.inputField).toHaveValue('');
  }

  async waitForResults(): Promise<void> {
    // Wait for either results list or tag cloud to appear
    await Promise.race([
      this.recordsList.waitFor({ state: 'visible' }),
      this.tagCloud.waitFor({ state: 'visible' }),
      this.noResultsMessage.waitFor({ state: 'visible' }),
    ]);
  }

  async getRecordCount(): Promise<number> {
    const isListVisible = await this.recordsList.isVisible();
    if (isListVisible) {
      const records = this.recordsList.locator('[data-testid="record-item"]');
      return await records.count();
    }
    return 0;
  }

  async getVisibleRecords(): Promise<string[]> {
    const records = this.recordsList.locator('[data-testid="record-item"]');
    const count = await records.count();
    const recordTexts = [];

    for (let i = 0; i < count; i++) {
      const text = await records.nth(i).textContent();
      recordTexts.push(text?.trim() || '');
    }

    return recordTexts;
  }

  async clickRecord(index: number): Promise<void> {
    const records = this.recordsList.locator('[data-testid="record-item"]');
    await records.nth(index).click();
  }

  async navigateWithArrows(
    direction: 'up' | 'down',
    times: number = 1
  ): Promise<void> {
    const key = direction === 'up' ? 'ArrowUp' : 'ArrowDown';
    for (let i = 0; i < times; i++) {
      await this.page.keyboard.press(key);
    }
  }

  async selectRecordWithKeyboard(index: number): Promise<void> {
    // Navigate to the record using arrow keys
    await this.navigateWithArrows('down', index + 1);
  }

  async deleteSelectedRecord(): Promise<void> {
    await this.page.keyboard.press('Delete');
  }

  async editSelectedRecord(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  async clearInputWithEscape(): Promise<void> {
    // Press Escape multiple times to clear all tags (the component removes one tag per Escape)
    let attempts = 0;
    const maxAttempts = 10; // Safety limit

    while (attempts < maxAttempts) {
      const currentValue = await this.inputField.inputValue();
      if (!currentValue.trim()) {
        break; // Input is already clear
      }

      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(100); // Small delay for the state update
      attempts++;
    }
  }

  async tryTabCompletion(): Promise<void> {
    await this.page.keyboard.press('Tab');
  }

  async isTagCloudVisible(): Promise<boolean> {
    return await this.tagCloud.isVisible();
  }

  async isRecordsListVisible(): Promise<boolean> {
    return await this.recordsList.isVisible();
  }

  async getTagCloudTags(): Promise<string[]> {
    const tags = this.tagCloud.locator('[data-testid="tag-item"]');
    const count = await tags.count();
    const tagTexts = [];

    for (let i = 0; i < count; i++) {
      const text = await tags.nth(i).textContent();
      tagTexts.push(text?.trim() || '');
    }

    return tagTexts;
  }

  async clickTagInCloud(tagText: string): Promise<void> {
    const tag = this.tagCloud.locator('[data-testid="tag-item"]', {
      hasText: tagText,
    });
    await tag.click();
  }

  async getPlaceholderText(): Promise<string> {
    return (await this.inputField.getAttribute('placeholder')) || '';
  }

  async getCurrentInputValue(): Promise<string> {
    return await this.inputField.inputValue();
  }

  async waitForSearchResults(): Promise<void> {
    // Wait for debounced search to complete
    await this.page.waitForTimeout(350);
    await this.waitForResults();
  }

  async hasNoResults(): Promise<boolean> {
    return await this.noResultsMessage.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return await this.loadingIndicator.isVisible();
  }

  // Import/Export functionality (MinimalisticToolbar)
  async accessImportExport(): Promise<void> {
    // Toolbar is now integrated into the input field, no need to access separately
    // The export/import buttons are always visible in the input area
  }

  async exportData(): Promise<void> {
    // Click the hamburger menu button first
    const menuButton = this.page.locator('button[title="Menu"]');
    await menuButton.click();

    // Then click the Export menu item
    const exportItem = this.page.locator('text=Export');
    await exportItem.click();
  }

  async importData(filePath: string): Promise<void> {
    // Click the hamburger menu button first
    const menuButton = this.page.locator('button[title="Menu"]');
    await menuButton.click();

    // Then click the Import menu item to trigger file picker
    const importItem = this.page.locator('text=Import');
    await importItem.click();

    // The hidden file input should now be accessible
    const importInput = this.page.locator('input[type="file"][accept=".json"]');
    await importInput.setInputFiles(filePath);
  }

  async confirmImport(): Promise<void> {
    // With MinimalisticToolbar, import is automatic after file selection
    // No confirmation dialog needed
  }

  // Additional utility methods for E2E tests
  async typeInInput(text: string): Promise<void> {
    await this.inputField.fill(text);
  }

  async clearInput(): Promise<void> {
    await this.inputField.clear();
  }
}
