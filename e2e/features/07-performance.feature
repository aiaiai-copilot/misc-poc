Feature: Performance Requirements
  As a user
  I want the application to perform well with large datasets
  So that it remains responsive and efficient even with thousands of records

  Background:
    Given the application is running

  @performance
  Scenario: Large dataset performance
    Given I have 10,000+ records in the system
    When I perform a search operation
    Then the search response should be under 100ms
    And the UI should remain responsive during search
    And memory usage should remain stable

  @performance
  Scenario: Virtual scrolling with many results
    Given I have a search that returns 1000+ results
    When I view the results list
    Then virtual scrolling should be active
    And only visible items should be rendered
    And scrolling should be smooth at 60 FPS
    And memory usage should be optimized

  @performance
  Scenario: Debounced search optimization
    Given I'm typing in the search field
    When I type multiple characters quickly
    Then search should be debounced appropriately
    And unnecessary API calls should be avoided
    And the final search should execute within 100ms

  @performance
  Scenario: Bundle size optimization
    Given the application is loaded
    When I check the bundle size
    Then the total gzipped size should be under 500KB
    And code splitting should be implemented
    And only necessary code should be loaded initially

  @performance
  Scenario: Lighthouse performance score
    Given I run a Lighthouse audit
    When analyzing the performance metrics
    Then the Performance score should be above 90
    And First Contentful Paint should be under 1.5s
    And Largest Contentful Paint should be under 2.5s
    And Cumulative Layout Shift should be under 0.1