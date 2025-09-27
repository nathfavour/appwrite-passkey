# appwrite-passkey

Minimal Next.js app with Appwrite auth scaffold.

Development:

- Install dependencies: `npm install`
- Install Appwrite SDK: `npm install appwrite`
- Set environment variables in your environment or `.env.local`:
  - `NEXT_PUBLIC_APPWRITE_ENDPOINT` — your Appwrite endpoint (e.g. `http://localhost/v1`)
  - `NEXT_PUBLIC_APPWRITE_PROJECT` — your Appwrite project ID
- Run dev server: `npm run dev`

Notes:
- This scaffold uses client-side Appwrite auth. The login page uses `account.createEmailSession` and the home route calls `account.get()` to verify session.
