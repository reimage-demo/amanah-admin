# Admin and signup security

Convex is the only application database. Signup names, emails and answers, plus private notes, use AES-256-GCM with a fresh 96-bit IV and record-bound associated data. Metadata (type, status, timestamps and consent) stays queryable. Email rate-limit keys use HMAC-SHA256. Public directory responses intentionally disclose consenting members' names only.

Passwords use PBKDF2-HMAC-SHA256 (600,000 iterations), a random 128-bit salt for each hash, and HMAC preprocessing with a server-only pepper. Passwords are not recoverably encrypted. Public account registration is disabled.

Production secrets are Convex environment variables: SIGNUP_DATA_KEY_V1, SIGNUP_INDEX_KEY_V1 and ADMIN_PASSWORD_PEPPER, all base64-encoded 32-byte random values. Never place them in VITE variables, client files, source control or logs. Back up keys through the organization's approved secret manager; losing the encryption key makes encrypted records unreadable. Rotating data keys requires adding a new version and re-encrypting records before removing the old key. Pepper rotation requires resetting the password. ADMIN_INITIAL_PASSWORD is a temporary bootstrap value and must be removed immediately after setup:secureAdmin completes.

Every admin data function verifies admin membership, an existing auth session, total session lifetime and a server-recorded 30-minute inactivity deadline. Trusted browser input updates the deadline; token refresh does not. Scheduled expiry revokes the session and refresh tokens. The browser unmounts private content at expiry and checks again on focus/visibility changes. Multiple tabs share the server deadline. An expired session cannot be revived by the activity mutation. The absolute lifetime remains 12 hours.

Legacy migration: migration:encryptRecords processes batches of 50 by table and cursor, replacing plaintext signup/note fields and email rate-limit keys. It returns counts/cursors only. Backups made before migration may retain historical plaintext under the provider's backup policies. Existing sessions predating the rollout must sign in again once their inactivity deadline has elapsed.

Validation: npm test, npm run build and TypeScript checks. Unit tests cover ciphertext integrity, record binding, random salts/IVs, pepper dependency, private/public access boundaries, and session expiry. Production verification must avoid logging tokens, passwords or signup data.
