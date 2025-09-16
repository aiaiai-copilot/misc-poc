Feature: Data Import and Export
  As a user
  I want to backup and restore my data
  So that I can preserve my information and transfer it between devices

  Background:
    Given I have several records in my system
    And I can access the import/export functionality

  Scenario: Exporting all data
    Given I have the following records:
      | content | createdAt |
      | проект дедлайн понедельник | 2024-01-01T10:00:00Z |
      | покупки молоко хлеб | 2024-01-02T11:00:00Z |
    When I initiate a data export
    Then I should receive a JSON file
    And the file should contain all my records
    And the file should include metadata about the export
    And internal UUIDs should not be included
    And the file should include version information

  Scenario: Import data with confirmation
    Given I have existing data in the system
    When I select a JSON file for import
    Then I should see a warning about data replacement
    And the warning should clearly state all existing data will be deleted
    When I confirm the import
    Then all old data should be removed
    And the new data should be loaded
    And tags should be automatically created from content

  Scenario: Import validation
    Given I try to import an invalid JSON file
    When the file format is incorrect
    Then I should see a clear error message
    And the import should be cancelled
    And my existing data should remain unchanged

  Scenario: Import with progress indication
    Given I'm importing a large dataset
    When the import process starts
    Then I should see a progress indicator
    And I should be able to see the import status
    When the import completes
    Then I should see a success confirmation
    And I should see how many records were imported

  Scenario: Export format validation
    Given I export my data
    When I examine the exported file
    Then it should be valid JSON
    And it should match the specified format from the PRD
    And it should include normalization settings
    And it should be importable without errors

  Scenario: Data preservation during import/export cycle
    Given I have records with special characters and Unicode
    When I export all data
    And then import the exported file
    Then all records should be preserved exactly
    And special characters should remain intact
    And Unicode content should be preserved
    And tag relationships should be maintained