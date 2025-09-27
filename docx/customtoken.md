Custom token login
Tokens are short-lived secrets created by an Appwrite Server SDK that can be exchanged for session by a Client SDK to log in users. You may already be familiar with tokens if you checked out Magic URL login, Email OTP login or Phone (SMS) login.

Custom token allows you to use Server SDK to generate tokens for your own implementations. This allows you to code your own authentication methods using Appwrite Functions or your own backend. You could implement username and password sign-in, captcha-protected authentication, phone call auth, and much more. Custom tokens also allow you to skip authentication which is useful when you integrate Appwrite with external authenticaion providers such as Auth0, TypingDNA, or any provider trusted by your users.

Create custom token
Once you have your server endpoint prepared either in an Appwrite Function or a server integration, you can use the Create token endpoint of the Users API to generate a token.


import { Client, Users } from "node-appwrite";

const client = new Client()
    .setEndpoint('https://<REGION>.cloud.appwrite.io/v1')    // Your API Endpoint
    .setProject('<PROJECT_ID>');                    // Your project ID
    .setKey('<API_KEY>');                           // Your project API key

const users = new Users(client);

const token = await users.createToken({
    userId: '<USER_ID>'
});
const secret = token.secret;
The newly created token includes a secret which is 6 character long hexadecimal string. You can configure length of the secret and expiry when creating a token.

If you are integrating with external authentication providers or implementing your own authentication, make sure to validate user authenticated properly before generating a token for them.

If you are implementing token-based authentication flow, share the token secret with user over any channel of your choice instead of directly giving it to him in the response.

If the client doesn't know the user's ID during authentication, we recommend to directly return user ID to the client as part of this step. If necessary, you can check if the user with an user ID exists first, and create a new user if needed.

Login
Once the client receives a token secret, we can use it to authenticate the user in the application. Use the Client SDK's Create session endpoint to exchange the token secret for a valid session, which logs the user.


import { Client, Account } from "appwrite";

const client = new Client()
    .setEndpoint('https://<REGION>.cloud.appwrite.io/v1')
    .setProject('<PROJECT_ID>');

const account = new Account(client);

const session = await account.createSession({
    userId: '<USER_ID>',
    secret: '<SECRET>'
});
When the session is successfully created, the session is stored in a persistent manner and you can now do requests as authorized user from the application.