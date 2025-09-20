# MISC MVP API - Postman Collection Documentation

## Overview

This Postman collection provides comprehensive API testing for MISC MVP, including authentication, CRUD operations, import/export, and error handling scenarios.

## Files

- `MISC-MVP-API.postman_collection.json` - Main collection with all requests
- `MISC-MVP-Environment.postman_environment.json` - Environment variables
- `README.md` - This documentation

## Setup Instructions

### 1. Import Collection and Environment

1. Open Postman
2. Click "Import" button
3. Select both JSON files:
   - `MISC-MVP-API.postman_collection.json`
   - `MISC-MVP-Environment.postman_environment.json`
4. Click "Import"

### 2. Configure Environment

1. Go to Environments tab
2. Select "MISC MVP Environment"
3. Update the following variables:
   - `base_url` - Your API server URL (default: `http://localhost:3000`)
   - `google_client_id` - Your Google OAuth Client ID

### 3. Authentication Setup

Since Google OAuth requires browser interaction, you have two options:

#### Option A: Manual Token (Development)

1. Authenticate via browser at `http://localhost:5173`
2. Open browser DevTools > Application > Cookies
3. Copy the JWT token value
4. In Postman, set the `access_token` environment variable

#### Option B: Mock Authentication (Testing)

1. Use a development endpoint that generates test tokens
2. Or implement a test authentication bypass for Postman

## Collection Structure

### 📁 Authentication

- **Get Google OAuth URL** - Helper to construct OAuth URL
- **Exchange Google Token** - Trade Google token for JWT
- **Refresh Token** - Refresh expired access token
- **Logout** - Invalidate session

### 📁 User

- **Get User Profile** - Current user information
- **Get User Settings** - Preferences and configuration
- **Update User Settings** - Modify user preferences

### 📁 Records

- **Create Record** - Add new record with tags
- **Search Records** - Find records by tags (AND logic)
- **Get All Records** - List all user records
- **Get Record by ID** - Retrieve specific record
- **Update Record** - Modify existing record
- **Delete Record** - Remove record permanently

### 📁 Tags

- **Get Tag Statistics** - Frequency data for tag cloud
- **Get Tag Suggestions** - Auto-completion suggestions

### 📁 Import/Export

- **Export Data** - Download all records as JSON
- **Import Data** - Upload records from JSON

### 📁 System

- **Health Check** - API and database status (no auth)

### 📁 Error Cases

- **401 Unauthorized** - Missing/invalid token
- **400 Invalid Request** - Validation errors
- **404 Not Found** - Resource doesn't exist
- **409 Duplicate** - Record already exists
- **429 Rate Limit** - Too many requests

## Usage Workflows

### Basic CRUD Workflow

1. Run "Health Check" to verify API is running
2. Authenticate (set `access_token` manually or via OAuth flow)
3. Run "Create Record" - creates a record with timestamp
4. Run "Search Records" - finds records by tags
5. Run "Update Record" - modifies the last created record
6. Run "Delete Record" - removes the record

### Import/Export Workflow

1. Create some test records
2. Run "Export Data" - saves data to environment
3. Run "Import Data" - imports the sample data
4. Check import statistics in response

### Testing Error Handling

1. Run requests in "Error Cases" folder
2. Each demonstrates a different error scenario
3. Check response format and error messages

## Environment Variables

### Automatically Managed

These variables are set by the collection scripts:

- `access_token` - JWT access token
- `refresh_token` - JWT refresh token
- `token_expiry` - Token expiration time
- `user_id` - Current user UUID
- `last_record_id` - Last created record ID
- `test_content` - Dynamic content for testing
- `export_data` - Exported data for import

### Manual Configuration

These need to be set once:

- `base_url` - API server URL
- `google_client_id` - Google OAuth Client ID
- `google_id_token` - Google token (if testing OAuth)

## Test Automation

Each request includes tests that:

1. Verify response status codes
2. Validate response structure
3. Extract data for subsequent requests
4. Update environment variables

### Running All Tests

1. Open Collection Runner
2. Select "MISC MVP API" collection
3. Select "MISC MVP Environment"
4. Set iterations (1 for single run)
5. Click "Run MISC MVP API"

### Expected Results

- ✅ All requests should return expected status codes
- ✅ Response structure validations pass
- ✅ Environment variables are populated
- ✅ CRUD operations work correctly

## Troubleshooting

### Common Issues

| Issue                      | Solution                                       |
| -------------------------- | ---------------------------------------------- |
| **401 Unauthorized**       | Set valid `access_token` in environment        |
| **Connection refused**     | Verify `base_url` and server is running        |
| **Duplicate record error** | Test content includes timestamp for uniqueness |
| **Rate limiting**          | Wait before retrying requests                  |
| **CORS errors**            | Use Postman, not browser; or configure CORS    |

### Debug Tips

1. **Check Console**: View > Show Postman Console
2. **Inspect Variables**: Check environment tab for current values
3. **Review Tests**: Look at Tests tab for assertion failures
4. **Raw Response**: Use "Raw" view to see full response

## Advanced Features

### Pre-request Scripts

- Generate unique content with timestamps
- Calculate token expiry
- Set dynamic headers

### Test Scripts

- Validate response structure
- Extract and save data
- Update environment variables
- Chain request dependencies

### Collection Variables

- Base configuration
- Default values
- Shared constants

## API Documentation

For detailed API documentation, refer to:

- OpenAPI specification: `/docs/api/openapi.yaml`
- Interactive docs: `http://localhost:3000/api-docs` (if enabled)

## Development vs Production

### Development Environment

```json
{
  "base_url": "http://localhost:3000",
  "google_client_id": "dev-client-id.apps.googleusercontent.com"
}
```

### Production Environment

```json
{
  "base_url": "https://api.misc.yourdomain.com",
  "google_client_id": "prod-client-id.apps.googleusercontent.com"
}
```

## Best Practices

1. **Use Environment Variables**: Don't hardcode URLs or tokens
2. **Run Health Check First**: Verify API availability
3. **Check Token Expiry**: Refresh tokens when needed
4. **Handle Errors**: Review error cases for proper handling
5. **Clean Up**: Delete test records after testing

## Contributing

To add new requests:

1. Add request to appropriate folder
2. Include pre-request script if needed
3. Add test assertions
4. Document in this README
5. Export collection and commit

## Support

For issues or questions:

- Check API logs: `docker compose logs api`
- Review test output in Postman Console
- Verify environment variables
- Consult OpenAPI specification

---

_Last updated: January 2025 | MISC MVP v2.0.0_
