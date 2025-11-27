# Image Processing Application - extracting of metadata - with Google Cloud Functions

## Overview
In this exercise, you will build a secure, serverless application using Google Cloud Functions, Cloud Storage, and Firestore. The application will:
1. Process images uploaded to a Cloud Storage bucket.
2. Generate a thumbnail and save it in a separate bucket.
3. Store the processed image in another bucket.
4. Extract and log comprehensive image metadata into Firestore, a NoSQL database.
5. Implement security best practices to restrict unauthorized access.


> **NOTE:** This guide is for educational purposes only and is not intended for a production environment. While we implement best practices, additional security hardening would be required for production use.

---

## Objectives
By completing this exercise, you will:
- Gain hands-on experience with Google Cloud Functions (2nd generation).
- Learn to manage and secure Cloud Storage resources.
- Use Firestore to store structured metadata securely.
- Apply serverless computing and schema-less database concepts.
- Understand idempotency and resource management in cloud functions.
- Learn proper error handling and logging for cloud observability.
- Implement cleanup to ensure all resources are removed when the exercise is complete.

## Key Features & Best Practices Implemented
This educational application demonstrates several important cloud development best practices:

1. **2nd Generation Cloud Functions**: Uses the latest Cloud Functions generation for better performance and modern features
2. **Idempotency**: Prevents duplicate processing if the function is retried due to failures
3. **Proper Resource Cleanup**: Ensures temporary files and processes (ExifTool) are properly cleaned up to prevent memory leaks
4. **Structured Error Logging**: Implements JSON-formatted error logs for Cloud Error Reporting integration
5. **Firestore Security Rules**: Configured to allow server-side writes while maintaining educational accessibility
6. **Runtime Version Specification**: Explicitly declares Node.js 20 runtime for consistent deployments

---

## Prerequisites
1. A Google Cloud Platform (GCP) account with billing enabled.
2. Install the following tools locally:
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
   - Node.js and npm.

## Learning Resources

Before starting, familiarize yourself with these core concepts:

### Google Cloud Functions
- **[Cloud Functions Overview](https://cloud.google.com/functions/docs/concepts/overview)** - Introduction to serverless functions
- **[2nd Gen vs 1st Gen Functions](https://cloud.google.com/functions/docs/2nd-gen/overview)** - Understanding the differences and benefits
- **[Event-Driven Functions](https://cloud.google.com/functions/docs/calling/storage)** - How Cloud Storage triggers work
- **[Best Practices](https://cloud.google.com/functions/docs/bestpractices/tips)** - Writing efficient and reliable functions

### Cloud Storage
- **[Cloud Storage Basics](https://cloud.google.com/storage/docs/introduction)** - Object storage fundamentals
- **[Bucket Naming Guidelines](https://cloud.google.com/storage/docs/naming-buckets)** - Requirements and best practices
- **[IAM for Storage](https://cloud.google.com/storage/docs/access-control/iam)** - Access control and permissions

### Firestore (NoSQL Database)
- **[Firestore Data Model](https://cloud.google.com/firestore/docs/data-model)** - Documents and collections
- **[Security Rules](https://cloud.google.com/firestore/docs/security/get-started)** - Protecting your data
- **[Server Client Libraries](https://cloud.google.com/firestore/docs/server-client-libraries)** - Using Firestore from Cloud Functions

### Key Concepts Explained

**Serverless Computing**: You write code that runs in response to events without managing servers. Google handles scaling, availability, and infrastructure.

**Event-Driven Architecture**: Your function automatically executes when a file is uploaded to Cloud Storage, demonstrating reactive programming patterns.

**Idempotency**: A critical distributed systems concept where an operation produces the same result even if executed multiple times. Essential for reliable cloud applications.

**NoSQL Databases**: Firestore is a document-oriented database that stores data in flexible JSON-like documents, unlike traditional SQL tables.

---

## Part 1: Set Up a New GCP Project
### 1. Create a New Project

You can create a new project using either the command line (recommended) or the web console.

**Option A: Using CLI (Recommended)**

```bash
# Create a new project (replace <your-project-id> with your chosen ID)
# Project IDs must be 6-30 characters, lowercase letters, numbers, and hyphens only
gcloud projects create <your-project-id>

# List your billing accounts to find the BILLING_ACCOUNT_ID
gcloud billing accounts list

# Link billing to your project (required for Cloud Functions)
gcloud billing projects link <your-project-id> --billing-account=BILLING_ACCOUNT_ID

# Set the project as default for all subsequent commands
gcloud config set project <your-project-id>
```

**Option B: Using Google Cloud Console (Alternative)**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" in the top bar
3. Click "New Project" and follow the prompts
4. Note your **Project ID** (e.g., `my-image-app-12345`)
5. Navigate to the **Billing** section and link a billing account

> **Console Verification:** You can verify your project was created correctly by visiting [Google Cloud Console](https://console.cloud.google.com/) and selecting your project from the dropdown. The project ID should appear in the top bar.


### 2. Enable APIs

**What are APIs?** Google Cloud services expose their functionality through APIs (Application Programming Interfaces). Before using any service, you must enable its API for your project.

**Reference**: [Enabling and Disabling APIs](https://cloud.google.com/apis/docs/getting-started#enabling_apis)

Enable the necessary APIs for the project:
```bash
gcloud services enable \
    cloudfunctions.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    eventarc.googleapis.com \
    pubsub.googleapis.com \
    storage.googleapis.com \
    firestore.googleapis.com
```

**What each API does:**
- `cloudfunctions.googleapis.com` - Allows you to create and manage Cloud Functions
- `cloudbuild.googleapis.com` - Builds and packages your function code into containers
- `artifactregistry.googleapis.com` - Stores container images for 2nd gen Cloud Functions
- `run.googleapis.com` - Cloud Run infrastructure (2nd gen functions run on Cloud Run)
- `eventarc.googleapis.com` - Event routing service for Cloud Storage triggers
- `pubsub.googleapis.com` - Message queue for delivering events to your function
- `storage.googleapis.com` - Enables Cloud Storage for file storage
- `firestore.googleapis.com` - Provides access to Firestore NoSQL database

> **Note:** 2nd generation Cloud Functions require more APIs than 1st generation because they are built on Cloud Run infrastructure and use Eventarc for event routing.

> **Wait Time:** API enablement typically completes within 30-60 seconds, but some APIs may take up to 2 minutes to fully propagate. If you encounter "API not enabled" errors in later steps, wait a minute and try again.

## Part 2: Set Up Resources

### 1. Create Cloud Storage Buckets

**What is Cloud Storage?** Cloud Storage is Google's object storage service for storing unstructured data like images, videos, and backups. Data is organized in "buckets" (containers) that hold "objects" (files).

**References**:
- [Cloud Storage Buckets Overview](https://cloud.google.com/storage/docs/buckets)
- [Storage Locations](https://cloud.google.com/storage/docs/locations)

**Important Naming Requirements:**

Bucket names in Google Cloud Storage must be **globally unique** across all Google Cloud users worldwide. This is similar to domain names - no two buckets can have the same name.

**Reference**: [Bucket Naming Guidelines](https://cloud.google.com/storage/docs/naming-buckets)

> **Choosing your `<unique-id>`:** Use something memorable like your initials plus a number (e.g., `jsmith01`). Bucket names must be globally unique, 3-63 characters, lowercase letters, numbers, and hyphens only.

Your three bucket names will be:
- `image-upload-bucket-<unique-id>` - Source bucket where images are uploaded
- `thumbnail-bucket-<unique-id>` - Destination for generated thumbnails
- `processed-images-bucket-<unique-id>` - Destination for processed images

Create the three buckets (replace `<unique-id>` with your unique identifier):

```bash
# The -l flag specifies the location (europe-west2 = London)
# Choose a region close to your users for better performance
gsutil mb -l europe-west2 gs://image-upload-bucket-<unique-id>
gsutil mb -l europe-west2 gs://thumbnail-bucket-<unique-id>
gsutil mb -l europe-west2 gs://processed-images-bucket-<unique-id>
```

**Why three separate buckets?**
1. **Separation of concerns**: Different buckets for different purposes
2. **Access control**: You can set different permissions on each bucket
3. **Organization**: Easier to manage and audit
4. **Best practice**: Follows the principle of least privilege

**IMPORTANT:** Make sure bucket names are unique and take note of them for later use.

In the `index.js` file, you will need to update the bucket names with your unique identifiers:

```javascript
// Bucket Names - UPDATE THESE WITH YOUR UNIQUE BUCKET NAMES
const SOURCE_BUCKET = 'image-upload-bucket-<unique-id>';      // Replace <unique-id>
const THUMBNAIL_BUCKET = 'thumbnail-bucket-<unique-id>';       // Replace <unique-id>
const PROCESSED_BUCKET = 'processed-images-bucket-<unique-id>'; // Replace <unique-id>
```

**Grant Permissions (if you have admin access):**

Use the following command to grant yourself the necessary permissions:
```bash
gcloud projects add-iam-policy-binding <your-project-id> \
    --member="user:<your-email-address>" \
    --role="roles/storage.admin"
```

Verify Permissions:

Run the following command to check if you have access:
```bash
gcloud storage buckets list
```

#### Security: Disable Public Access

**Why is this important?** By default, buckets might allow public access. For security, we explicitly remove public access to prevent unauthorized users from viewing or uploading files.

**Reference**: [Cloud Storage Security Best Practices](https://cloud.google.com/storage/docs/best-practices#security)

Disable public access for all buckets:
```bash
gsutil iam ch -d allUsers gs://image-upload-bucket-<unique-id>
gsutil iam ch -d allUsers gs://thumbnail-bucket-<unique-id>
gsutil iam ch -d allUsers gs://processed-images-bucket-<unique-id>
```

**What this command does:** The `-d` flag removes (`deletes`) the IAM binding for `allUsers`, ensuring only authenticated users with proper permissions can access these buckets.
### 2. Set Up Firestore

**What is Firestore?** Firestore is a flexible, scalable NoSQL cloud database that stores data in documents organized into collections. Unlike traditional relational databases with tables and rows, Firestore uses a document-based model similar to JSON.

**References**:
- [Firestore Overview](https://cloud.google.com/firestore/docs)
- [Choosing Between Firestore Modes](https://cloud.google.com/firestore/docs/firestore-or-datastore)
- [Firestore Data Model Explained](https://firebase.google.com/docs/firestore/data-model)

#### Understanding Firestore's NoSQL Data Model

**Traditional SQL Database vs. Firestore:**

```
SQL Database (Relational):
┌─────────────────────────────────────────────────────────┐
│ Table: image_logs                                       │
├──────┬──────────┬──────────┬────────┬─────────┬────────┤
│ id   │ filename │ bucket   │ width  │ height  │ time   │
├──────┼──────────┼──────────┼────────┼─────────┼────────┤
│ 1    │ img.jpg  │ source   │ 1920   │ 1080    │ 10:00  │
│ 2    │ pic.png  │ source   │ 800    │ 600     │ 10:05  │
└──────┴──────────┴──────────┴────────┴─────────┴────────┘

Firestore (NoSQL):
Collection: image_logs/
├── Document: auto-generated-id-1
│   ├── fileName: "img.jpg"
│   ├── sourceBucket: "source"
│   ├── basicMetadata: {
│   │   ├── width: 1920
│   │   ├── height: 1080
│   │   └── format: "jpeg"
│   │   }
│   ├── fullMetadata: {
│   │   ├── Make: "Canon"
│   │   ├── Model: "EOS 5D"
│   │   ├── GPS: { lat: 51.5, lon: -0.1 }
│   │   └── ... (100+ fields possible)
│   │   }
│   └── timestamp: "2025-01-19T10:00:00Z"
│
└── Document: auto-generated-id-2
    ├── fileName: "pic.png"
    ├── sourceBucket: "source"
    ├── basicMetadata: { ... }
    └── timestamp: "2025-01-19T10:05:00Z"
    (Note: This document has NO fullMetadata - schema flexibility!)
```

**Key Differences:**
1. **No Fixed Schema**: Each document can have different fields
2. **Nested Data**: Store complex objects without JOIN operations
3. **Collections & Documents**: Hierarchical structure instead of flat tables
4. **Automatic IDs**: Firestore generates unique document identifiers
5. **No Relationships**: No foreign keys - denormalization is preferred

**Deep Dive**: [Understanding NoSQL Databases](https://cloud.google.com/firestore/docs/concepts)

**Why Firestore for This Application?**
- **Serverless**: No server management required
- **Real-time**: Supports live data synchronization
- **Scalable**: Automatically scales with your application
- **Flexible schema**: Perfect for varying image metadata (different cameras = different EXIF fields)
- **Query capabilities**: Can search/filter documents without predefined indexes
- **Integration**: Native support in Cloud Functions via firebase-admin SDK

#### Install Firebase Tools

```bash
npm install -g firebase-tools
npx firebase login
```
Follow the login prompts to authenticate with your Google account.

**Reference**: [Firebase CLI Reference](https://firebase.google.com/docs/cli)

#### Link Firebase to Your Google Cloud Project

You can add Firebase to your GCP project using either the CLI (recommended) or the Firebase Console.

**Option A: Using CLI (Recommended)**

```bash
# Enable Firebase Management API first
gcloud services enable firebase.googleapis.com

# Add Firebase to your GCP project
firebase projects:addfirebase <your-project-id>

# Verify the linking
firebase projects:list
```

You should see output similar to:
```
┌──────────────────────┬────────────────────────┬────────────────┬──────────────────────┐
│ Project Display Name │ Project ID             │ Project Number │ Resource Location ID │
├──────────────────────┼────────────────────────┼────────────────┼──────────────────────┤
│ your-project-name    │ your-project-id        │ 123456789012   │ [Not specified]      │
└──────────────────────┴────────────────────────┴────────────────┴──────────────────────┘
```

**Option B: Using Firebase Console (Alternative)**

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Select **Import a Google Cloud Project** or **Add Firebase to Google Cloud project**
4. Choose your Google Cloud project (the one you created in Part 1)
5. Follow the prompts to add Firebase resources

**Why link Firebase?** Firebase provides additional tools and SDKs that work seamlessly with Google Cloud services like Firestore.

> **Console Verification:** Visit [Firebase Console](https://console.firebase.google.com/) to verify your project appears in the list. In Firebase console, ensure you selected **Spark (No cost)** billing plan for learning purposes.

#### Create Firestore Database

Before initializing Firebase locally, you need to create the Firestore database in your project:

```bash
# Create Firestore database in Native mode (required for this exercise)
gcloud firestore databases create --location=europe-west2

# Verify creation
gcloud firestore databases list
```

**What this does:**
- Creates a Firestore database in **Native mode** (required for the Firebase SDK)
- Sets the location to `europe-west2` (London) to match your Cloud Storage buckets
- The database will be named `(default)` which is the standard Firestore database

> **Console Verification:** You can verify Firestore was created by visiting [Firebase Console > Firestore Database](https://console.firebase.google.com/) and selecting your project.

**Reference**: [Create a Firestore Database](https://cloud.google.com/firestore/docs/create-database)

#### Initialize Firebase in Your Project Directory

**What does `firebase init` do?** This command sets up your local development environment for working with Firebase services. It creates configuration files that define how Firestore should be set up.

**Reference**: [Initialize Firebase Projects](https://firebase.google.com/docs/cli#initialize_a_firebase_project)

Run the following command from your project directory:

```bash
npx firebase init
```

**Step-by-step through the prompts:**

1. **Select Features:**
   - Use arrow keys to navigate
   - Press `Space` to select **Firestore**
   - Press `Enter` to continue

   **What this does:** Tells Firebase CLI you want to configure Firestore for this project

2. **Select Project:**
   - Choose **"Use an existing project"**
   - Select your Google Cloud project from the list

   **What this does:** Links your local Firebase configuration to your cloud project

3. **Firestore Rules File:**
   - When prompted, accept the default filename: `firestore.rules`

   **What this creates:** A file defining security rules (who can read/write data)

4. **Firestore Indexes File:**
   - When prompted, accept the default filename: `firestore.indexes.json`

   **What this creates:** A file defining custom indexes for complex queries (empty by default)

5. **Complete Setup:**
   - Firebase creates `firebase.json`, `firestore.rules`, and `firestore.indexes.json` in your directory

**Files Created:**

```
your-project/
├── firebase.json           # Firebase project configuration
├── firestore.rules         # Security rules for Firestore
├── firestore.indexes.json  # Custom query indexes
└── .firebaserc            # Project aliases (hidden file)
```

> **Note about `.firebaserc`:** This file stores project aliases for the **Firebase CLI** (used for `firebase deploy` commands). It does NOT affect `gcloud` commands. When deploying the Cloud Function with `gcloud functions deploy`, the project is determined by `gcloud config set project` or the `--project` flag. You don't need to manually edit `.firebaserc` - it's automatically updated when you run `firebase init` or `firebase use <project-id>`.

**Reference**: [Firebase Configuration Files](https://firebase.google.com/docs/cli#the_firebasejson_file)
Update Firestore Rules
After initialization, open the firestore.rules file created in your directory and replace its contents with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /image_logs/{document} {
      // Allow reads from anywhere for educational/debugging purposes
      allow read: if true;
      // Allow writes from authenticated users OR server-side (Cloud Functions)
      // In production, use more restrictive rules
      allow write: if request.auth != null || request.resource != null;
    }
  }
}
```

**Understanding These Security Rules:**

**Reference**: [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)

Let's break down what these rules mean:

1. **`rules_version = '2'`**: Uses the latest version of security rules syntax
2. **`match /image_logs/{document}`**: Applies rules to all documents in the `image_logs` collection
3. **`allow read: if true`**: Anyone can read data (for educational debugging)
4. **`allow write: if request.auth != null || request.resource != null`**:
   - Allows writes if the user is authenticated (`request.auth != null`) OR
   - If there's resource data present (`request.resource != null`), which is true for Cloud Functions

**Why these specific rules?**
- **Educational context**: Easy to view data in the Firestore console without authentication
- **Cloud Function writes**: The function runs as a service account and can write data
- **Not production-ready**: Real applications should have much stricter rules

**Production alternatives would be:**
```javascript
// Example: Only allow writes from specific service accounts
allow write: if request.auth.token.email.matches('.*@YOUR-PROJECT-ID.iam.gserviceaccount.com');
```

**More Resources**:
- [Writing Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Testing Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

#### Understanding What Happens During Firestore Deployment

When you deploy Firestore rules, here's what actually happens behind the scenes:

**Reference**: [How Security Rules Work](https://firebase.google.com/docs/firestore/security/rules-conditions)

```
Step 1: Local Rules File (firestore.rules)
   ↓
Step 2: Firebase CLI reads and validates syntax
   ↓
Step 3: Rules are compiled and optimized
   ↓
Step 4: Uploaded to Google Cloud Firestore service
   ↓
Step 5: Rules become active (applied to all requests)
   ↓
Step 6: Every read/write request is checked against these rules
```

**What happens when Cloud Function writes to Firestore:**

```javascript
// In your Cloud Function (index.js, line 104-115):
await db.collection('image_logs').add(logEntry);
```

**Behind the scenes:**

1. **Request Initiated**: Cloud Function sends write request to Firestore
2. **Authentication**: Firestore identifies the request is from a service account
3. **Security Rules Evaluation**:
   - Firestore checks: `request.resource != null` (data is present) - PASS
   - Rule condition met, write allowed
4. **Data Validation**: Firestore ensures data types are valid
5. **Write Operation**: Document created with auto-generated ID
6. **Confirmation**: Success response sent back to Cloud Function

**Request Flow Diagram:**

```
┌─────────────────────┐
│  Cloud Function     │
│  (Service Account)  │
└──────────┬──────────┘
           │ 1. Write request with data
           ↓
┌──────────────────────────────────────┐
│  Firestore Security Rules Engine     │
│  ┌────────────────────────────────┐  │
│  │ Check: request.resource != null│  │ ← Our rule
│  │ Result: TRUE ✓                 │  │
│  └────────────────────────────────┘  │
└──────────┬───────────────────────────┘
           │ 2. Authorized ✓
           ↓
┌─────────────────────┐
│  Firestore Database │
│  ┌───────────────┐  │
│  │ image_logs/   │  │
│  │ └─ doc-123    │  │ ← New document created
│  └───────────────┘  │
└─────────────────────┘
```

**Why Firestore creates the database automatically:**

When you first write data to Firestore, it automatically:
1. **Creates the database** (if it doesn't exist) in Native mode
2. **Creates the collection** (`image_logs`) when first document is added
3. **Generates document ID** (using Firestore's distributed ID generator)
4. **Indexes the data** for queries

**Reference**: [Firestore Automatic Database Creation](https://firebase.google.com/docs/firestore/quickstart)

**No need to "CREATE TABLE"!** Unlike SQL databases, you don't need to define schemas or create tables. Collections and documents are created on-the-fly as you write data.

#### Deploy the Rules
Deploy the rules using:
   
   ```bash

   npx firebase deploy --only firestore:rules
   ```

**What happens during deployment:**

```
┌──────────────────────────┐
│ Your Computer            │
│ firestore.rules file     │
└────────┬─────────────────┘
         │ npx firebase deploy
         ↓
┌──────────────────────────┐
│ Firebase CLI             │
│ - Validates syntax       │
│ - Compiles rules         │
└────────┬─────────────────┘
         │ Upload via API
         ↓
┌──────────────────────────┐
│ Google Cloud             │
│ Firestore Rules Engine   │
│ - Rules active globally  │
│ - Applied to all requests│
└──────────────────────────┘
```

**Expected output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project/overview
```

**Reference**: [Deploying Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started#use_the_firebase_cli)

#### Verify the Rules

Open the [Firestore Console](https://console.firebase.google.com/project/_/firestore/rules) and verify that the rules are set correctly.

You should see your rules displayed in the "Rules" tab. The status should show as "Published".


### 3. Set Up IAM Policies

**What is IAM?** Identity and Access Management (IAM) controls who (identity) has what access (roles) to which resources. It's a fundamental security concept in cloud computing.

**References**:
- [IAM Overview](https://cloud.google.com/iam/docs/overview)
- [Understanding Service Accounts](https://cloud.google.com/iam/docs/service-account-overview)
- [IAM Roles for Storage](https://cloud.google.com/storage/docs/access-control/iam-roles)

**What is a Service Account?** Cloud Functions run as "service accounts" - special Google accounts that represent your application rather than a human user.

#### Verify Service Account

First, list service accounts to find the default App Engine service account:

```bash
gcloud iam service-accounts list
```

Look for an account like `<your-project-id>@appspot.gserviceaccount.com`

#### Get Your Project Number

Several IAM commands require your project number. Retrieve it with:

```bash
# Get your project number and store it in a variable
PROJECT_NUMBER=$(gcloud projects describe <your-project-id> --format="value(projectNumber)")

# Verify the project number
echo $PROJECT_NUMBER
```

#### Identify the Cloud Storage Service Agent (needed for Eventarc triggers)

When Cloud Storage emits Object Finalize events to Eventarc (which then invokes your Cloud Function), Google uses a **Cloud Storage service agent** inside your project. This agent must be able to publish to Pub/Sub; otherwise the trigger creation fails during deployment.

- **Service agent format**: `service-<PROJECT_NUMBER>@gs-project-accounts.iam.gserviceaccount.com`

**Console alternative**:
1. Open **IAM & Admin → IAM** in the Cloud Console.
2. Use the filter chip **"Role: Storage Service Agent"** or search for `gs-project-accounts`.
3. Copy the email address shown—it should match the pattern above.

**Reference**: [Eventarc Cloud Storage trigger prerequisites](https://cloud.google.com/eventarc/docs/run/storage#before-you-begin)

#### Grant Pub/Sub Publisher role to the Cloud Storage service agent

Assign the Pub/Sub Publisher role so the service agent can deliver events to Eventarc:

```bash
gcloud projects add-iam-policy-binding <your-project-id> \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gs-project-accounts.iam.gserviceaccount.com" \
    --role="roles/pubsub.publisher"
```

If you skip this step, deployments fail with errors similar to: `The Cloud Storage service account for your bucket is unable to publish to Cloud Pub/Sub topics... permission denied`.

#### Grant Cloud Run Invoker and Eventarc Event Receiver roles

For 2nd generation Cloud Functions, the Compute Engine default service account needs additional roles to receive events and invoke the function:

```bash
# Grant Cloud Run Invoker role to compute service account
gcloud projects add-iam-policy-binding <your-project-id> \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/run.invoker"

# Grant Eventarc Event Receiver role
gcloud projects add-iam-policy-binding <your-project-id> \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/eventarc.eventReceiver"
```

**Why these roles are needed:**
- `roles/run.invoker` - Allows Eventarc to invoke your Cloud Function (which runs on Cloud Run)
- `roles/eventarc.eventReceiver` - Allows the service account to receive events from Cloud Storage

#### Grant Eventarc Service Account Access to Source Bucket

The Eventarc service agent needs permission to read from your source bucket to validate the trigger:

```bash
gsutil iam ch \
    serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com:roles/storage.objectViewer \
    gs://image-upload-bucket-<unique-id>
```

> **Wait Time:** IAM permission changes can take 60-120 seconds to propagate across Google Cloud systems. Wait at least 1-2 minutes before deploying the function, or you may encounter permission errors.

#### Grant Storage Permissions

Grant permissions to the App Engine default service account using the **Principle of Least Privilege** (only the minimum permissions needed):

```bash
# Replace <your-project-id> with your actual GCP project ID
# Replace <unique-id> with your bucket identifier

# Grant read access to source bucket
gsutil iam ch \
    serviceAccount:<your-project-id>@appspot.gserviceaccount.com:roles/storage.objectViewer \
    gs://image-upload-bucket-<unique-id>

# Grant write access to thumbnail bucket
gsutil iam ch \
    serviceAccount:<your-project-id>@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://thumbnail-bucket-<unique-id>

# Grant write access to processed images bucket
gsutil iam ch \
    serviceAccount:<your-project-id>@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://processed-images-bucket-<unique-id>
```

**Understanding the IAM roles:**
- **`roles/storage.objectViewer`**: Can read (download) objects from the source bucket
- **`roles/storage.objectCreator`**: Can create (upload) new objects to the thumbnail and processed buckets
- **Why not Admin?**: Following security best practices - the function only needs read access to source and write access to output buckets

**Reference**: [Cloud Storage IAM Roles](https://cloud.google.com/storage/docs/access-control/iam-roles)

> **Wait Time:** After granting all IAM permissions, wait 1-2 minutes for changes to propagate before proceeding to deployment. This ensures service accounts have the necessary access when the function is deployed.

---

## Part 3: Develop the Cloud Function

**Key References for This Section**:
- [Writing Cloud Functions](https://cloud.google.com/functions/docs/writing)
- [Cloud Functions Node.js Runtime](https://cloud.google.com/functions/docs/concepts/nodejs-runtime)
- [Storage Triggered Functions](https://cloud.google.com/functions/docs/calling/storage)
### 1. Initialize a Node.js Project
Create a directory for the function:

```bash
mkdir image-processing
```

Install required dependencies:
```bash
npm install @google-cloud/storage firebase-admin sharp exiftool-vendored
```

**Understanding the dependencies:**
- **`@google-cloud/storage`**: Official Google Cloud Storage client library for Node.js
  - [Documentation](https://cloud.google.com/nodejs/docs/reference/storage/latest)
- **`firebase-admin`**: Firebase Admin SDK for server-side Firestore access
  - [Documentation](https://firebase.google.com/docs/admin/setup)
- **`sharp`**: High-performance image processing library in Node.js
  - [Documentation](https://sharp.pixelplumbing.com/)
- **`exiftool-vendored`**: Extracts metadata from images (camera info, GPS, timestamps)
  - [Documentation](https://www.npmjs.com/package/exiftool-vendored)

### 2. Add Function Code

Create a file named `index.js` and add the Cloud Function source code provided in the GitHub repository.

**Key Code Concepts to Understand:**

#### Idempotency Check (lines 53-62)
```javascript
const existingLog = await db.collection('image_logs')
    .where('fileName', '==', fileName)
    .limit(1)
    .get();
```
This checks if the file was already processed. If the function fails and retries, it won't create duplicates.

**Reference**: [Idempotent Cloud Functions](https://cloud.google.com/functions/docs/bestpractices/retries)

#### Event-Driven Trigger
The function automatically runs when a file is uploaded to the source bucket. The `event` parameter contains file information.

**Reference**: [Storage Events](https://cloud.google.com/functions/docs/calling/storage#event_structure)

#### Resource Cleanup (lines 129-135)
```javascript
finally {
    // Cleanup temporary files
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    // ...
    await exiftool.end(); // Critical: prevents memory leaks
}
```

Cloud Functions reuse execution environments. Always clean up resources to prevent memory leaks.

**Reference**: [Execution Environment](https://cloud.google.com/functions/docs/concepts/execution-environment)

#### How the Cloud Function Writes to Firestore

**Step-by-step breakdown of the Firestore write operation:**

**1. Initialize Firebase Admin SDK (index.js, lines 7-9):**
```javascript
admin.initializeApp();
const db = admin.firestore();
```

**What this does:**
- Initializes Firebase Admin SDK with default credentials
- Cloud Functions automatically provides service account credentials
- Creates a Firestore client (`db`) for database operations

**Reference**: [Initialize Firebase Admin SDK](https://firebase.google.com/docs/admin/setup#initialize-sdk)

**2. Build the Document Data (index.js, lines 106-114):**
```javascript
const logEntry = {
    fileName,                      // String: "sample.jpg"
    sourceBucket: SOURCE_BUCKET,   // String: "image-upload-bucket-<unique-id>"
    thumbnailBucket: THUMBNAIL_BUCKET,
    processedBucket: PROCESSED_BUCKET,
    basicMetadata,                 // Object: { width: 1920, height: 1080, ... }
    fullMetadata: firestoreMetadata, // Object: { Make: "Canon", Model: "EOS 5D", ... }
    timestamp: new Date().toISOString() // String: "2025-01-19T10:00:00.000Z"
};
```

**Data structure being created:**
```javascript
{
  fileName: "sample.jpg",
  sourceBucket: "image-upload-bucket-<unique-id>",
  thumbnailBucket: "thumbnail-bucket-<unique-id>",
  processedBucket: "processed-images-bucket-<unique-id>",
  basicMetadata: {
    format: "jpeg",
    width: 1920,
    height: 1080,
    space: "srgb",
    channels: 3,
    depth: "uchar",
    density: 72,
    hasAlpha: false
  },
  fullMetadata: {
    SourceFile: "sample.jpg",
    Make: "Canon",
    Model: "Canon EOS 5D Mark IV",
    DateTimeOriginal: "2024:12:15 14:30:22",
    ExposureTime: "1/250",
    FNumber: 5.6,
    ISO: 400,
    LensModel: "EF24-70mm f/2.8L II USM",
    GPSLatitude: 51.5074,
    GPSLongitude: -0.1278
    // ... potentially 100+ more EXIF fields
  },
  timestamp: "2025-01-19T10:00:00.000Z"
}
```

**3. Write to Firestore (index.js, line 115):**
```javascript
await db.collection('image_logs').add(logEntry);
```

**What happens in this single line:**

```
db.collection('image_logs')
   ↓
   Specifies the collection name
   - Collection created automatically if it doesn't exist
   - Acts as a "folder" for documents

.add(logEntry)
   ↓
   Creates a new document with auto-generated ID
   - Firestore generates unique ID (e.g., "AbCd1234EfGh5678")
   - Document contains all fields from logEntry
   - Write is atomic (all or nothing)
   - Returns a DocumentReference
```

**Equivalent Firestore REST API call (what happens under the hood):**
```
POST https://firestore.googleapis.com/v1/projects/YOUR-PROJECT/databases/(default)/documents/image_logs
Authorization: Bearer [SERVICE_ACCOUNT_TOKEN]
Content-Type: application/json

{
  "fields": {
    "fileName": { "stringValue": "sample.jpg" },
    "sourceBucket": { "stringValue": "image-upload-bucket-<unique-id>" },
    "basicMetadata": {
      "mapValue": {
        "fields": {
          "width": { "integerValue": "1920" },
          "height": { "integerValue": "1080" }
        }
      }
    },
    ...
  }
}
```

**4. Result in Firestore:**

After the write, your Firestore database looks like this:

```
Firestore Database
└── image_logs (Collection)
    └── AbCd1234EfGh5678 (Document - auto-generated ID)
        ├── fileName: "sample.jpg"
        ├── sourceBucket: "image-upload-bucket-<unique-id>"
        ├── thumbnailBucket: "thumbnail-bucket-<unique-id>"
        ├── processedBucket: "processed-images-bucket-<unique-id>"
        ├── basicMetadata: { ... }
        ├── fullMetadata: { ... }
        └── timestamp: "2025-01-19T10:00:00.000Z"
```

**Why `.add()` instead of `.set()`?**

**Reference**: [Add vs Set in Firestore](https://firebase.google.com/docs/firestore/manage-data/add-data)

| Method | Document ID | Use Case |
|--------|-------------|----------|
| `.add()` | Auto-generated | When you don't care about the ID (like logs) |
| `.set()` | You specify | When you need a specific ID (like user profiles) |

**Example of `.set()` alternative:**
```javascript
// Instead of .add(), we could use:
await db.collection('image_logs').doc(fileName).set(logEntry);
// This would use the filename as the document ID
// Problem: Same filename = overwrite existing document
```

**Why we use `.add()` for this application:**
- Each upload should create a NEW log entry
- We want history of all uploads (even duplicate filenames)
- Auto-generated IDs are globally unique and sortable by creation time

**Deep Dive**: [Firestore Data Types](https://firebase.google.com/docs/firestore/manage-data/data-types)

Update the firebase.json file with the following content:

```bash
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "."
  }
}

```
This configuration tells Firebase to look for your Cloud Function code in the current directory (where index.js, package.json, and node_modules are located).

## Part 4: Deploy the Cloud Function

**What is Deployment?** Deployment packages your code and uploads it to Google Cloud, where it becomes a live, running function that responds to events.

**Key References**:
- [Deploying Cloud Functions](https://cloud.google.com/functions/docs/deploy)
- [2nd Generation Functions](https://cloud.google.com/functions/docs/2nd-gen/overview)
- [Function Configuration Options](https://cloud.google.com/functions/docs/configuring)

### Check Billing Status

Verify if billing is enabled on the project:
```bash
gcloud billing projects describe <your-project-id>
```
Look for the `billingEnabled` field in the output. If it's set to `false`, you need to enable billing.

```bash
gcloud billing projects link <your-project-id> --billing-account=BILLING_ACCOUNT_ID
```
Replace `BILLING_ACCOUNT_ID` with your billing account ID. You can retrieve it using:

```bash
gcloud billing accounts list
```

### Deploy the Cloud Function

**IMPORTANT**: This deployment uses 2nd generation Cloud Functions which provides better performance, higher concurrency, and modern features.

Deploy the Cloud Function using the following command (replace `<unique-id>` with your bucket identifier):

```bash
gcloud functions deploy processImage \
    --gen2 \
    --region europe-west2 \
    --runtime nodejs22 \
    --source . \
    --trigger-bucket image-upload-bucket-<unique-id> \
    --trigger-location europe-west2 \
    --entry-point processImage \
    --memory 512MB \
    --timeout 540s
```

**Understanding the Deployment Parameters:**

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| `--gen2` | (flag) | Uses 2nd generation Cloud Functions (modern, recommended) |
| `--region` | europe-west2 | London region - choose one close to your users |
| `--runtime` | nodejs22 | Node.js version 22 (matches package.json engines field) |
| `--source` | . | Specifies the source code location (current directory) |
| `--trigger-bucket` | image-upload-bucket-\<unique-id\> | Automatically runs when files are uploaded here |
| `--trigger-location` | europe-west2 | Region where the trigger is created (should match bucket region) |
| `--entry-point` | processImage | The function name in index.js to execute |
| `--memory` | 512MB | RAM allocated (256MB-32GB available) |
| `--timeout` | 540s | Max execution time (9 minutes; max 60 min for HTTP) |

**References**:
- [Runtime Options](https://cloud.google.com/functions/docs/concepts/execution-environment)
- [Memory and CPU Allocation](https://cloud.google.com/functions/docs/configuring/memory)
- [Storage Triggers](https://cloud.google.com/functions/docs/calling/storage)

**Why 2nd Generation Cloud Functions?**

**Reference**: [2nd Gen vs 1st Gen Comparison](https://cloud.google.com/functions/docs/2nd-gen/overview)

| Feature | 1st Gen | 2nd Gen |
|---------|---------|---------|
| Concurrent requests per instance | 1 | Up to 1000 |
| Max timeout (HTTP) | 9 minutes | 60 minutes |
| Max memory | 8 GB | 32 GB |
| Event sources | 7 | 90+ via Eventarc |
| Infrastructure | Legacy | Cloud Run |

**What happens during deployment?**
1. Your code is packaged into a container
2. Uploaded to Google Cloud Build
3. Deployed to Cloud Run infrastructure
4. Trigger is configured to watch the storage bucket
5. Function becomes live and ready to process events

Enable Cloud Build API if prompted.

> **Wait Time:** First-time deployment typically takes 3-5 minutes as Google Cloud needs to:
> 1. Build your code into a container image (~1-2 min)
> 2. Push to Artifact Registry (~30 sec)
> 3. Deploy to Cloud Run (~1-2 min)
> 4. Configure the Eventarc trigger (~30 sec)
>
> Subsequent deployments are faster (~1-2 minutes) because the base image is cached.

## Part 5: Test the Application

**What happens when you upload?**
1. File uploaded to source bucket
2. Storage triggers your Cloud Function
3. Function downloads image
4. Checks Firestore if already processed (idempotency)
5. Creates thumbnail (200x200 pixels)
6. Extracts metadata (camera info, GPS, etc.)
7. Uploads thumbnail and processed image
8. Saves metadata to Firestore

### Upload a Test Image

```bash
# Replace <unique-id> with your bucket identifier
gsutil cp ./image-processing/sample-clouds-400x300.jpg gs://image-upload-bucket-<unique-id>
```

> **Note:** The `image-processing/` folder contains several test images you can use.

**Don't have a test image?** Download one:
```bash
curl -o sample.jpg https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/JPEG_example_flower.jpg/640px-JPEG_example_flower.jpg
```

> **Wait Time:** After uploading, wait 10-30 seconds for the function to process the image. The first invocation may take longer (up to 60 seconds) due to "cold start" - when the function instance needs to be initialized. You can monitor progress in the function logs.

### Verify Results

Now that you've deployed and tested your application, take time to explore how all the components work together. This section guides you through both the Google Cloud Console (visual) and CLI (command-line) methods to inspect your resources.

**Reference**: [Viewing Function Logs](https://cloud.google.com/functions/docs/monitoring/logging)

---

#### Part A: Inspect via Google Cloud Console (Visual Exploration)

The Google Cloud Console provides a graphical interface to explore your resources. This is helpful for understanding the relationships between components.

##### 1. View Your Cloud Function

**Finding Cloud Functions in the Console:**

There are several ways to navigate to your Cloud Function:

**Method 1: Direct URL**
- Go directly to: [https://console.cloud.google.com/functions](https://console.cloud.google.com/functions)

**Method 2: Using the Navigation Menu**
1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **Navigation menu** (hamburger icon, three horizontal lines) in the top-left corner
3. Scroll down to find **Cloud Functions** under the "Serverless" section, OR
4. Use the search bar at the top and type "Cloud Functions", then select it from results

**Method 3: Using Search**
1. Click the search bar at the top of the Cloud Console (or press `/`)
2. Type "processImage" or "Cloud Functions"
3. Click on your function from the search results

**Once in Cloud Functions Console:**
1. Ensure your project is selected in the dropdown at the top of the page
2. You should see **processImage** in the function list with a green checkmark (indicating it's active)
3. Click on **processImage** to open the function details
4. Explore these tabs:
   - **Details**: See function configuration (runtime, memory, timeout, trigger)
   - **Source**: View the deployed code
   - **Trigger**: See the Cloud Storage trigger configuration
   - **Logs**: View execution logs (click "View in Logs Explorer" for full logs)
   - **Metrics**: See invocation counts, execution times, and errors

**What to observe:**
- The function shows **2nd gen** badge (runs on Cloud Run infrastructure)
- The trigger type is **Cloud Storage** with event type `google.cloud.storage.object.v1.finalized`
- Memory (512 MB) and timeout (540s) settings match your deployment command
- The **Region** is `europe-west2`

##### 2. Explore Cloud Storage Buckets

1. Go to [Cloud Storage Console](https://console.cloud.google.com/storage/browser)
2. You should see three buckets:
   - `image-upload-bucket-<unique-id>` - Contains your uploaded images
   - `thumbnail-bucket-<unique-id>` - Contains generated thumbnails
   - `processed-images-bucket-<unique-id>` - Contains processed images
3. Click each bucket to see:
   - **Objects tab**: Files stored in the bucket
   - **Permissions tab**: IAM policies (who has access)
   - **Lifecycle tab**: Object retention rules (if any)

**What to observe:**
- The thumbnail file is smaller (200x200 pixels)
- The processed file is in JPEG format
- Each bucket has specific IAM permissions for the service account

> **Important:** You won't find trigger configuration in the bucket settings. The bucket itself doesn't "know" it has a trigger attached to it. Triggers are configured on the **function side** (via Eventarc), not on the bucket. To see what triggers are attached to a bucket, you need to check:
> - The **Cloud Function** → Trigger tab, or
> - The **Eventarc Console** → Triggers list
>
> This is because Eventarc acts as an intermediary that monitors the bucket and routes events to the function.

##### 3. Review Firestore Data

1. Go to [Firebase Console > Firestore](https://console.firebase.google.com/project/_/firestore)
2. Select your project
3. Navigate to `image_logs` collection
4. Click on a document to expand it
5. Explore the nested fields:
   - `fileName`: Original file name
   - `sourceBucket`, `thumbnailBucket`, `processedBucket`: Bucket names
   - `basicMetadata`: Image properties from Sharp (width, height, format)
   - `fullMetadata`: EXIF data from ExifTool (camera, lens, settings)
   - `timestamp`: Processing time

**What to observe:**
- Documents have auto-generated IDs (not the filename)
- Metadata is nested (objects within objects)
- Different images may have different EXIF fields (schema flexibility)

##### 4. Examine IAM Permissions

1. Go to [IAM & Admin Console](https://console.cloud.google.com/iam-admin/iam)
2. Find the service accounts:
   - `<project-id>@appspot.gserviceaccount.com` - App Engine default (used by function)
   - `<project-number>-compute@developer.gserviceaccount.com` - Compute Engine default
   - `service-<project-number>@gs-project-accounts.iam.gserviceaccount.com` - GCS service agent
   - `service-<project-number>@gcp-sa-eventarc.iam.gserviceaccount.com` - Eventarc service agent
3. Review the roles assigned to each

**What to observe:**
- Multiple service accounts work together
- Each has specific roles following the principle of least privilege
- Service agents are managed by Google and handle infrastructure tasks

##### 5. View Cloud Run Service (2nd Gen Functions)

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on the `processimage` service
3. Explore:
   - **Revisions**: Deployment history
   - **Metrics**: Request latency, instance count
   - **Logs**: Container logs
   - **YAML**: Full service configuration

**What to observe:**
- 2nd gen Cloud Functions run on Cloud Run infrastructure
- The service has a public URL (though it's triggered by events, not HTTP)
- Container scaling is automatic

##### 6. Explore Eventarc Triggers

1. Go to [Eventarc Console](https://console.cloud.google.com/eventarc/triggers)
2. Find the trigger for your function
3. Review:
   - **Event provider**: Cloud Storage
   - **Event type**: `google.cloud.storage.object.v1.finalized`
   - **Resource**: Your source bucket
   - **Destination**: Your Cloud Function

**What to observe:**
- Eventarc connects Cloud Storage events to your function
- The trigger filters for specific bucket and event type
- Pub/Sub is used as the transport mechanism

---

#### Part B: Inspect via Command Line (CLI Exploration)

Use these commands to inspect your resources programmatically. This is useful for scripting, automation, and deeper understanding.

##### 1. Check Function Logs

```bash
gcloud functions logs read processImage --gen2 --region=europe-west2 --limit=50
```

Look for:
- "Processing file: sample.jpg"
- "Processing completed successfully"

##### 2. Describe the Cloud Function

```bash
# Get detailed function configuration
gcloud functions describe processImage --gen2 --region=europe-west2
```

This shows:
- Build configuration (runtime, entry point, source)
- Service configuration (memory, timeout, URL)
- Event trigger configuration (bucket, event type)
- State and update time

##### 3. List and Inspect Storage Buckets

```bash
# List all buckets in your project
gsutil ls

# List contents of each bucket
gsutil ls gs://image-upload-bucket-<unique-id>
gsutil ls gs://thumbnail-bucket-<unique-id>
gsutil ls gs://processed-images-bucket-<unique-id>

# Get detailed info about a specific file
gsutil stat gs://thumbnail-bucket-<unique-id>/thumbnail-sample.jpg

# View bucket IAM policy
gsutil iam get gs://image-upload-bucket-<unique-id>
```

##### 4. Inspect Cloud Run Service

```bash
# List Cloud Run services (2nd gen functions appear here)
gcloud run services list --region=europe-west2

# Get detailed service description
gcloud run services describe processimage --region=europe-west2

# View service revisions
gcloud run revisions list --service=processimage --region=europe-west2
```

##### 5. View Eventarc Triggers

```bash
# List all triggers
gcloud eventarc triggers list --location=europe-west2

# Describe the specific trigger
gcloud eventarc triggers describe processimage-* --location=europe-west2
```

##### 6. Examine IAM Bindings

```bash
# Get project IAM policy
gcloud projects get-iam-policy <your-project-id> --format=json

# List service accounts
gcloud iam service-accounts list

# Get IAM policy for a specific bucket
gsutil iam get gs://image-upload-bucket-<unique-id>
```

##### 7. Query Firestore (using gcloud)

```bash
# List Firestore databases
gcloud firestore databases list

# Export data (for backup/inspection)
gcloud firestore export gs://image-upload-bucket-<unique-id>/firestore-backup
```

##### 8. Check Enabled APIs

```bash
# List all enabled APIs
gcloud services list --enabled

# Verify specific APIs are enabled
gcloud services list --enabled --filter="name:(cloudfunctions OR eventarc OR firestore)"
```

##### 9. View Billing and Quotas

```bash
# Check billing status
gcloud billing projects describe <your-project-id>

# List quotas for Cloud Functions
gcloud compute project-info describe --project=<your-project-id>
```

---

#### Understanding the Complete Architecture

After exploring both Console and CLI, you should understand how these components work together:

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Cloud Storage  │────▶│   Eventarc   │────▶│ Cloud Function │
│  (Upload Bucket)│     │   Trigger    │     │  (processImage)│
└─────────────────┘     └──────────────┘     └───────┬────────┘
                                                     │
                        ┌────────────────────────────┼────────────────────────────┐
                        │                            │                            │
                        ▼                            ▼                            ▼
              ┌─────────────────┐        ┌─────────────────┐           ┌─────────────────┐
              │  Cloud Storage  │        │  Cloud Storage  │           │    Firestore    │
              │ (Thumbnail Bucket)│      │ (Processed Bucket)│         │  (image_logs)   │
              └─────────────────┘        └─────────────────┘           └─────────────────┘
```

**Data flow:**
1. Image uploaded to source bucket
2. Cloud Storage emits `object.finalized` event
3. Eventarc routes event to Cloud Function
4. Function downloads, processes, and uploads results
5. Metadata saved to Firestore

**Service accounts involved:**
- **App Engine default**: Runs the function code
- **GCS service agent**: Publishes events to Pub/Sub
- **Eventarc service agent**: Routes events to function
- **Compute service account**: Invokes Cloud Run service

**Reference**: [Browsing Firestore Data](https://firebase.google.com/docs/firestore/using-console)

### Troubleshooting

**Function not triggering?**
```bash
# Check function status
gcloud functions describe processImage --gen2 --region=europe-west2

# Check for errors
gcloud functions logs read processImage --gen2 --region=europe-west2 --limit=100
```

**Permission errors?**
- Verify IAM bindings (Part 2, Step 3)
- Check service account has correct roles

**Firestore write failures?**
- Verify security rules (Part 2, Step 2)
- Check rules allow server-side writes

**Reference**: [Troubleshooting Cloud Functions](https://cloud.google.com/functions/docs/troubleshooting)

## Part 6: Clean Up

**IMPORTANT**: Cloud resources cost money! Always clean up when you're done learning to avoid unexpected charges.

**Reference**: [Managing Cloud Resources](https://cloud.google.com/resource-manager/docs/creating-managing-projects#shutting_down_projects)

### 1. Delete the Cloud Function

```bash
gcloud functions delete processImage --gen2 --region=europe-west2
```

**What this does:** Removes the deployed function and stops all event triggers.

### 2. Delete Cloud Storage Buckets

```bash
# The -r flag recursively deletes all objects in the bucket
# Replace <unique-id> with your bucket identifier
gsutil rm -r gs://image-upload-bucket-<unique-id>
gsutil rm -r gs://thumbnail-bucket-<unique-id>
gsutil rm -r gs://processed-images-bucket-<unique-id>
```

**What this does:** Permanently deletes buckets and all files inside them.

### 3. Delete Firestore Data (Optional)

If you want to keep the project but remove the data:
1. Go to [Firestore Console](https://console.firebase.google.com/project/_/firestore)
2. Select the `image_logs` collection
3. Delete all documents

**Note:** You cannot delete a Firestore database once created, but you can delete all data.

**Reference**: [Deleting Firestore Data](https://firebase.google.com/docs/firestore/manage-data/delete-data)

### 4. Delete the Entire Project (Recommended)

For a complete cleanup, delete the entire project:

1. Open the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **Settings** (or **IAM & Admin > Settings**)
4. Click **Shut Down** / **Delete Project**
5. Enter the project ID to confirm

**What this does:**
- Deletes all resources (functions, buckets, databases)
- Stops all billing
- Cannot be undone (30-day grace period)

**Reference**: [Shutting Down Projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects#shutting_down_projects)

---

## Additional Learning Resources

### Advanced Topics to Explore

1. **Cloud Monitoring & Logging**
   - [Cloud Monitoring Overview](https://cloud.google.com/monitoring/docs)
   - [Logging Best Practices](https://cloud.google.com/logging/docs/best-practices)

2. **Cloud Functions Security**
   - [Security Best Practices](https://cloud.google.com/functions/docs/securing)
   - [VPC Service Controls](https://cloud.google.com/functions/docs/networking/network-settings)

3. **Firestore Advanced Features**
   - [Compound Queries](https://cloud.google.com/firestore/docs/query-data/queries)
   - [Real-time Listeners](https://firebase.google.com/docs/firestore/query-data/listen)
   - [Transactions](https://cloud.google.com/firestore/docs/manage-data/transactions)

4. **Performance Optimization**
   - [Reducing Cold Starts](https://cloud.google.com/functions/docs/bestpractices/tips#use_minimum_instances)
   - [Memory Tuning](https://cloud.google.com/functions/docs/configuring/memory)
   - [Caching Strategies](https://cloud.google.com/functions/docs/bestpractices/tips#use_global_variables)

5. **Testing & CI/CD**
   - [Functions Framework for Local Testing](https://cloud.google.com/functions/docs/functions-framework)
   - [Emulator Suite](https://firebase.google.com/docs/emulator-suite)
   - [Cloud Build Integration](https://cloud.google.com/build/docs)

### Community & Support

- **[Google Cloud Community](https://www.googlecloudcommunity.com/)** - Forums and discussions
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/google-cloud-functions)** - Q&A with google-cloud-functions tag
- **[Google Cloud Blog](https://cloud.google.com/blog/products/serverless)** - Latest updates and tutorials
- **[Firebase YouTube Channel](https://www.youtube.com/firebase)** - Video tutorials

---

## Summary

**Congratulations!** You've built a complete serverless application that demonstrates:

- **Event-driven architecture** - Automatic processing on file upload
- **Serverless computing** - No server management required
- **NoSQL databases** - Flexible document-based data storage
- **Cloud storage** - Scalable object storage
- **IAM & Security** - Proper access control and permissions
- **Idempotency** - Safe retry handling
- **Resource management** - Proper cleanup and memory management
- **Error handling** - Structured logging for observability

**Key Takeaways:**
- Cloud Functions automatically scale from 0 to millions of requests
- NoSQL databases like Firestore offer flexibility for evolving data models
- Event-driven architecture enables reactive, loosely-coupled systems
- Proper security (IAM, rules) is essential from the start
- Idempotency is critical for reliable distributed systems
- Always clean up cloud resources to control costs

**Next Steps:**
- Try modifying the function to handle videos or PDFs
- Add more complex Firestore queries
- Implement error notifications using Cloud Pub/Sub
- Build a frontend to display the processed images
- Explore Cloud Functions with HTTP triggers for APIs

