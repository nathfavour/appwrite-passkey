# Appwrite Passkey Demo - Frontend Implementation

## Overview

This is a sophisticated frontend demonstration of passkey authentication and lifecycle management with Appwrite and WebAuthn. The application showcases a complete user experience including registration, authentication, and comprehensive passkey management.

## Features Implemented

### 🔐 Pages

1. **Login Page** (`/login`)
   - Beautiful, modern design with gradient backgrounds
   - Email input with validation
   - Single-button "Continue with Passkey" flow
   - Unified registration/authentication experience
   - Comprehensive error handling and user feedback
   - Displays all passkey features and benefits

2. **Home Page** (`/`)
   - Protected route requiring authentication
   - Displays user profile information
   - Shows quick stats (User ID, Email, Auth Status)
   - API reference section showing all available endpoints
   - Navigation to settings for passkey management

3. **Settings Page** (`/settings`)
   - Protected account settings interface
   - Account information display
   - **Passkey Management Section**:
     - List all user passkeys with metadata
     - Add new passkey button
     - Rename passkey functionality
     - Delete passkey with confirmation dialogs
     - Disable passkey toggle
     - Real-time feedback and error handling

### 🎨 Components

1. **Navigation** (`Navigation.tsx`)
   - Global sticky navigation bar
   - Logo with branding
   - Links to home and settings
   - User info display
   - Sign out button
   - Responsive design

2. **PasskeyList** (`PasskeyList.tsx`)
   - Displays all user passkeys in card format
   - Shows passkey metadata (name, creation date, last used)
   - Status badges (active, disabled, compromised)
   - Action buttons (rename, disable, delete)
   - Empty state when no passkeys
   - Optimistic UI with loading states

3. **AddPasskeyModal** (`AddPasskeyModal.tsx`)
   - Modal dialog for adding new passkey
   - Explains what happens during registration
   - Success feedback
   - Error handling
   - Loading states

4. **RenamePasskeyModal** (`RenamePasskeyModal.tsx`)
   - Modal dialog for renaming passkeys
   - Character count (max 50)
   - Form validation
   - Error handling
   - Loading states

5. **AuthForm** (`AuthForm.tsx`)
   - Reusable authentication form component
   - Email input with validation
   - Status feedback (success/error messages)
   - Info boxes explaining authentication flow
   - Smooth loading states

## API Endpoints Utilized

### Authentication
- `POST /api/webauthn/register/options` - Get registration challenge
- `POST /api/webauthn/register/verify` - Verify attestation response
- `POST /api/webauthn/auth/options` - Get authentication challenge
- `POST /api/webauthn/auth/verify` - Verify assertion response

### Passkey Management
- `POST /api/webauthn/connect/options` - Initiate adding new passkey
- `POST /api/webauthn/connect/verify` - Verify new passkey addition
- `GET /api/webauthn/passkeys/list` - List user's passkeys
- `POST /api/webauthn/passkeys/rename` - Rename passkey
- `POST /api/webauthn/passkeys/delete` - Delete passkey
- `POST /api/webauthn/passkeys/disable` - Disable passkey

## Styling & Design

- **Framework**: Tailwind CSS v4
- **Design System**: Modern, professional with clean spacing
- **Color Scheme**: Blue/Indigo primary colors with slate grays
- **Responsive**: Mobile-first, works on all screen sizes
- **Typography**: Inter font for optimal readability
- **Accessibility**: Semantic HTML, proper ARIA labels, keyboard navigation

## Utility Modules

### `lib/webauthn-utils.ts`
Centralized WebAuthn utility functions:
- `bufferToBase64Url()` - Convert ArrayBuffer to base64url
- `base64UrlToBuffer()` - Convert base64url to ArrayBuffer
- `publicKeyCredentialToJSON()` - Serialize credential objects

### `lib/passkey-client-utils.ts`
Client-side passkey management functions:
- `addPasskeyToAccount()` - Add new passkey to account
- `listPasskeys()` - Fetch user's passkeys
- `renamePasskey()` - Rename a passkey
- `deletePasskey()` - Delete a passkey
- `disablePasskey()` - Disable a passkey
- `signOut()` - Sign out user

## How to Use

### 1. Environment Setup

```bash
cp env.sample .env
# Fill in your Appwrite project details:
# NEXT_PUBLIC_APPWRITE_PROJECT=
# NEXT_PUBLIC_APPWRITE_ENDPOINT=
# APPWRITE_PROJECT=
# APPWRITE_ENDPOINT=
# APPWRITE_API=
# PASSKEY_CHALLENGE_SECRET=your_secret_key
```

### 2. Installation

```bash
npm install
```

### 3. Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the demo.

### 4. Building

```bash
npm run build
npm start
```

## Workflow

1. **User Registration**
   - Visit `/login` and enter email
   - Click "Continue with Passkey"
   - Device prompts for biometric/PIN
   - Passkey is created and stored
   - User is automatically signed in

2. **User Authentication**
   - Visit `/login` and enter email
   - Click "Continue with Passkey"
   - System checks for existing passkeys
   - Device prompts for verification
   - Session established

3. **Passkey Management**
   - Visit `/settings`
   - View all registered passkeys
   - Add new passkey with "Add Passkey" button
   - Rename passkey by clicking "Rename"
   - Disable passkey temporarily
   - Delete passkey permanently

## Technical Implementation Details

### Session Management
- Uses Appwrite Account SDK for session management
- Exchanges WebAuthn tokens for Appwrite sessions
- Protected routes redirect to login when session expires

### WebAuthn Flow
1. **Registration**: Options → Browser Create → Verification → Storage
2. **Authentication**: Options → Browser Get → Verification → Session
3. **Add Passkey**: Similar to registration but adds to existing account

### Error Handling
- Network errors caught and displayed to user
- Validation errors with clear messaging
- Rate limiting with retry-after feedback
- Wallet gate errors properly handled

### State Management
- React hooks (useState, useEffect) for local state
- Async operations with proper loading states
- Error states with user-friendly messages
- Optimistic UI updates for better UX

## Security Considerations

1. **Cryptographic Security**
   - Private keys never leave the user's device
   - Challenges are time-limited (2 minutes default)
   - HMAC-signed tokens prevent tampering

2. **Session Security**
   - Session tokens expire after inactivity
   - Secure cookie-based storage
   - CSRF protection through same-site policies

3. **User Privacy**
   - Email used as userId (configurable)
   - Metadata stored includes only name and timestamps
   - No sensitive data in local storage

## Deployment

The frontend can be deployed to:
- Vercel (recommended for Next.js)
- Netlify
- Self-hosted Node.js server
- Docker container

Ensure environment variables are properly set in your deployment platform.

## Files Changed/Created

### New Files
- `/app/settings/page.tsx` - Settings page
- `/app/components/Navigation.tsx` - Global navigation
- `/app/components/PasskeyList.tsx` - Passkey list display
- `/app/components/AddPasskeyModal.tsx` - Add passkey modal
- `/app/components/RenamePasskeyModal.tsx` - Rename passkey modal
- `/lib/webauthn-utils.ts` - WebAuthn utilities
- `/lib/passkey-client-utils.ts` - Passkey client utilities
- `/tailwind.config.ts` - Tailwind configuration
- `/blueprint.md` - Implementation blueprint

### Modified Files
- `/app/layout.tsx` - Enhanced with navigation and styling
- `/app/page.tsx` - Enhanced home page with info
- `/app/login/page.tsx` - Enhanced login page with new design
- `/app/components/AuthForm.tsx` - Tailwind styling
- `/app/globals.css` - Added Tailwind directives

## Browser Support

- Chrome/Chromium 90+
- Firefox 78+
- Safari 13+
- Edge 90+

WebAuthn requires HTTPS (or localhost for development).

## Future Enhancements

1. Biometric selection (fingerprint, face, PIN)
2. QR code for cross-device passkey registration
3. Passkey recovery codes
4. Device management interface
5. Audit logs of passkey usage
6. Multi-factor authentication options
7. Passwordless email verification
