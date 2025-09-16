Feature: First Use Experience
  As a new user
  I want to quickly understand how to use the system
  So that I can start organizing my information immediately

  Background:
    Given I visit the application for the first time
    And localStorage is empty

  Scenario: First record creation
    Given I see the main interface
    When I type "ToDo встреча Петров 15:00" in the input field
    And I press Enter
    Then the record should be saved
    And the input field should be cleared
    And I should be ready to create another record

  Scenario: Immediate feedback on typing
    Given the input field is focused
    When I start typing "project"
    Then I should see visual feedback that the system is ready
    And there should be no lag or delays

  Scenario: Empty state guidance
    Given I see the empty application
    Then I should see a placeholder that explains what to do
    And the interface should be intuitive without instructions