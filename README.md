# JS Job Portal — Firebase Edition

A responsive job portal with two roles:

- Job Seeker
- Job Provider / Company / Shop

## Included

- Start page → Home page
- Firebase-powered seeker/job/provider statistics
- Email/password authentication
- Email verification
- Forgot-password email
- Seeker registration with profile photo
- Provider registration with company/shop + person name
- Separate role-based dashboards
- Total users statistics
- Job posting, editing, deleting
- Job browsing and applying
- Application status: pending / accepted / cancelled
- Application request deletion
- Profile editing
- Logout
- Re-authenticated account deletion
- Firestore security rules
- Storage security rules

## Firebase setup

1. Create a project in Firebase Console.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create a **Firestore Database**.
4. Create **Storage**.
5. Register a **Web App**.
6. Copy the Firebase web configuration into:
   `js/firebase-config.js`
7. Deploy `firebase/firestore.rules` as Firestore rules.
8. Deploy `firebase/storage.rules` as Storage rules.

### Important

Because this is a client-side Firebase app, never put a Firebase Admin SDK service-account JSON file inside this project. Firebase web config values are intended for client apps; access control is enforced by Firebase Security Rules.

## Run locally

ES modules generally need a local web server. Do not open `index.html` directly with `file://`.

For example, with Python installed:

```bash
python -m http.server 5500
```

Then open:

http://localhost:5500

Or use VS Code Live Server.

## Suggested Firebase indexes

The app uses ordered Firestore queries. If Firebase asks you to create a composite index, follow the link Firebase provides in the browser console.

## Production business-model ideas

The current version contains the core portal, not a payment gateway. You can later add:

- Featured / sponsored job posts
- Provider subscription plans
- Paid job boosts
- Application limits
- Employer verification
- Admin moderation dashboard
- Payment integration such as Stripe/Razorpay
- Analytics
- Notifications

For a production launch, add an admin role and server-side validation/Cloud Functions for sensitive business logic.
