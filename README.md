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

## 📚 Learning Resources

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
1. Create a new project in the [Google Cloud Console](https://console.cloud.google.com/):
   - Click "Select a project" in the top bar.
   - Click "New Project" and follow the prompts.
2. Note your **Project ID** (e.g., `your-project-id`).
3. Set the project ID as the default for the `gcloud` CLI:
   ```bash
   gcloud config set project `your-project-id`
   ```
4. Enable billing for the project:
   - Navigate to the **Billing** section of your project.
   - Ensure billing is enabled.


### 2. Enable APIs

**What are APIs?** Google Cloud services expose their functionality through APIs (Application Programming Interfaces). Before using any service, you must enable its API for your project.

**📖 Reference**: [Enabling and Disabling APIs](https://cloud.google.com/apis/docs/getting-started#enabling_apis)

Enable the necessary APIs for the project:
```bash
gcloud services enable \
    cloudfunctions.googleapis.com \
    storage.googleapis.com \
    firestore.googleapis.com \
    secretmanager.googleapis.com
```

**What each API does:**
- `cloudfunctions.googleapis.com` - Allows you to create and manage Cloud Functions
- `storage.googleapis.com` - Enables Cloud Storage for file storage
- `firestore.googleapis.com` - Provides access to Firestore NoSQL database
- `secretmanager.googleapis.com` - Manages sensitive configuration data (optional for this exercise)

## Part 2: Set Up Resources

### 1. Create Cloud Storage Buckets

**What is Cloud Storage?** Cloud Storage is Google's object storage service for storing unstructured data like images, videos, and backups. Data is organized in "buckets" (containers) that hold "objects" (files).

**📖 References**:
- [Cloud Storage Buckets Overview](https://cloud.google.com/storage/docs/buckets)
- [Storage Locations](https://cloud.google.com/storage/docs/locations)

**Important Naming Requirements:**

Bucket names in Google Cloud Storage must be **globally unique** across all Google Cloud users worldwide. This is similar to domain names - no two buckets can have the same name.

**📖 Reference**: [Bucket Naming Guidelines](https://cloud.google.com/storage/docs/naming-buckets)

Append a unique identifier to your bucket names. For example:
- `image-upload-bucket-your-unique-<unique-id>`
- `thumbnail-bucket-your-unique-<unique-id>`
- `processed-images-bucket-your-unique-<unique-id>`

Create the three buckets (replace `<unique-id>` with your unique identifier):

```bash
# The -l flag specifies the location (europe-west2 = London)
# Choose a region close to your users for better performance
gsutil mb -l europe-west2 gs://image-upload-bucket-your-unique-<unique-id>
gsutil mb -l europe-west2 gs://thumbnail-bucket-your-unique-<unique-id>
gsutil mb -l europe-west2 gs://processed-images-bucket-your-unique-<unique-id>
```

**Why three separate buckets?**
1. **Separation of concerns**: Different buckets for different purposes
2. **Access control**: You can set different permissions on each bucket
3. **Organization**: Easier to manage and audit
4. **Best practice**: Follows the principle of least privilege

***NOTE***:
Make sure bucket names are unique and take note of them for later use.
In the `index.js` file, update the following code with your bucket names:

```javascript
// Bucket Names
const SOURCE_BUCKET = 'image-upload-bucket-your-unique-<unique-id>';
const THUMBNAIL_BUCKET = 'thumbnail-bucket-your-unique-<unique-id>';
const PROCESSED_BUCKET = 'processed-images-bucket-your-unique-<unique-id>';
```


Grant Permissions (if you have admin access):

Use the following command to grant yourself the necessary permissions:
Make sure that you have used your own email address in the command below, also use own project name like 'firebase-images-479513'.
```bash
gcloud projects add-iam-policy-binding `your-project-id` \
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

**📖 Reference**: [Cloud Storage Security Best Practices](https://cloud.google.com/storage/docs/best-practices#security)

Disable public access for all buckets:
```bash
gsutil iam ch -d allUsers gs://image-upload-bucket-your-unique-<unique-id>
gsutil iam ch -d allUsers gs://thumbnail-bucket-your-unique-<unique-id>
gsutil iam ch -d allUsers gs://processed-images-bucket-your-unique-<unique-id>
```

**What this command does:** The `-d` flag removes (`deletes`) the IAM binding for `allUsers`, ensuring only authenticated users with proper permissions can access these buckets.
### 2. Set Up Firestore

**What is Firestore?** Firestore is a flexible, scalable NoSQL cloud database that stores data in documents organized into collections. Unlike traditional relational databases with tables and rows, Firestore uses a document-based model similar to JSON.

**📖 References**:
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

**📖 Deep Dive**: [Understanding NoSQL Databases](https://cloud.google.com/firestore/docs/concepts)

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

**📖 Reference**: [Firebase CLI Reference](https://firebase.google.com/docs/cli)

#### Link Firebase to Your Google Cloud Project

Manually add Firebase to your Google Cloud project via the Firebase Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/u/0/)
2. Click **Add Project**
3. Select **Import a Google Cloud Project** or **Add Firebase to Google Cloud project**
4. Choose your Google Cloud project (the one you created in Part 1) and add Firebase resources

**Why link Firebase?** Firebase provides additional tools and SDKs that work seamlessly with Google Cloud services like Firestore.

In Firebase console ensure you selected **Spark (No cost)** billing plan for learning purposes.

Verify the linking of the project to the firebase project:
```bash
npx firebase projects:list
```
Preparing the list of your Firebase projects
┌──────────────────────┬────────────────────────┬────────────────┬──────────────────────┐
│ Project Display Name │ Project ID             │ Project Number │ Resource Location ID │
├──────────────────────┼────────────────────────┼────────────────┼──────────────────────┤
│ firebase-images      │ firebase-images-479513 │ 473925997700   │ [Not specified]      │
└──────────────────────┴────────────────────────┴────────────────┴──────────────────────┘

You should see your Google Cloud project listed with a Firebase project ID.

#### Initialize Firebase in Your Project Directory

**What does `firebase init` do?** This command sets up your local development environment for working with Firebase services. It creates configuration files that define how Firestore should be set up.

**📖 Reference**: [Initialize Firebase Projects](https://firebase.google.com/docs/cli#initialize_a_firebase_project)

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

**📖 Reference**: [Firebase Configuration Files](https://firebase.google.com/docs/cli#the_firebasejson_file)
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

**📖 Reference**: [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)

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

**📖 More Resources**:
- [Writing Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Testing Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

#### Understanding What Happens During Firestore Deployment

When you deploy Firestore rules, here's what actually happens behind the scenes:

**📖 Reference**: [How Security Rules Work](https://firebase.google.com/docs/firestore/security/rules-conditions)

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
   - Firestore checks: `request.resource != null` ✅ (data is present)
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

**📖 Reference**: [Firestore Automatic Database Creation](https://firebase.google.com/docs/firestore/quickstart)

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

**📖 Reference**: [Deploying Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started#use_the_firebase_cli)

#### Verify the Rules

Open the [Firestore Console](https://console.firebase.google.com/project/_/firestore/rules) and verify that the rules are set correctly.

You should see your rules displayed in the "Rules" tab. The status should show as "Published".


### 3. Set Up IAM Policies

**What is IAM?** Identity and Access Management (IAM) controls who (identity) has what access (roles) to which resources. It's a fundamental security concept in cloud computing.

**📖 References**:
- [IAM Overview](https://cloud.google.com/iam/docs/overview)
- [Understanding Service Accounts](https://cloud.google.com/iam/docs/service-account-overview)
- [IAM Roles for Storage](https://cloud.google.com/storage/docs/access-control/iam-roles)

**What is a Service Account?** Cloud Functions run as "service accounts" - special Google accounts that represent your application rather than a human user.

#### Verify Service Account

First, list service accounts to find the default App Engine service account:

```bash
gcloud iam service-accounts list
```

Look for an account like `firebase-nosql@appspot.gserviceaccount.com`

#### Identify the Cloud Storage Service Agent (needed for Eventarc triggers)

When Cloud Storage emits Object Finalize events to Eventarc (which then invokes your Cloud Function), Google uses a **Cloud Storage service agent** inside your project. This agent must be able to publish to Pub/Sub; otherwise the trigger creation fails during deployment.

- **Service agent format**: `service-<PROJECT_NUMBER>@gs-project-accounts.iam.gserviceaccount.com`

Steps to locate the correct email:
1. Retrieve the project number:
   ```bash
   gcloud projects describe firebase-nosql --format="value(projectNumber)"
   ```
2. Substitute the number <PROJECT_NUMBER> with the number you get (e.g., `427242312382`) into the service agent email:
   ```
   service-<PROJECT_NUMBER>@gs-project-accounts.iam.gserviceaccount.com
   ```

**Console alternative**:
1. Open **IAM & Admin → IAM** in the Cloud Console.
2. Use the filter chip **"Role: Storage Service Agent"** or search for `gs-project-accounts`.
3. Copy the email address shown—it should match the pattern above.

📖 **Reference**: [Eventarc Cloud Storage trigger prerequisites](https://cloud.google.com/eventarc/docs/run/storage#before-you-begin)

#### Grant Pub/Sub Publisher role to the service agent

Assign the Pub/Sub Publisher role so the service agent can deliver events to Eventarc. Replace the project number with yours.

```bash
gcloud projects add-iam-policy-binding firebase-nosql \
    --member="serviceAccount:service-<PROJECT_NUMBER>@gs-project-accounts.iam.gserviceaccount.com" \
    --role="roles/pubsub.publisher"
```

If you skip this step, deployments fail with errors similar to: `The Cloud Storage service account for your bucket is unable to publish to Cloud Pub/Sub topics... permission denied`.

*Optional verification*:
```bash
gcloud projects get-iam-policy firebase-nosql \
    --flatten="bindings[].members" \
    --filter="bindings.role:roles/pubsub.publisher AND bindings.members:service-427242312382@gs-project-accounts.iam.gserviceaccount.com" \
    --format="table(bindings.role, bindings.members)"
```

IAM propagation can take ~60 seconds—wait briefly before redeploying the function.

#### Grant Storage Permissions

Grant permissions to the service account using the **Principle of Least Privilege** (only the minimum permissions needed):
```bash
# Replace YOUR-PROJECT-ID with your actual GCP project ID from Part 1
# Replace the bucket names with your unique bucket names
gsutil iam ch \
    serviceAccount:firebase-nosql@appspot.gserviceaccount.com:roles/storage.objectViewer \
    gs://image-upload-bucket-dm06

gsutil iam ch \
    serviceAccount:firebase-nosql@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://thumbnail-bucket-dm06

gsutil iam ch \
    serviceAccount:firebase-nosql@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://processed-images-bucket-dm06
```

**Understanding the IAM roles:**
- **`roles/storage.objectViewer`**: Can read (download) objects from the source bucket
- **`roles/storage.objectCreator`**: Can create (upload) new objects to the thumbnail and processed buckets
- **Why not Admin?**: Following security best practices - the function only needs read access to source and write access to output buckets

**📖 Reference**: [Cloud Storage IAM Roles](https://cloud.google.com/storage/docs/access-control/iam-roles)

---

## Part 3: Develop the Cloud Function

**📖 Key References for This Section**:
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

**📖 Reference**: [Idempotent Cloud Functions](https://cloud.google.com/functions/docs/bestpractices/retries)

#### Event-Driven Trigger
The function automatically runs when a file is uploaded to the source bucket. The `event` parameter contains file information.

**📖 Reference**: [Storage Events](https://cloud.google.com/functions/docs/calling/storage#event_structure)

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

**📖 Reference**: [Execution Environment](https://cloud.google.com/functions/docs/concepts/execution-environment)

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

**📖 Reference**: [Initialize Firebase Admin SDK](https://firebase.google.com/docs/admin/setup#initialize-sdk)

**2. Build the Document Data (index.js, lines 106-114):**
```javascript
const logEntry = {
    fileName,                      // String: "sample.jpg"
    sourceBucket: SOURCE_BUCKET,   // String: "image-upload-bucket-dm01"
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
  sourceBucket: "image-upload-bucket-dm01",
  thumbnailBucket: "thumbnail-bucket-dm01",
  processedBucket: "processed-images-bucket-dm01",
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
    "sourceBucket": { "stringValue": "image-upload-bucket-dm01" },
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
        ├── sourceBucket: "image-upload-bucket-dm01"
        ├── thumbnailBucket: "thumbnail-bucket-dm01"
        ├── processedBucket: "processed-images-bucket-dm01"
        ├── basicMetadata: { ... }
        ├── fullMetadata: { ... }
        └── timestamp: "2025-01-19T10:00:00.000Z"
```

**Why `.add()` instead of `.set()`?**

**📖 Reference**: [Add vs Set in Firestore](https://firebase.google.com/docs/firestore/manage-data/add-data)

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

**📖 Deep Dive**: [Firestore Data Types](https://firebase.google.com/docs/firestore/manage-data/data-types)

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

**📖 Key References**:
- [Deploying Cloud Functions](https://cloud.google.com/functions/docs/deploy)
- [2nd Generation Functions](https://cloud.google.com/functions/docs/2nd-gen/overview)
- [Function Configuration Options](https://cloud.google.com/functions/docs/configuring)

### Check Billing Status

Verify if billing is enabled on the project:
```bash
gcloud beta billing projects describe immage-processing-app
```
Look for the billingEnabled field in the output. If it’s set to false, you need to enable billing.

```bash
gcloud beta billing projects link immage-processing-app --billing-account=BILLING_ACCOUNT_ID
```
Replace BILLING_ACCOUNT_ID with your billing account ID. You can retrieve it using:
   
   ```bash
   gcloud beta billing accounts list
   ```


Deploy the Cloud Function using the following command:

***NOTE***: Update the bucket names in the command below with your unique bucket names.

**IMPORTANT**: This deployment uses 2nd generation Cloud Functions which provides better performance, higher concurrency, and modern features.

```bash
gcloud functions deploy processImage \
    --gen2 \
    --region europe-west2 \
    --runtime nodejs22 \
    --trigger-bucket image-upload-bucket-dm06 \
    --entry-point processImage \
    --memory 512MB \
    --timeout 540s


```

**Understanding the Deployment Parameters:**

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| `--gen2` | (flag) | Uses 2nd generation Cloud Functions (modern, recommended) |
| `--region` | europe-west2 | London region - choose one close to your users |
| `--runtime` | nodejs20 | Node.js version 20 (matches package.json engines field) |
| `--trigger-bucket` | image-upload-bucket-dm01 | Automatically runs when files are uploaded here |
| `--entry-point` | processImage | The function name in index.js to execute |
| `--memory` | 512MB | RAM allocated (256MB-32GB available) |
| `--timeout` | 540s | Max execution time (9 minutes; max 60 min for HTTP) |

**📖 References**:
- [Runtime Options](https://cloud.google.com/functions/docs/concepts/execution-environment)
- [Memory and CPU Allocation](https://cloud.google.com/functions/docs/configuring/memory)
- [Storage Triggers](https://cloud.google.com/functions/docs/calling/storage)

**Why 2nd Generation Cloud Functions?**

**📖 Reference**: [2nd Gen vs 1st Gen Comparison](https://cloud.google.com/functions/docs/2nd-gen/overview)

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

Enable CloudbuildAPI when asked. Deployment may take a few minutes (typically 2-5 minutes for first deployment).

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
# Replace with your actual bucket name
gsutil cp ./image-processing/sample.jpg gs://image-upload-bucket-dm06
```

**Don't have a test image?** Download one:
```bash
curl -o sample.jpg https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/JPEG_example_flower.jpg/640px-JPEG_example_flower.jpg
```

### Verify Results

**📖 Reference**: [Viewing Function Logs](https://cloud.google.com/functions/docs/monitoring/logging)

#### 1. Check Function Logs
```bash
gcloud functions logs read processImage --gen2 --region=europe-west2 --limit=50
```

Look for:
- "Processing file: sample.jpg"
- "Processing completed successfully"

#### 2. Verify Storage Buckets

Check thumbnail was created:
```bash
gsutil ls gs://thumbnail-bucket-your-unique-<unique-id>
```

Check processed image:
```bash
gsutil ls gs://processed-images-bucket-your-unique-<unique-id>
```

You should see:
- `thumbnail-sample.jpg` (200x200 pixels)
- `processed-sample.jpg` (converted to JPEG format)

#### 3. Check Firestore Data

Go to [Firestore Console](https://console.firebase.google.com/project/_/firestore) and:
1. Navigate to `image_logs` collection
2. Click on the document for your image
3. Explore the metadata fields:
   - **basicMetadata**: Image dimensions, format, color space
   - **fullMetadata**: EXIF data (camera model, GPS coordinates if available, timestamps)
   - **timestamp**: When processing occurred

**Understanding the data:**
- **Document model**: Each upload creates a new document
- **Nested data**: Metadata is stored as nested fields (NoSQL flexibility)
- **Automatic IDs**: Firestore generates unique document IDs

**📖 Reference**: [Browsing Firestore Data](https://firebase.google.com/docs/firestore/using-console)

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

**📖 Reference**: [Troubleshooting Cloud Functions](https://cloud.google.com/functions/docs/troubleshooting)

## Part 6: Clean Up

**⚠️ IMPORTANT**: Cloud resources cost money! Always clean up when you're done learning to avoid unexpected charges.

**📖 Reference**: [Managing Cloud Resources](https://cloud.google.com/resource-manager/docs/creating-managing-projects#shutting_down_projects)

### 1. Delete the Cloud Function

```bash
gcloud functions delete processImage --gen2 --region=europe-west2
```

**What this does:** Removes the deployed function and stops all event triggers.

### 2. Delete Cloud Storage Buckets

```bash
# The -r flag recursively deletes all objects in the bucket
gsutil rm -r gs://image-upload-bucket-your-unique-<unique-id>
gsutil rm -r gs://thumbnail-bucket-your-unique-<unique-id>
gsutil rm -r gs://processed-images-bucket-your-unique-<unique-id>
```

**What this does:** Permanently deletes buckets and all files inside them.

### 3. Delete Firestore Data (Optional)

If you want to keep the project but remove the data:
1. Go to [Firestore Console](https://console.firebase.google.com/project/_/firestore)
2. Select the `image_logs` collection
3. Delete all documents

**Note:** You cannot delete a Firestore database once created, but you can delete all data.

**📖 Reference**: [Deleting Firestore Data](https://firebase.google.com/docs/firestore/manage-data/delete-data)

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

**📖 Reference**: [Shutting Down Projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects#shutting_down_projects)

---

## 📚 Additional Learning Resources

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

**Congratulations!** 🎉 You've built a complete serverless application that demonstrates:

✅ **Event-driven architecture** - Automatic processing on file upload
✅ **Serverless computing** - No server management required
✅ **NoSQL databases** - Flexible document-based data storage
✅ **Cloud storage** - Scalable object storage
✅ **IAM & Security** - Proper access control and permissions
✅ **Idempotency** - Safe retry handling
✅ **Resource management** - Proper cleanup and memory management
✅ **Error handling** - Structured logging for observability

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

