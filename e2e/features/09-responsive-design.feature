Feature: Responsive Design
  As a user on different devices
  I want the application to work well on any screen size
  So that I can use it effectively on mobile, tablet, and desktop

  Background:
    Given the application supports responsive design

  @responsive
  Scenario: Mobile phone compatibility (320px and up)
    Given I'm using a mobile phone with 320px width
    When I use the application
    Then all content should be readable without horizontal scrolling
    And touch targets should be appropriately sized
    And the interface should remain functional
    And text should be legible at the default zoom level

  @responsive
  Scenario: Tablet compatibility
    Given I'm using a tablet device
    When I rotate between portrait and landscape
    Then the layout should adapt smoothly
    And no content should be cut off
    And touch interactions should work properly
    And the tag cloud should scale appropriately

  @responsive
  Scenario: Desktop compatibility
    Given I'm using a desktop computer
    When I resize the browser window
    Then the layout should be responsive to all sizes
    And the application should utilize available space efficiently
    And keyboard and mouse interactions should work properly
    And the interface should not feel cramped on large screens

  @responsive
  Scenario: Cross-browser compatibility
    Given I'm using different browsers
    When I test on Chrome, Firefox, Safari, and Edge
    Then the application should work consistently
    And visual appearance should be maintained
    And functionality should not be browser-dependent
    And CSS features should degrade gracefully

  @responsive
  Scenario: Touch interactions on mobile
    Given I'm using a touch device
    When I interact with the interface
    Then touch targets should be at least 44x44 pixels
    And gestures should feel natural and responsive
    And there should be no hover-dependent functionality
    And scrolling should be smooth and natural

  @responsive
  Scenario: High DPI display support
    Given I'm using a high-resolution display
    When I view the application
    Then text should be sharp and clear
    And icons should not appear pixelated
    And the interface should look crisp at any density
    And performance should not be impacted

  @responsive
  Scenario: Landscape and portrait orientation
    Given I'm using a mobile or tablet device
    When I change device orientation
    Then the layout should adapt immediately
    And the tag cloud should reflow appropriately
    And the input field should remain accessible
    And scrolling behavior should adjust correctly