# ListingLogic

**IPO Intelligence & Listing Gain Scoring**

ListingLogic is an independent IPO research platform that brings IPO
details, subscription demand, GMP references, company financial
information, and listing outcomes together in one place.

The goal is to help users organise IPO research and examine different
signals before making their own investment decisions.

> **Important disclaimer:** ListingLogic is an informational and
> educational research project. Its scores, estimates, indicators, and
> analysis represent the platform's perspective only. They are not
> investment advice, a recommendation to apply for or avoid an IPO, or a
> guarantee of listing performance or returns. IPO investments involve
> risk. Always do your own research, verify information with official
> sources, read the offer documents, and make investment decisions at
> your own discretion and risk.

## Live application

- **Frontend:** https://listing-logic-delta.vercel.app/
- **Backend API:** https://listinglogic-api.onrender.com/

## What ListingLogic does

- **IPO information** --- view IPO details and issue information.
- **Subscription demand** --- review available QIB, NII, RII/retail,
  and overall subscription information.
- **GMP references** --- view available grey-market premium data as a
  separate market reference, not as a guaranteed listing indicator.
- **Listing-demand analysis** --- examine demand-related inputs and
  the platform's listing prediction output.
- **Company fundamentals** --- review historical financial information
  across available reporting periods.
- **Listing outcomes** --- explore IPO lifecycle and historical
  listing information where data is available.
- **Administrative tools** --- authorised administrators can manage
  platform operations and trigger live data synchronisation. Super
  administrators can manage administrator access.

Data availability can vary by IPO and source. Missing or unavailable
source data should not be interpreted as zero or as a negative signal.

## How the analysis is presented

The platform separates listing-demand signals from company financial
context. The analysis interface presents the available inputs, score
components, confidence information, and historical financial data so
users can inspect the reasoning rather than relying on a single headline
score.

The displayed analysis is a research aid. It does not predict or assure
the actual listing price or return.

## Technology

### Frontend

- React
- Vite
- Tailwind CSS
- Firebase Authentication
- Axios

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Firebase Admin SDK

### Deployment

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Project structure

```text
listing-logic/
├── client/       # React + Vite frontend
└── server/       # Express API, data services, models and tests
```

## Run locally

### Prerequisites

- Node.js and npm
- A MongoDB database
- A Firebase project configured for Google Authentication
- Firebase Admin credentials for the backend

### 1. Clone the repository

```bash
git clone https://github.com/rajak1122/listing-logic.git
cd listing-logic
```

### 2. Configure the backend

Create the backend environment file using the configuration expected by
the server.

At minimum, configure the MongoDB connection (`MONGO_URI`), the allowed
frontend origins (`CORS_ORIGINS`), and Firebase Admin credentials. Keep
service-account credentials private; never commit them to Git.

```bash
cd server
npm install
npm start
```

The API runs on the port configured by the server (the local development
setup uses port `5000`).

### 3. Configure the frontend

Create `client/.env` and provide the Firebase web-app configuration and
backend base URL:

```env
VITE_API_BASE_URL=http://localhost:5000

VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_web_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Use the actual values from your Firebase web app. Do not commit private
credentials. Vite variables prefixed with `VITE_` are included in the
browser bundle, so they must not contain secrets.

```bash
cd client
npm install
npm run dev
```

For a production frontend deployment, set `VITE_API_BASE_URL` to the
deployed backend origin:

```env
VITE_API_BASE_URL=https://listinglogic-api.onrender.com
```

Do not append `/api` to this value; the frontend adds the API route
paths.

## Tests and production build

Run backend tests:

```bash
cd server
npm test
```

Build the frontend:

```bash
cd client
npm run build
```

## Authentication and administrator access

Users sign in with Google through Firebase Authentication. Signing in
does not automatically grant administrative permissions.

Administrator access is controlled separately by the backend using
administrator records stored in MongoDB. The platform distinguishes
between `ADMIN` and `SUPER_ADMIN` roles. Super administrators can manage
administrator access; administrative actions are protected by backend
authorisation checks and recorded in the audit workflow.

Never expose Firebase Admin service-account credentials, MongoDB
credentials, or other server secrets in frontend code or public
repositories.

## Data and research limitations

- IPO information and market references depend on upstream sources and
  their availability.
- Subscription figures and GMP can change over time.
- Financial information depends on the reporting periods and source
  data available for each company.
- Historical listing performance does not guarantee future
  performance.
- Scores and estimates are model outputs based on the platform's
  configured methodology; they are not certainty measures.

## About the project

ListingLogic is an independently built project by a technology student
with a strong interest in financial markets and market research. It
combines software development with an exploration of how IPO demand,
company fundamentals, and listing outcomes can be organised into a
practical research workflow.

It is not presented as a brokerage, exchange, investment adviser, or
institutional research service.

## Feedback

Suggestions, bug reports, and feedback are welcome. Please include the
relevant page, IPO name, and steps to reproduce an issue. Do not include
passwords, API keys, account credentials, or other sensitive information
in reports.

## Copyright & Usage

Copyright © 2026 [YOUR FULL LEGAL NAME]. All Rights Reserved.

ListingLogic is an independently developed proprietary project.

This repository is publicly available for portfolio demonstration
and technical inspection. Public visibility does not grant
permission to reuse, modify, redistribute, or commercially exploit
the source code without prior written authorization.

See the [LICENSE](./LICENSE) file for details.

## Disclaimer

ListingLogic provides informational IPO analysis and independent
research perspectives only. It does not provide investment advice
or guarantee listing gains or investment returns.

All investment decisions are made at the user's own discretion
and risk. Please verify information using official sources.
