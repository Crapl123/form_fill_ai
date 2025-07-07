# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Getting Your Firebase & Google AI Credentials

To run this application and use its authentication and AI features, you need to provide API keys.

### 1. Firebase Credentials (for Login & Database)

Follow these steps to get the necessary keys for user login and data storage.

1.  **Go to the Firebase Console**: Open [https://console.firebase.google.com/](https://console.firebase.google.com/) in your browser.
2.  **Select Your Project**: If you don't have a project, click "Add project" and create one.
3.  **Navigate to Project Settings**: In the left sidebar, click the gear icon ⚙️ next to **Project Overview**, then select **Project settings**.
4.  **Find Your Web App Config**:
    *   In the **General** tab, scroll down to the **"Your apps"** section.
    *   If you haven't created a web app yet, click the Web icon (`</>`) to add one. Give it a nickname and register the app.
    *   Under **SDK setup and configuration**, select the **Config** radio button.
5.  **Copy Credentials to `.env`**: You will see a `firebaseConfig` object. Copy the values from this object into your `.env` file.

    ```
    # .env file

    # Copy from your Firebase Project Settings > General > Your Apps > Config
    NEXT_PUBLIC_FIREBASE_API_KEY="PASTE_API_KEY_HERE"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="PASTE_AUTH_DOMAIN_HERE"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="PASTE_PROJECT_ID_HERE"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="PASTE_STORAGE_BUCKET_HERE"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="PASTE_MESSAGING_SENDER_ID_HERE"
    NEXT_PUBLIC_FIREBASE_APP_ID="PASTE_APP_ID_HERE"
    ```

### 2. Google AI API Key (for Genkit)

1.  **Get Your Key**: Go to [Google AI Studio](https://aistudio.google.com/app/apikey) to generate your API key.
2.  **Copy the Key**: Copy the generated key.
3.  **Add to `.env`**: Paste the key into your `.env` file.
    ```
    # .env file

    # ... your firebase keys from above
    GOOGLE_API_KEY="PASTE_GOOGLE_AI_API_KEY_HERE"
    ```

After adding these keys to your `.env` file, the application will connect to your services correctly.
