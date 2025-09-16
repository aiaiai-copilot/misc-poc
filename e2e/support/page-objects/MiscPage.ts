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
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
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

  // Import/Export functionality
  async accessImportExport(): Promise<void> {
    // This might be in a settings menu or similar
    const settingsButton = this.page.locator('[data-testid="settings-button"]');
    await settingsButton.click();
  }

  async exportData(): Promise<void> {
    const exportButton = this.page.locator('[data-testid="export-button"]');
    await exportButton.click();
  }

  async importData(filePath: string): Promise<void> {
    const importInput = this.page.locator('[data-testid="import-input"]');
    await importInput.setInputFiles(filePath);
  }

  async confirmImport(): Promise<void> {
    const confirmButton = this.page.locator('[data-testid="confirm-import"]');
    await confirmButton.click();
  }
}
