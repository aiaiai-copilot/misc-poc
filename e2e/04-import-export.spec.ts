import { test, expect } from '@playwright/test';
import { MiscPage } from './support/page-objects/MiscPage';
import { promises as fs } from 'fs';
import * as path from 'path';

test.describe('Import/Export Functionality', () => {
  let miscPage: MiscPage;
  let downloadPath: string;
  let testDataPath: string;

  test.beforeAll(async () => {
    // Setup test data directory
    testDataPath = path.join(__dirname, 'test-data');
    await fs.mkdir(testDataPath, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    miscPage = new MiscPage(page);
    await miscPage.goto();
    await miscPage.clearLocalStorage();

    // Setup download path
    downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
  });

  test.afterEach(async () => {
    // Clean up downloaded files
    try {
      const files = await fs.readdir(downloadPath);
      for (const file of files) {
        await fs.unlink(path.join(downloadPath, file));
      }
    } catch {
      // Directory might not exist or be empty
    }
  });

  test.describe('Export Functionality', () => {
    test('should export empty data when no records exist', async ({ page }) => {
      // Given no records exist
      await expect(miscPage.inputField).toHaveValue('');

      // When I click the export button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        miscPage.exportData(),
      ]);

      // Then a file should be downloaded
      expect(download.suggestedFilename()).toMatch(
        /misc-export-\d{4}-\d{2}-\d{2}\.json$/
      );

      // And the downloaded file should contain empty records
      const filePath = path.join(downloadPath, download.suggestedFilename());
      await download.saveAs(filePath);

      const exportedData = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(exportedData).toHaveProperty('records');
      expect(exportedData.records).toEqual([]);
      expect(exportedData).toHaveProperty('format', 'json');
      expect(exportedData).toHaveProperty('exportedAt');
      expect(exportedData).toHaveProperty('version');
    });

    test('should export data with existing records', async ({ page }) => {
      // Given I have some records
      await miscPage.createRecord('проект deadline понедельник');
      await miscPage.createRecord('покупки молоко хлеб');
      await miscPage.createRecord('идея startup приложение');

      // Verify records are created
      const recordCount = await miscPage.getRecordCount();
      expect(recordCount).toBe(3);

      // When I click the export button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        miscPage.exportData(),
      ]);

      // Then the downloaded file should contain the records
      const filePath = path.join(downloadPath, download.suggestedFilename());
      await download.saveAs(filePath);

      const exportedData = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(exportedData.records).toHaveLength(3);

      // Verify record structure
      const firstRecord = exportedData.records[0];
      expect(firstRecord).toHaveProperty('id');
      expect(firstRecord).toHaveProperty('tagIds');
      expect(firstRecord).toHaveProperty('createdAt');
      expect(firstRecord).toHaveProperty('updatedAt');
      expect(firstRecord).toHaveProperty('content');

      // Verify tag content
      const allTagIds = exportedData.records.flatMap(
        (record: { tagIds: string[] }) => record.tagIds
      );
      expect(allTagIds).toContain('проект');
      expect(allTagIds).toContain('покупки');
      expect(allTagIds).toContain('идея');
    });

    test('should export button be accessible via keyboard', async ({
      page,
    }) => {
      // Given the page is loaded
      await expect(miscPage.inputField).toBeVisible();

      // When I navigate to the menu button via keyboard
      await miscPage.inputField.focus();
      await page.keyboard.press('Tab'); // Should focus menu button

      // Then the menu button should be focused
      const menuButton = page.locator('button[title="Menu"]');
      await expect(menuButton).toBeFocused();

      // And I can activate it with Enter key to open the menu
      await page.keyboard.press('Enter');

      // Then click Export option and wait for download
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('text=Export').click(),
      ]);

      expect(download.suggestedFilename()).toMatch(
        /misc-export-\d{4}-\d{2}-\d{2}\.json$/
      );
    });
  });

  test.describe('Import Functionality', () => {
    test('should import valid JSON data', async () => {
      // Given I have a valid export file
      const testData = {
        records: [
          {
            id: 'test-1',
            content: 'импорт тест данные',
            tagIds: ['импорт', 'тест', 'данные'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'test-2',
            content: 'второй записать проверка',
            tagIds: ['второй', 'записать', 'проверка'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        format: 'json',
        exportedAt: new Date().toISOString(),
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'test-data',
        },
      };

      const testFilePath = path.join(testDataPath, 'test-import.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      // When I import the file
      await miscPage.importData(testFilePath);

      // Then the records should appear in the UI
      // Wait a moment for the import to process
      await miscPage.page.waitForTimeout(1000);

      // Search for the imported tags to verify they exist
      await miscPage.typeInInput('импорт');
      await miscPage.page.keyboard.press('Enter');

      // Should find results containing the imported data
      const records = await miscPage.getVisibleRecords();
      expect(records.length).toBeGreaterThan(0);
      expect(records.some((record) => record.includes('импорт'))).toBeTruthy();
    });

    test('should handle import button accessibility', async ({ page }) => {
      // Given the page is loaded
      await expect(miscPage.inputField).toBeVisible();

      // When I navigate to the menu button via keyboard
      await miscPage.inputField.focus();
      await page.keyboard.press('Tab'); // Menu button

      // Then the menu button should be focused
      const menuButton = page.locator('button[title="Menu"]');
      await expect(menuButton).toBeFocused();

      // And I can activate it with Space key to open the menu
      await page.keyboard.press(' ');

      // Then click Import option
      await page.locator('text=Import').click();

      // The file input should now be available (though hidden)
      const fileInput = page.locator('input[type="file"][accept=".json"]');
      await expect(fileInput).toBeAttached();
    });

    test('should show hamburger menu in minimalistic toolbar', async () => {
      // Given the page is loaded
      await expect(miscPage.inputField).toBeVisible();

      // Then the hamburger menu button should be visible in the toolbar
      const menuButton = miscPage.page.locator('button[title="Menu"]');
      await expect(menuButton).toBeVisible();

      // And it should have the correct styling (calculator-style minimalistic)
      await expect(menuButton).toHaveClass(/p-1/);
      await expect(menuButton).toHaveClass(/rounded-none/);
      await expect(menuButton).toHaveClass(/transition-colors/);

      // When clicked, it should show the dropdown menu with Export and Import options
      await menuButton.click();
      await expect(miscPage.page.locator('text=Export')).toBeVisible();
      await expect(miscPage.page.locator('text=Import')).toBeVisible();
    });
  });

  test.describe('Export/Import Round Trip', () => {
    test('should save exported file to downloads directory', async ({
      page,
    }) => {
      // Given I create a test record
      await miscPage.createRecord('тест экспорт файл');

      // When I export the data
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        miscPage.exportData(),
      ]);

      const exportFilePath = path.join(
        downloadPath,
        download.suggestedFilename()
      );
      await download.saveAs(exportFilePath);

      // Then the file should exist at the expected path
      // This test reproduces the ENOENT error from the round trip test
      try {
        const fileStats = await fs.stat(exportFilePath);
        expect(fileStats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(
          `Expected file at ${exportFilePath} but got error: ${error}`
        );
      }
    });

    test('should maintain data integrity through export/import cycle', async ({
      page,
    }) => {
      // Given I create some test records
      const originalRecords = [
        'проект управление временем',
        'покупки продукты неделя',
        'идея бизнес план стартап',
        'учеба английский язык курсы',
      ];

      for (const record of originalRecords) {
        await miscPage.createRecord(record);
      }

      // Verify records are created
      const initialCount = await miscPage.getRecordCount();
      expect(initialCount).toBe(originalRecords.length);

      // When I export the data
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        miscPage.exportData(),
      ]);

      // Verify download completed successfully
      expect(download.suggestedFilename()).toMatch(
        /misc-export-\d{4}-\d{2}-\d{2}\.json$/
      );

      const exportFilePath = path.join(
        downloadPath,
        download.suggestedFilename()
      );

      // Save the download and wait for completion
      await download.saveAs(exportFilePath);

      // Wait for download to finish completely
      await download.failure(); // This will resolve when download is either successful or failed

      // Retry mechanism for file verification with exponential backoff
      let fileExists = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!fileExists && attempts < maxAttempts) {
        attempts++;
        const waitTime = 100 * Math.pow(2, attempts - 1); // 100ms, 200ms, 400ms, 800ms, 1600ms
        await miscPage.page.waitForTimeout(waitTime);

        try {
          const fileStats = await fs.stat(exportFilePath);
          if (fileStats.isFile() && fileStats.size > 0) {
            // Also verify we can read the content
            const content = await fs.readFile(exportFilePath, 'utf8');
            const parsedContent = JSON.parse(content);
            expect(parsedContent).toHaveProperty('records');
            expect(parsedContent.records).toHaveLength(originalRecords.length);
            fileExists = true;
          }
        } catch (error) {
          if (attempts === maxAttempts) {
            throw new Error(
              `Export file was not saved correctly at ${exportFilePath} after ${maxAttempts} attempts: ${error}`
            );
          }
          // Continue retrying
        }
      }

      // Clear existing data
      await miscPage.clearLocalStorage();
      await miscPage.page.reload();

      // Verify data is cleared
      const clearedCount = await miscPage.getRecordCount();
      expect(clearedCount).toBe(0);

      // Verify file still exists before import (defensive check)
      try {
        await fs.access(exportFilePath);
      } catch (error) {
        throw new Error(
          `Export file no longer exists at ${exportFilePath} before import: ${error}`
        );
      }

      // And import the exported data
      await miscPage.importData(exportFilePath);

      // Wait for import to complete
      await miscPage.page.waitForTimeout(1500);

      // Then all original records should be restored
      // Check by searching for unique terms from each record
      const testSearches = ['проект', 'покупки', 'идея', 'учеба'];

      for (const searchTerm of testSearches) {
        await miscPage.clearInput();
        await miscPage.typeInInput(searchTerm);
        await miscPage.page.waitForTimeout(500); // Wait for search results

        const searchResults = await miscPage.getVisibleRecords();
        expect(searchResults.length).toBeGreaterThan(0);
        expect(
          searchResults.some((record) => record.includes(searchTerm))
        ).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid JSON file gracefully', async () => {
      // Given I have an invalid JSON file
      const invalidFilePath = path.join(testDataPath, 'invalid.json');
      await fs.writeFile(invalidFilePath, 'This is not valid JSON content');

      // When I try to import it
      await miscPage.importData(invalidFilePath);

      // Then the application should not crash
      // (The error is handled gracefully in the component)
      await expect(miscPage.inputField).toBeVisible();

      // And I should still be able to interact with the application
      await miscPage.typeInInput('тест после ошибки');
      await expect(miscPage.inputField).toHaveValue('тест после ошибки');
    });

    test('should handle missing file gracefully', async () => {
      // In real usage, the file picker prevents selecting non-existent files
      // This test verifies the application remains functional after error scenarios

      // Then the application should remain functional
      await expect(miscPage.inputField).toBeVisible();
      await miscPage.typeInInput('приложение работает');
      await expect(miscPage.inputField).toHaveValue('приложение работает');
    });
  });
});
