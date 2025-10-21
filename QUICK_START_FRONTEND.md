# Appwrite Passkey Demo - Quick Start Guide

## Welcome! 👋

This is a sophisticated demonstration of passkey authentication and management. Below is a quick walkthrough of how to experience all the features.

## Getting Started

### 1. Setup
```bash
# Install dependencies
npm install

# Copy environment template (if not already done)
cp env.sample .env

# Fill in your Appwrite credentials in .env
# - NEXT_PUBLIC_APPWRITE_PROJECT
# - NEXT_PUBLIC_APPWRITE_ENDPOINT
# - APPWRITE_PROJECT
# - APPWRITE_ENDPOINT
# - APPWRITE_API
# - PASSKEY_CHALLENGE_SECRET (generate a strong random string)

# Start the development server
npm run dev
```

### 2. Visit the Application
Open `http://localhost:3000` in your browser

## Feature Tour

### 🔐 Login Page (`/login`)
**What you'll see:**
- Beautiful landing page with passkey benefits
- Email input field
- "Continue with Passkey" button
- Left sidebar with feature highlights

**Try it:**
1. Enter your email (e.g., `user@example.com`)
2. Click "Continue with Passkey"
3. Your device will ask for biometric authentication or PIN
4. A passkey will be created and registered
5. You'll automatically be signed in and redirected to the home page

### 🏠 Home Page (`/`)
**What you'll see:**
- Professional dashboard with your user information
- Quick stats (User ID, Email, Authentication Status)
- API reference sections
- Navigation to settings

**Try it:**
- View your user profile information
- See available API endpoints
- Click "Go to Settings →" to manage passkeys

### ⚙️ Settings Page (`/settings`)
**What you'll see:**
- Account Information section
- Passkey Management section
- API endpoint reference

#### Add a Passkey
1. Click "+ Add Passkey" button
2. Modal will appear with instructions
3. Click "Add Passkey"
4. Verify with your device's authentication method
5. Success message displays
6. New passkey appears in the list

**Use case:** Users can have multiple passkeys on different devices or browsers for backup access.

#### List Your Passkeys
The "Passkey Management" section displays:
- 🔑 Passkey name
- Status badge (active/disabled/compromised)
- Creation date
- Last used date (if applicable)
- Action buttons

#### Rename a Passkey
1. Find the passkey you want to rename
2. Click the "Rename" button
3. Enter a new name (max 50 characters)
4. Click "Rename"

**Tip:** Give your passkeys descriptive names like "iPhone", "Mac", "Work Laptop", etc.

#### Disable a Passkey
1. Find an active passkey
2. Click the "Disable" button
3. Passkey status changes to "disabled"
4. You can still enable it later

**Use case:** Temporarily disable access from a device without deleting the passkey.

#### Delete a Passkey
1. Find the passkey to delete
2. Click the "Delete" button
3. Confirm in the dialog
4. Passkey is permanently removed

**Warning:** This action cannot be undone. Keep at least one active passkey to avoid being locked out.

### 📱 Sign Out
1. Click your email in the top-right navigation
2. Click "Sign Out"
3. You'll be redirected to the login page

## API Endpoints Used

### Authentication Flow
These endpoints are called when you login:

```
1. POST /api/webauthn/auth/options
   ↓ (Get challenge)
2. Browser: User authenticates with device
   ↓
3. POST /api/webauthn/auth/verify
   ↓ (Verify signature)
4. Session created → Redirect to home
```

### Adding a Passkey
When you add a new passkey:

```
1. POST /api/webauthn/connect/options
   ↓ (Get challenge)
2. Browser: Create new credential
   ↓
3. POST /api/webauthn/connect/verify
   ↓ (Verify attestation)
4. Passkey added to account
```

### Passkey Management
These endpoints power the settings page:

```
GET  /api/webauthn/passkeys/list      → Fetch all passkeys
POST /api/webauthn/passkeys/rename    → Rename a passkey
POST /api/webauthn/passkeys/disable   → Disable a passkey
POST /api/webauthn/passkeys/delete    → Delete a passkey
```

## Key Features Demonstrated

✅ **Passwordless Authentication** - Sign in with just your device
✅ **Multi-Device Support** - Register passkeys on multiple devices
✅ **Passkey Management** - Add, rename, disable, delete passkeys
✅ **Session Management** - Secure Appwrite sessions
✅ **Error Handling** - Graceful error messages
✅ **Rate Limiting** - Protection against brute force attacks
✅ **Responsive Design** - Works on mobile, tablet, and desktop
✅ **Modern UI** - Beautiful Tailwind CSS styling

## Advanced Usage

### Multiple Passkeys
1. Create an account with one passkey
2. Go to Settings and click "+ Add Passkey"
3. Register on a different device/browser
4. Now you can sign in from either device

### Recovery Scenarios
- **Forgot phone:** Use a passkey from another device to login and manage
- **Lost device:** Disable the passkey and sign in with remaining ones
- **New device:** Add a new passkey while logged in

## Troubleshooting

### "WebAuthn is not supported in this browser"
- Ensure you're using a modern browser (Chrome 90+, Firefox 78+, Safari 13+)
- WebAuthn requires HTTPS or localhost

### "Account already connected with wallet"
- This passkey is already registered
- Try with a different email or device

### "Too many attempts"
- Rate limiting has been triggered
- Wait before trying again (check "Retry-After" header)

### Can't sign in after creating passkey
- Make sure you're on the same device/browser
- Try adding another passkey
- Check browser console for detailed error messages

## Security Notes

🔒 **Your passkeys are encrypted**
- Private keys never leave your device
- Authentication happens locally
- Only a cryptographic signature is sent to the server

🔒 **Sessions are secure**
- Time-limited tokens
- Secure cookie storage
- CSRF protection

🔒 **Challenges are protected**
- Time-limited (2 minutes default)
- HMAC signed to prevent tampering
- One-time use

## Next Steps

1. **Explore the Code**
   - Check `/app` for page components
   - Check `/app/components` for reusable components
   - Check `/lib` for utility functions

2. **Customize**
   - Modify colors and styling in `tailwind.config.ts`
   - Change RP name and ID in environment variables
   - Customize passkey names and descriptions

3. **Integrate**
   - Use these components in your own Next.js project
   - Adapt the backend API endpoints for your system
   - Extend with additional passkey features

4. **Deploy**
   - Deploy to Vercel (recommended)
   - Or use any Node.js hosting platform
   - Ensure environment variables are set

## Documentation

For detailed information, see:
- `FRONTEND_IMPLEMENTATION.md` - Technical details
- `blueprint.md` - Implementation overview
- `README.md` - Project overview

## Questions?

This is a reference implementation showing how to:
- Register passkeys with WebAuthn
- Authenticate users securely
- Manage passkey lifecycle
- Build beautiful UIs with modern auth

Feel free to modify, extend, and adapt for your needs!

Happy exploring! 🚀
