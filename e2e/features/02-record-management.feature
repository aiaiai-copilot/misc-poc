Feature: Record Management
  As a user
  I want to create, edit, and delete records
  So that I can manage my information effectively

  Background:
    Given I have access to the application
    And localStorage is clean

  Scenario: Creating multiple records
    Given the input field is empty
    When I create a record with "проект deadline понедельник"
    And I create a record with "покупки молоко хлеб"
    And I create a record with "идея startup мобильное приложение"
    Then I should have 3 records in total
    And each record should be saved with its original tag order

  Scenario: Editing an existing record
    Given I have a record with "встреча Петров 15:00"
    When I search for "встреча"
    And I click on the record
    Then the record content should load in the input field
    And the original tag order should be preserved
    When I modify it to "встреча Петров 16:00 перенос"
    And I press Enter
    Then the record should be updated
    And the new content should be saved

  Scenario: Deleting a record
    Given I have a record with "старая задача"
    When I search for "старая"
    And I select the record with arrow keys
    And I press Delete
    Then the record should be removed
    And it should not appear in search results

  Scenario: Record uniqueness by tag set
    Given I have a record with "проект дедлайн понедельник"
    When I try to create "понедельник проект дедлайн"
    Then the system should recognize it as a duplicate
    And should not create a second record
    But the display order should match user input