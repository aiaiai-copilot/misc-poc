Feature: Keyboard Navigation
  As a power user
  I want to use the application entirely with keyboard
  So that I can work efficiently without using a mouse

  Background:
    Given I have several records in the system
    And the application is keyboard-focused

  Scenario: Basic keyboard shortcuts
    Given the input field is focused
    When I type "test record"
    And I press Enter
    Then a new record should be created
    When I press Escape
    Then the input field should be cleared

  Scenario: Search result navigation
    Given I search for "проект" and see multiple results
    When I press the down arrow key
    Then the first result should be highlighted
    When I press the down arrow key again
    Then the second result should be highlighted
    When I press the up arrow key
    Then the first result should be highlighted again

  Scenario: Record editing with keyboard
    Given I have search results displayed
    When I navigate to a record with arrow keys
    And I press Enter
    Then the record should be loaded for editing
    And the cursor should be positioned in the input field
    When I modify the content
    And I press Enter
    Then the changes should be saved

  Scenario: Record deletion with keyboard
    Given I have search results displayed
    When I navigate to a record with arrow keys
    And I press Delete
    Then the record should be deleted
    And focus should move to the next available record
    Or return to the input field if no more records

  Scenario: Tab completion for tags
    Given I start typing "proj" in the input field
    And there are existing tags starting with "proj"
    When I press Tab
    Then the tag should be auto-completed
    And I should be able to continue typing the next tag

  Scenario: Escape key behavior
    Given I'm in the middle of editing a record
    When I press Escape
    Then any unsaved changes should be discarded
    And the input field should be cleared
    And I should return to search mode

  Scenario: Full keyboard-only workflow
    Given I want to work without a mouse
    When I create records using only keyboard
    And I search using only keyboard
    And I edit records using only keyboard
    And I delete records using only keyboard
    Then all operations should be accessible
    And the workflow should be efficient and smooth