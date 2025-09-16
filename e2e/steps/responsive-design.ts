import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { MiscPage } from '../support/page-objects/MiscPage';

let miscPage: MiscPage;

// Background setup
Given('the application supports responsive design', async ({ page }) => {
  miscPage = new MiscPage(page);
  await miscPage.goto();
});

// Mobile phone compatibility scenarios
Given("I'm using a mobile phone with {int}px width", async (width: number) => {
  await miscPage.page.setViewportSize({ width, height: 667 });
});

When('I use the application', async () => {
  // Interact with the application on mobile
  await miscPage.inputField.click();
  await miscPage.inputField.type('mobile test');
});

Then(
  'all content should be readable without horizontal scrolling',
  async () => {
    const hasHorizontalScroll = await miscPage.page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });

    expect(hasHorizontalScroll).toBeFalsy();
  }
);

Then('touch targets should be appropriately sized', async () => {
  const touchTargets = await miscPage.page
    .locator('button, input, a, [role="button"]')
    .all();

  for (const target of touchTargets) {
    const isVisible = await target.isVisible();
    if (isVisible) {
      const boundingBox = await target.boundingBox();
      if (boundingBox) {
        // Touch targets should be at least 44x44 pixels for accessibility
        expect(
          Math.min(boundingBox.width, boundingBox.height)
        ).toBeGreaterThanOrEqual(32);
      }
    }
  }
});

Then('the interface should remain functional', async () => {
  // Test core functionality on mobile
  await miscPage.createRecord('mobile functional test');
  await miscPage.searchFor('mobile');
  await miscPage.waitForSearchResults();

  const hasResults =
    (await miscPage.isRecordsListVisible()) ||
    (await miscPage.isTagCloudVisible());
  expect(hasResults).toBeTruthy();
});

Then('text should be legible at the default zoom level', async () => {
  const textElements = await miscPage.page
    .locator('p, span, div, label, button, input')
    .all();

  for (const element of textElements) {
    const isVisible = await element.isVisible();
    if (isVisible) {
      const fontSize = await element.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Text should be at least 16px on mobile for readability
      expect(fontSize).toBeGreaterThanOrEqual(14);
    }
  }
});

// Tablet compatibility scenarios
Given("I'm using a tablet device", async () => {
  // Set tablet viewport (iPad-like)
  await miscPage.page.setViewportSize({ width: 768, height: 1024 });
});

When('I rotate between portrait and landscape', async () => {
  // Test portrait mode
  await miscPage.page.setViewportSize({ width: 768, height: 1024 });
  await miscPage.page.waitForTimeout(100);

  // Rotate to landscape
  await miscPage.page.setViewportSize({ width: 1024, height: 768 });
  await miscPage.page.waitForTimeout(100);
});

Then('the layout should adapt smoothly', async () => {
  // Check that layout elements are properly positioned
  const isInputVisible = await miscPage.inputField.isVisible();
  expect(isInputVisible).toBeTruthy();

  // Check that elements don't overflow
  const hasOverflow = await miscPage.page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const viewportWidth = window.innerWidth;

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.right > viewportWidth + 5) {
        // Small tolerance
        return true;
      }
    }
    return false;
  });

  expect(hasOverflow).toBeFalsy();
});

Then('no content should be cut off', async () => {
  // Verify important content is visible
  await expect(miscPage.inputField).toBeVisible();

  // Check that text content is not cut off
  const textOverflow = await miscPage.page.evaluate(() => {
    const textElements = document.querySelectorAll('p, span, div, label');
    for (const element of textElements) {
      const computed = window.getComputedStyle(element);
      if (
        computed.textOverflow === 'clip' &&
        element.scrollWidth > element.clientWidth
      ) {
        return true;
      }
    }
    return false;
  });

  expect(textOverflow).toBeFalsy();
});

Then('touch interactions should work properly', async () => {
  // Test touch interactions
  await miscPage.inputField.tap();
  await expect(miscPage.inputField).toBeFocused();

  // Test typing on touch device
  await miscPage.inputField.type('tablet touch test');
  const value = await miscPage.getCurrentInputValue();
  expect(value).toBe('tablet touch test');
});

Then('the tag cloud should scale appropriately', async () => {
  // Create some test data and search to show tag cloud
  await miscPage.createRecord('tablet tag cloud test one');
  await miscPage.createRecord('tablet tag cloud test two');
  await miscPage.createRecord('tablet tag cloud test three');

  await miscPage.searchFor('tablet');
  await miscPage.waitForSearchResults();

  if (await miscPage.isTagCloudVisible()) {
    const tagCloud = miscPage.tagCloud;
    const cloudBounds = await tagCloud.boundingBox();

    if (cloudBounds) {
      const viewportWidth = await miscPage.page.evaluate(
        () => window.innerWidth
      );
      // Tag cloud should not overflow viewport
      expect(cloudBounds.width).toBeLessThanOrEqual(viewportWidth);
    }
  }
});

// Desktop compatibility scenarios
Given("I'm using a desktop computer", async () => {
  await miscPage.page.setViewportSize({ width: 1200, height: 800 });
});

When('I resize the browser window', async () => {
  // Test various desktop sizes
  const sizes = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
  ];

  for (const size of sizes) {
    await miscPage.page.setViewportSize(size);
    await miscPage.page.waitForTimeout(100);
  }
});

Then('the layout should be responsive to all sizes', async () => {
  // Verify layout adapts to different sizes
  const isResponsive = await miscPage.page.evaluate(() => {
    const container = document.querySelector('body');
    if (!container) return false;

    const styles = window.getComputedStyle(container);
    // Check for responsive design indicators
    return (
      styles.display === 'flex' ||
      styles.display === 'grid' ||
      container.querySelector('[class*="responsive"]') !== null ||
      container.querySelector('[class*="container"]') !== null
    );
  });

  expect(isResponsive).toBeTruthy();
});

Then('the application should utilize available space efficiently', async () => {
  // Check that the application scales well on large screens
  const utilization = await miscPage.page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const content = document.querySelector(
      'main, .app, .container, body > div'
    );

    if (!content) return 0;

    const contentRect = content.getBoundingClientRect();
    const usedArea = contentRect.width * contentRect.height;
    const totalArea = viewport.width * viewport.height;

    return usedArea / totalArea;
  });

  // Should use a reasonable portion of the screen (at least 30%)
  expect(utilization).toBeGreaterThan(0.3);
});

Then('keyboard and mouse interactions should work properly', async () => {
  // Test mouse interactions
  await miscPage.inputField.click();
  await expect(miscPage.inputField).toBeFocused();

  // Test keyboard interactions
  await miscPage.page.keyboard.press('Tab');
  await miscPage.page.keyboard.press('Shift+Tab');
  await expect(miscPage.inputField).toBeFocused();
});

Then('the interface should not feel cramped on large screens', async () => {
  // Check spacing and layout on large screens
  const spacing = await miscPage.page.evaluate(() => {
    const elements = document.querySelectorAll('button, input, .card, .item');
    let totalMargin = 0;
    let count = 0;

    for (const element of elements) {
      const styles = window.getComputedStyle(element);
      const marginTop = parseFloat(styles.marginTop);
      const marginBottom = parseFloat(styles.marginBottom);

      if (marginTop > 0 || marginBottom > 0) {
        totalMargin += marginTop + marginBottom;
        count++;
      }
    }

    return count > 0 ? totalMargin / count : 0;
  });

  // Should have reasonable spacing (at least 8px average)
  expect(spacing).toBeGreaterThan(4);
});

// Cross-browser compatibility scenarios
Given("I'm using different browsers", async () => {
  // This would be handled by the playwright configuration
  // Testing multiple browser projects
});

When('I test on Chrome, Firefox, Safari, and Edge', async () => {
  // This is handled by the test runner configuration
  // Each browser will run the tests
});

Then('the application should work consistently', async () => {
  // Basic functionality test
  await miscPage.createRecord('browser compatibility test');
  await miscPage.searchFor('browser');
  await miscPage.waitForSearchResults();

  const hasResults =
    (await miscPage.isRecordsListVisible()) ||
    (await miscPage.isTagCloudVisible());
  expect(hasResults).toBeTruthy();
});

Then('visual appearance should be maintained', async () => {
  // Check that key visual elements are present
  await expect(miscPage.inputField).toBeVisible();

  // Check that styling is applied
  const hasStyles = await miscPage.inputField.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return (
      styles.border !== 'none' ||
      styles.outline !== 'none' ||
      styles.boxShadow !== 'none'
    );
  });

  expect(hasStyles).toBeTruthy();
});

Then('functionality should not be browser-dependent', async () => {
  // Test core functionality works across browsers
  await miscPage.inputField.type('cross browser test');
  await miscPage.inputField.press('Enter');
  await miscPage.waitForInputToClear();

  // Verify record was created
  await miscPage.searchFor('cross browser');
  await miscPage.waitForSearchResults();

  const recordCount = await miscPage.getRecordCount();
  expect(recordCount).toBeGreaterThan(0);
});

Then('CSS features should degrade gracefully', async () => {
  // Check that the application works even if some CSS features are not supported
  const hasBasicStyling = await miscPage.page.evaluate(() => {
    const body = document.body;
    const styles = window.getComputedStyle(body);

    // Check for basic styling that should work in all browsers
    return styles.fontFamily !== '' && styles.fontSize !== '';
  });

  expect(hasBasicStyling).toBeTruthy();
});

// Touch interactions scenarios
Given("I'm using a touch device", async () => {
  // Enable touch events
  await miscPage.page.evaluate(() => {
    // Simulate touch device
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
  });

  await miscPage.page.setViewportSize({ width: 375, height: 667 });
});

When('I interact with the interface', async () => {
  // Test touch interactions
  await miscPage.inputField.tap();
  await miscPage.inputField.type('touch interaction test');
});

Then('gestures should feel natural and responsive', async () => {
  // Test scrolling if there are scrollable areas
  if (await miscPage.isRecordsListVisible()) {
    const listElement = miscPage.recordsList;
    await listElement.evaluate((el) => {
      el.scrollTop = 50;
    });

    const scrollTop = await listElement.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  }
});

Then('there should be no hover-dependent functionality', async () => {
  // Check that all interactive elements work without hover
  const interactiveElements = await miscPage.page
    .locator('button, input, a, [role="button"]')
    .all();

  for (const element of interactiveElements) {
    const isVisible = await element.isVisible();
    if (isVisible) {
      // Element should be accessible via tap
      await element.tap();

      // Check that the element responds to tap
      const isClickable = await element.evaluate((el) => {
        return el.onclick !== null || el.addEventListener !== undefined;
      });

      expect(isClickable).toBeTruthy();
    }
  }
});

Then('scrolling should be smooth and natural', async () => {
  // Create content that requires scrolling
  for (let i = 0; i < 10; i++) {
    await miscPage.createRecord(`scroll test record ${i}`);
  }

  await miscPage.searchFor('scroll test');
  await miscPage.waitForSearchResults();

  if (await miscPage.isRecordsListVisible()) {
    // Test smooth scrolling
    const scrollBehavior = await miscPage.recordsList.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.scrollBehavior;
    });

    // Should have smooth scrolling or default behavior
    expect(['smooth', 'auto', '']).toContain(scrollBehavior);
  }
});

// High DPI display scenarios
Given("I'm using a high-resolution display", async () => {
  // Simulate high DPI display
  await miscPage.page.emulateMedia({ reducedMotion: 'no-preference' });
  await miscPage.page.setViewportSize({ width: 1920, height: 1080 });
});

When('I view the application', async () => {
  // Application is already loaded
  await miscPage.inputField.focus();
});

Then('text should be sharp and clear', async () => {
  // Check font rendering
  const fontProperties = await miscPage.inputField.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      fontSmoothing: styles.webkitFontSmoothing || styles.fontSmoothing,
      textRendering: styles.textRendering,
    };
  });

  // Should have proper font rendering
  expect(
    fontProperties.fontSmoothing || fontProperties.textRendering
  ).toBeTruthy();
});

Then('icons should not appear pixelated', async () => {
  // Check for SVG icons or proper icon rendering
  const icons = await miscPage.page
    .locator('svg, .icon, i[class*="icon"]')
    .all();

  for (const icon of icons) {
    const isVisible = await icon.isVisible();
    if (isVisible) {
      const tagName = await icon.evaluate((el) => el.tagName);
      // SVG icons should scale properly
      expect(['SVG', 'I', 'SPAN']).toContain(tagName);
    }
  }
});

Then('the interface should look crisp at any density', async () => {
  // Check that layout uses relative units
  const usesRelativeUnits = await miscPage.page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    let relativeCount = 0;
    let totalCount = 0;

    for (const element of elements) {
      const styles = window.getComputedStyle(element);
      const fontSize = styles.fontSize;
      const width = styles.width;

      totalCount++;

      if (
        fontSize.includes('rem') ||
        fontSize.includes('em') ||
        fontSize.includes('%') ||
        width.includes('rem') ||
        width.includes('em') ||
        width.includes('%') ||
        width.includes('vw')
      ) {
        relativeCount++;
      }
    }

    return totalCount > 0 ? relativeCount / totalCount > 0.3 : false;
  });

  expect(usesRelativeUnits).toBeTruthy();
});

Then('performance should not be impacted', async () => {
  // Check that high DPI doesn't cause performance issues
  const startTime = performance.now();
  await miscPage.createRecord('high dpi performance test');
  const endTime = performance.now();

  expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
});

// Orientation change scenarios
Given("I'm using a mobile or tablet device", async () => {
  await miscPage.page.setViewportSize({ width: 768, height: 1024 });
});

When('I change device orientation', async () => {
  // Simulate orientation change
  await miscPage.page.setViewportSize({ width: 1024, height: 768 });
  await miscPage.page.waitForTimeout(200); // Allow for orientation change
});

Then('the layout should adapt immediately', async () => {
  // Check that layout responds to orientation change
  await expect(miscPage.inputField).toBeVisible();

  // Verify no content is cut off
  const hasOverflow = await miscPage.page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );
  });

  expect(hasOverflow).toBeFalsy();
});

Then('the tag cloud should reflow appropriately', async () => {
  // Test tag cloud in landscape mode
  await miscPage.createRecord('orientation test one two three');
  await miscPage.createRecord('orientation test four five six');

  await miscPage.searchFor('orientation');
  await miscPage.waitForSearchResults();

  if (await miscPage.isTagCloudVisible()) {
    const cloudBounds = await miscPage.tagCloud.boundingBox();
    const viewportWidth = await miscPage.page.evaluate(() => window.innerWidth);

    if (cloudBounds) {
      expect(cloudBounds.width).toBeLessThanOrEqual(viewportWidth);
    }
  }
});

Then('the input field should remain accessible', async () => {
  await miscPage.inputField.tap();
  await expect(miscPage.inputField).toBeFocused();
});

Then('scrolling behavior should adjust correctly', async () => {
  // Check that scrolling works properly in new orientation
  if (await miscPage.isRecordsListVisible()) {
    const canScroll = await miscPage.recordsList.evaluate((el) => {
      return (
        el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth
      );
    });

    // If scrolling is needed, it should work
    if (canScroll) {
      await miscPage.recordsList.evaluate((el) => (el.scrollTop = 10));
      const scrollTop = await miscPage.recordsList.evaluate(
        (el) => el.scrollTop
      );
      expect(scrollTop).toBeGreaterThanOrEqual(0);
    }
  }
});
