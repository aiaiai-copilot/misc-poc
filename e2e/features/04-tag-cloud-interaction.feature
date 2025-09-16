Feature: Tag Cloud Interaction
  As a user
  I want to use the tag cloud to explore and refine my searches
  So that I can discover related information and navigate efficiently

  Background:
    Given I have many records with overlapping tags:
      | content |
      | работа проект дедлайн важно |
      | работа встреча команда |
      | проект frontend React |
      | проект backend API |
      | важно покупки семья |
      | семья выходные планы |
      | планы отпуск лето |
      | React компоненты frontend |
      | API документация backend |

  Scenario: Tag cloud appears with many results
    Given I search for "проект"
    When multiple records match the search
    And the results exceed the list display threshold
    Then I should see a tag cloud
    And tag sizes should reflect usage frequency
    And the most common tags should be largest

  Scenario: Clicking tags refines search
    Given I see a tag cloud for "проект"
    When I click on the "frontend" tag
    Then my search should become "проект frontend"
    And the results should be filtered to show only records with both tags
    And the tag cloud should update to show remaining refinement options

  Scenario: Progressive search refinement
    Given I start with a broad search for "работа"
    When I click "проект" in the tag cloud
    Then my search becomes "работа проект"
    When I click "важно" in the updated tag cloud
    Then my search becomes "работа проект важно"
    And I should see only highly specific results

  Scenario: Tag cloud responsiveness
    Given I'm viewing a tag cloud on mobile
    When the screen size is limited
    Then tags should be sized appropriately for touch interaction
    And the cloud should be scrollable if needed
    And tap targets should be large enough for fingers

  Scenario: Visual feedback for tag interaction
    Given I see a tag cloud
    When I hover over a tag
    Then it should highlight to show it's clickable
    When I click a tag
    Then there should be immediate visual feedback
    And the transition to refined results should be smooth