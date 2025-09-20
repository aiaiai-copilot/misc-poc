{
"id": "misc-mvp-env",
"name": "MISC MVP Environment",
"values": [
{
"key": "base_url",
"value": "http://localhost:3000",
"type": "default",
"enabled": true,
"description": "Base URL for API server"
},
{
"key": "production_url",
"value": "https://misc.yourdomain.com",
"type": "default",
"enabled": true,
"description": "Production API URL"
},
{
"key": "google_client_id",
"value": "your-client-id.apps.googleusercontent.com",
"type": "default",
"enabled": true,
"description": "Google OAuth Client ID"
},
{
"key": "google_id_token",
"value": "",
"type": "secret",
"enabled": true,
"description": "Google ID token from OAuth (paste after manual auth)"
},
{
"key": "access_token",
"value": "",
"type": "secret",
"enabled": true,
"description": "JWT access token (auto-populated)"
},
{
"key": "refresh_token",
"value": "",
"type": "secret",
"enabled": true,
"description": "JWT refresh token (auto-populated)"
},
{
"key": "token_expiry",
"value": "",
"type": "default",
"enabled": true,
"description": "Token expiration time (auto-calculated)"
},
{
"key": "user_id",
"value": "",
"type": "default",
"enabled": true,
"description": "Current user UUID (auto-populated)"
},
{
"key": "last_record_id",
"value": "",
"type": "default",
"enabled": true,
"description": "Last created record ID for testing"
},
{
"key": "test_content",
"value": "",
"type": "default",
"enabled": true,
"description": "Dynamic test content to avoid duplicates"
},
{
"key": "updated_content",
"value": "",
"type": "default",
"enabled": true,
"description": "Dynamic updated content for testing"
},
{
"key": "export_data",
"value": "",
"type": "default",
"enabled": true,
"description": "Exported data for import testing"
},
{
"key": "oauth_url",
"value": "",
"type": "default",
"enabled": true,
"description": "Constructed OAuth URL for manual authentication"
}
],
"\_postman_variable_scope": "environment",
"\_postman_exported_at": "2025-01-01T00:00:00.000Z",
"\_postman_exported_using": "Postman/10.0.0"
}
