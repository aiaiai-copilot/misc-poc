Feature: Accessibility Compliance
  As a user with accessibility needs
  I want the application to be fully accessible
  So that I can use it regardless of my abilities or assistive technologies

  Background:
    Given the application is loaded
    And I'm using assistive technology

  @accessibility
  Scenario: Keyboard-only navigation
    Given I can only use keyboard input
    When I navigate through the application
    Then all interactive elements should be reachable via Tab
    And focus indicators should be clearly visible
    And I should never be trapped in any element
    And skip links should be available where appropriate

  @accessibility
  Scenario: Screen reader compatibility
    Given I'm using a screen reader
    When I navigate the application
    Then all content should be announced properly
    And form labels should be correctly associated
    And dynamic content changes should be announced
    And semantic HTML should be used throughout

  @accessibility
  Scenario: ARIA attributes and roles
    Given the application is running
    When I inspect the HTML structure
    Then appropriate ARIA roles should be defined
    And ARIA labels should provide context where needed
    And live regions should announce dynamic changes
    And form controls should have proper descriptions

  @accessibility
  Scenario: Color contrast compliance
    Given the application uses various colors
    When I check color contrast ratios
    Then all text should meet WCAG AA standards (4.5:1)
    And color should not be the only means of conveying information
    And users should be able to distinguish all interactive elements

  @accessibility
  Scenario: Responsive design for accessibility
    Given I'm using the application on different screen sizes
    When I zoom to 200% magnification
    Then all content should remain readable
    And horizontal scrolling should not be required
    And touch targets should be at least 44x44 pixels
    And the layout should adapt gracefully

  @accessibility
  Scenario: Focus management
    Given I'm navigating with keyboard
    When I interact with modal dialogs or overlays
    Then focus should be trapped within the modal
    And focus should return to the trigger element when closed
    And focus should never be lost or move unexpectedly

  @accessibility
  Scenario: Axe-core accessibility audit
    Given I run an automated accessibility audit
    When using axe-core analysis
    Then there should be no accessibility violations
    And all WCAG 2.1 AA guidelines should be followed
    And the application should pass all automated tests