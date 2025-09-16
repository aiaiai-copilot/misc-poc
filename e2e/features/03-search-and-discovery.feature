Feature: Search and Discovery
  As a user
  I want to find my records quickly using tags
  So that I can retrieve information when I need it

  Background:
    Given I have the following records:
      | content |
      | проект frontend React TypeScript |
      | проект backend Node.js database |
      | встреча команда понедельник 10:00 |
      | покупки молоко хлеб магазин |
      | идея стартап мобильное приложение |
      | обучение JavaScript React курс |

  Scenario: Real-time search
    Given the input field is empty
    When I type "проект"
    Then I should see search results immediately
    And results should include records with "проект" tag
    And the search should happen without pressing Enter

  Scenario: Multi-tag search with AND logic
    Given I want to find specific records
    When I search for "проект frontend"
    Then I should see only records containing both "проект" AND "frontend"
    And records with only "проект" should not appear
    And records with only "frontend" should not appear

  Scenario: Tag cloud display for many results
    Given I search for "проект" which returns multiple results
    When there are too many results to display as a list
    Then I should see a tag cloud instead
    And tag sizes should reflect frequency of use
    And I should be able to click tags to refine the search

  Scenario: List display for few results
    Given I search for "встреча команда"
    When the results fit comfortably on the screen
    Then I should see a list of matching records
    And records should be sorted by creation date (newest first)
    And I should see the full content of each record

  Scenario: Tag normalization in search
    Given I have records with "Café" and "cafe"
    When I search for "cafe"
    Then both records should be found
    And case differences should be ignored
    And accents should be normalized (if enabled)

  Scenario: Empty search results
    Given I search for "nonexistent"
    When no records match
    Then I should see a clear "no results" message
    And I should be offered to create a new record with those tags