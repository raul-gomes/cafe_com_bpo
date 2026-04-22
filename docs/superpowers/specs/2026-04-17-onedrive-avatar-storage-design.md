# Design Spec: OneDrive Avatar & Static File Storage

**Date**: 2026-04-17
**Topic**: Implementing OneDrive as the primary storage provider for user avatars and static files.

## 1. Overview
The goal is to transition the application's file storage from a local disk-based approach to a cloud-based approach using Microsoft OneDrive (via Microsoft Graph API). This reduces operational costs by leveraging OneDrive's free tier and centralizes asset management.

## 2. Architecture & Design

### 2.1 Storage Strategy
- **Provider**: Microsoft Graph API.
- **Authentication**: OAuth 2.0 Client Credentials Flow (Option A - Application-only permissions).
- **Hosting Account**: A dedicated service account (specified by `MICROSOFT_STORAGE_ACCOUNT_ID` in `.env`).
- **Permissions Required**: `Files.ReadWrite.All` (at the application level).

### 2.2 Data Model
A new table `user_files` will be created to track metadata and ensure the database remains the source of truth for the application's domain logic.

**Table: `user_files`**
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary Key |
| `user_id` | UUID | Foreign Key to `users.id` |
| `category` | Enum | `avatar`, `document`, `image` |
| `provider` | String | Fixed to `onedrive` |
| `provider_item_id` | String | Microsoft Graph Item ID |
| `status` | Enum | `pending`, `active`, `failed`, `deleted` |
| `read_url` | Text | Sharing link generated via `createLink` |
| `mime_type` | String | e.g., `image/png` |
| `size_bytes` | BigInt | File size |
| `original_file_name` | String | Original name for reference |
| `created_at` | DateTime | Auto timestamp |

**Table: `users` (Modification)**
- Add `avatar_file_id` (UUID, nullable, FK to `user_files.id`).

### 2.3 Integration Logic (`OneDriveService`)
- **Token Management**: The service will obtain an Access Token from the Microsoft Identity Platform.
- **File Naming**: Avatars will follow the pattern: `/CafeComBPO/avatars/{user_id}/avatar_{hash}.png`.
    - *Note*: Using a unique hash per upload prevents browser caching issues. However, since files won't be auto-overwritten, the application will handle the deletion of previous avatars during the replacement flow to manage storage.
- **URL Generation**: After upload, the API will call `POST /items/{item-id}/createLink` with `type=view` and `scope=anonymous` to get a publicly reachable URL for UI rendering.

## 3. Workflow (Approach 1: Synchronous with Reconciliation)

1.  **Request**: User uploads an image via `POST /auth/avatar`.
2.  **Validation**: Server validates file size (<5MB) and MIME type (whitelist).
3.  **Persistence**:
    - Create `user_files` record with `status=pending`.
4.  **OneDrive Upload**:
    - Get Token -> PUT File to OneDrive -> Confirm Success.
5.  **Activation**:
    - Update `user_files` with `provider_item_id`, `read_url`, and `status=active`.
    - Update `users.avatar_file_id`.
6.  **Error Handling**:
    - If upload fails (e.g., 429 Throttling), mark record as `failed` and return error.
    - Future reconciliation script will handle cleanup of orphaned or failed records.

## 4. Environment Variables
The following must be added to the root `.env`:
- `MICROSOFT_TENANT_ID`: The Azure AD Directory ID.
- `MICROSOFT_STORAGE_ACCOUNT_ID`: The user ID or email of the hosting account.
- `FILE_UPLOAD_MAX_SIZE`: e.g., `5242880` (5MB).

## 5. Security & Compliance
- **Validation**: Strict server-side verification of file magic bytes.
- **Isolation**: Files are stored in a dedicated `/CafeComBPO` root folder.
- **Redundancy**: Database tracks item IDs so links can be regenerated if they expire or break.

---
**Spec Self-Review**:
- [x] No placeholders.
- [x] Naming convention matches user request: `avatar_{user_id}.png`.
- [x] Alignment with PRD resiliência requirements.
- [x] Isolated OneDrive logic in a dedicated service.
