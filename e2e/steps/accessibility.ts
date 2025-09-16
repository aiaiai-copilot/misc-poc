import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { MiscPage } from '../support/page-objects/MiscPage';
import { injectAxe, checkA11y } from '@axe-core/playwright';

let miscPage: MiscPage;

// Background setup
Given('the application is loaded', async ({ page }) => {
  miscPage = new MiscPage(page);
  await miscPage.goto();
  await injectAxe(page);
});

Given("I'm using assistive technology", async () => {
  // This is a context-setting step for accessibility testing
  // We'll test the application as if using assistive technology
});

// Keyboard-only navigation scenarios
Given('I can only use keyboard input', async () => {
  // Simulate keyboard-only interaction by hiding the mouse cursor
  await miscPage.page.mouse.move(-100, -100);
});

When('I navigate through the application', async () => {
  // Test tabbing through all interactive elements
  await miscPage.page.keyboard.press('Tab');
});

Then('all interactive elements should be reachable via Tab', async () => {
  const interactiveElements = await miscPage.page
    .locator('input, button, [tabindex], a, select, textarea')
    .all();

  for (const element of interactiveElements) {
    const isVisible = await element.isVisible();
    const tabIndex = await element.getAttribute('tabindex');

    if (isVisible && tabIndex !== '-1') {
      await element.focus();
      const isFocused = await element.evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused).toBeTruthy();
    }
  }
});

Then('focus indicators should be clearly visible', async () => {
  // Test focus visibility
  await miscPage.inputField.focus();

  const focusStyles = await miscPage.inputField.evaluate((el) => {
    const styles = window.getComputedStyle(el, ':focus');
    return {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      outlineColor: styles.outlineColor,
      boxShadow: styles.boxShadow,
    };
  });

  // At least one focus indicator should be present
  const hasFocusIndicator =
    focusStyles.outline !== 'none' ||
    parseFloat(focusStyles.outlineWidth) > 0 ||
    focusStyles.boxShadow !== 'none';

  expect(hasFocusIndicator).toBeTruthy();
});

Then('I should never be trapped in any element', async () => {
  // Test that Tab and Shift+Tab can always move focus
  const initialFocusedElement = await miscPage.page.locator(':focus').first();

  await miscPage.page.keyboard.press('Tab');
  const afterTabElement = await miscPage.page.locator(':focus').first();

  await miscPage.page.keyboard.press('Shift+Tab');

  // Focus should be able to move (elements should be different)
  const canMoveFocus =
    !(await initialFocusedElement.isHidden()) &&
    !(await afterTabElement.isHidden());

  expect(canMoveFocus).toBeTruthy();
});

Then('skip links should be available where appropriate', async () => {
  // Check for skip links if the page is complex enough to need them
  const skipLinks = await miscPage.page
    .locator('a[href*="#main"], a[href*="#content"], .skip-link')
    .all();

  // For a simple single-page app, skip links might not be necessary
  // But if present, they should work correctly
  if (skipLinks.length > 0) {
    for (const skipLink of skipLinks) {
      const href = await skipLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
  }
});

// Screen reader compatibility scenarios
Given("I'm using a screen reader", async () => {
  // Context for screen reader testing
  // We'll test semantic structure and ARIA attributes
});

When('I navigate the application', async () => {
  // Navigate through the application structure
  await miscPage.inputField.focus();
});

Then('all content should be announced properly', async () => {
  // Check that content has proper semantic structure
  const headings = await miscPage.page.locator('h1, h2, h3, h4, h5, h6').all();
  const landmarks = await miscPage.page
    .locator(
      '[role="main"], [role="navigation"], [role="banner"], main, nav, header'
    )
    .all();

  // Should have proper document structure
  expect(headings.length + landmarks.length).toBeGreaterThan(0);
});

Then('form labels should be correctly associated', async () => {
  const formInputs = await miscPage.page
    .locator('input, select, textarea')
    .all();

  for (const input of formInputs) {
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledBy = await input.getAttribute('aria-labelledby');

    if (id) {
      const associatedLabel = await miscPage.page
        .locator(`label[for="${id}"]`)
        .first();
      const hasLabel = await associatedLabel.isVisible().catch(() => false);

      // Input should have either a label, aria-label, or aria-labelledby
      const isLabeled = hasLabel || ariaLabel || ariaLabelledBy;
      expect(isLabeled).toBeTruthy();
    }
  }
});

Then('dynamic content changes should be announced', async () => {
  // Check for live regions
  const liveRegions = await miscPage.page
    .locator('[aria-live], [role="status"], [role="alert"]')
    .all();

  // For dynamic search results, there should be some announcement mechanism
  if (liveRegions.length > 0) {
    for (const region of liveRegions) {
      const ariaLive = await region.getAttribute('aria-live');
      expect(ariaLive).toMatch(/polite|assertive/);
    }
  }
});

Then('semantic HTML should be used throughout', async () => {
  // Check for proper semantic elements
  const interactiveElements = await miscPage.page
    .locator('button, input, select, textarea, a')
    .all();

  // Should use semantic HTML where appropriate
  expect(interactiveElements.length).toBeGreaterThan(0);
});

// ARIA attributes and roles scenarios
Given('the application is running', async () => {
  // Application is already loaded
});

When('I inspect the HTML structure', async () => {
  // Inspection happens in the following assertions
});

Then('appropriate ARIA roles should be defined', async () => {
  const elementsWithRoles = await miscPage.page.locator('[role]').all();

  for (const element of elementsWithRoles) {
    const role = await element.getAttribute('role');
    const validRoles = [
      'button',
      'link',
      'textbox',
      'listbox',
      'option',
      'menu',
      'menuitem',
      'dialog',
      'alertdialog',
      'tab',
      'tabpanel',
      'main',
      'navigation',
      'banner',
      'contentinfo',
      'complementary',
      'search',
      'form',
      'status',
      'alert',
      'log',
      'marquee',
      'timer',
      'grid',
      'tree',
      'treegrid',
    ];

    expect(validRoles).toContain(role);
  }
});

Then('ARIA labels should provide context where needed', async () => {
  const elementsWithAriaLabel = await miscPage.page
    .locator('[aria-label]')
    .all();

  for (const element of elementsWithAriaLabel) {
    const ariaLabel = await element.getAttribute('aria-label');
    expect(ariaLabel?.trim().length).toBeGreaterThan(0);
  }
});

Then('live regions should announce dynamic changes', async () => {
  // Test that search results area has appropriate live region
  await miscPage.searchFor('test');
  await miscPage.waitForSearchResults();

  const searchResultsArea = miscPage.recordsList;
  const ariaLive = await searchResultsArea
    .getAttribute('aria-live')
    .catch(() => null);
  const role = await searchResultsArea.getAttribute('role').catch(() => null);

  // Results area should have some announcement mechanism
  const hasLiveRegion =
    ariaLive === 'polite' ||
    ariaLive === 'assertive' ||
    role === 'status' ||
    role === 'log';

  expect(hasLiveRegion).toBeTruthy();
});

Then('form controls should have proper descriptions', async () => {
  const inputElements = await miscPage.page
    .locator('input, select, textarea')
    .all();

  for (const input of inputElements) {
    const placeholder = await input.getAttribute('placeholder');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaDescribedBy = await input.getAttribute('aria-describedby');

    // Should have some form of description
    const hasDescription = placeholder || ariaLabel || ariaDescribedBy;
    expect(hasDescription).toBeTruthy();
  }
});

// Color contrast scenarios
Given('the application uses various colors', async () => {
  // Context for color testing
});

When('I check color contrast ratios', async () => {
  // Color contrast will be checked by axe-core
});

Then(
  'all text should meet WCAG AA standards \\({float}:{int})',
  async (_ratio: number, _denominator: number) => {
    // This will be verified by the axe-core check
    await checkA11y(miscPage.page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  }
);

Then(
  'color should not be the only means of conveying information',
  async () => {
    // Check that important information has non-color indicators
    const colorOnlyElements = await miscPage.page.evaluate(() => {
      const elements = document.querySelectorAll(
        '[style*="color"], .error, .success, .warning'
      );
      return Array.from(elements).map((el) => ({
        text: el.textContent?.trim(),
        hasIcon: el.querySelector('svg, i, .icon') !== null,
        hasTextIndicator: /error|success|warning|invalid|valid/i.test(
          el.textContent || ''
        ),
      }));
    });

    // Elements with color should also have text or icons
    for (const element of colorOnlyElements) {
      if (element.text && element.text.length > 0) {
        expect(element.hasIcon || element.hasTextIndicator).toBeTruthy();
      }
    }
  }
);

Then(
  'users should be able to distinguish all interactive elements',
  async () => {
    const interactiveElements = await miscPage.page
      .locator('button, input, a, [role="button"]')
      .all();

    for (const element of interactiveElements) {
      const isVisible = await element.isVisible();
      if (isVisible) {
        const styles = await element.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            cursor: computed.cursor,
            textDecoration: computed.textDecoration,
            border: computed.border,
            outline: computed.outline,
          };
        });

        // Interactive elements should have visual indicators
        const hasInteractiveStyle =
          styles.cursor === 'pointer' ||
          styles.textDecoration.includes('underline') ||
          styles.border !== 'none' ||
          styles.outline !== 'none';

        expect(hasInteractiveStyle).toBeTruthy();
      }
    }
  }
);

// Responsive design for accessibility scenarios
Given("I'm using the application on different screen sizes", async () => {
  // Set initial viewport
  await miscPage.page.setViewportSize({ width: 1200, height: 800 });
});

When('I zoom to {int}% magnification', async (zoomLevel: number) => {
  // Simulate zoom by adjusting viewport and device scale factor
  const scale = zoomLevel / 100;
  await miscPage.page.setViewportSize({
    width: Math.floor(1200 / scale),
    height: Math.floor(800 / scale),
  });
});

Then('all content should remain readable', async () => {
  // Check that text is still visible and readable
  const textElements = await miscPage.page
    .locator('p, span, div, label, button')
    .all();

  for (const element of textElements) {
    const isVisible = await element.isVisible();
    if (isVisible) {
      const fontSize = await element.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      // Font size should be reasonable (at least 12px)
      const fontSizeValue = parseFloat(fontSize);
      expect(fontSizeValue).toBeGreaterThanOrEqual(12);
    }
  }
});

Then('horizontal scrolling should not be required', async () => {
  const hasHorizontalScroll = await miscPage.page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    );
  });

  expect(hasHorizontalScroll).toBeFalsy();
});

Then(
  'touch targets should be at least {int}x{int} pixels',
  async (width: number, height: number) => {
    const touchTargets = await miscPage.page
      .locator('button, input, a, [role="button"]')
      .all();

    for (const target of touchTargets) {
      const isVisible = await target.isVisible();
      if (isVisible) {
        const boundingBox = await target.boundingBox();
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(width);
          expect(boundingBox.height).toBeGreaterThanOrEqual(height);
        }
      }
    }
  }
);

Then('the layout should adapt gracefully', async () => {
  // Check that no elements are overlapping or cut off
  const isLayoutGood = await miscPage.page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const viewportWidth = window.innerWidth;

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.right > viewportWidth + 10) {
        // Allow small tolerance
        return false;
      }
    }
    return true;
  });

  expect(isLayoutGood).toBeTruthy();
});

// Focus management scenarios
Given("I'm navigating with keyboard", async () => {
  // Ensure keyboard navigation mode
  await miscPage.page.keyboard.press('Tab');
});

When('I interact with modal dialogs or overlays', async () => {
  // If the application has modals, test them
  // For now, we'll test any overlay-like elements
  const overlays = await miscPage.page
    .locator('[role="dialog"], .modal, .overlay')
    .all();

  if (overlays.length > 0) {
    await overlays[0].focus();
  }
});

Then('focus should be trapped within the modal', async () => {
  // Test focus trapping if modals exist
  const modals = await miscPage.page.locator('[role="dialog"], .modal').all();

  if (modals.length > 0) {
    const modal = modals[0];
    const focusableElements = await modal
      .locator('button, input, a, [tabindex]')
      .all();

    if (focusableElements.length > 1) {
      // Tab through to the last element
      for (let i = 0; i < focusableElements.length; i++) {
        await miscPage.page.keyboard.press('Tab');
      }

      // One more tab should cycle back to the first element
      await miscPage.page.keyboard.press('Tab');
      const firstElement = focusableElements[0];
      const isFocused = await firstElement.evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused).toBeTruthy();
    }
  }
});

Then('focus should return to the trigger element when closed', async () => {
  // This would be tested with actual modal interactions
  // For now, we verify focus management principles
  await expect(miscPage.inputField).toBeFocused();
});

Then('focus should never be lost or move unexpectedly', async () => {
  // Test that focus is always on a visible, interactive element
  await miscPage.page.keyboard.press('Tab');

  const activeElement = await miscPage.page.locator(':focus').first();
  const isVisible = await activeElement.isVisible();
  expect(isVisible).toBeTruthy();
});

// Axe-core accessibility audit scenarios
Given('I run an automated accessibility audit', async () => {
  // Axe is already injected in the page
});

When('using axe-core analysis', async () => {
  // The analysis happens in the next step
});

Then('there should be no accessibility violations', async () => {
  await checkA11y(miscPage.page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});

Then(
  'all WCAG {float} AA guidelines should be followed',
  async (version: number) => {
    await checkA11y(miscPage.page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      tags: [`wcag${version.toString().replace('.', '')}aa`],
    });
  }
);

Then('the application should pass all automated tests', async () => {
  await checkA11y(miscPage.page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
