# Image Processing Application - extracting of metadata - with Google Cloud Functions

## Overview
In this exercise, you will build a secure, serverless application using Google Cloud Functions, Cloud Storage, and Firestore. The application will:
1. Process images uploaded to a Cloud Storage bucket.
2. Generate a thumbnail and save it in a separate bucket.
3. Store the processed image in another bucket.
4. Extract and log comprehensive image metadata into Firestore, a NoSQL database.
5. Implement security best practices to restrict unauthorized access.


> **NOTE:** This guide is for educational purposes only and is not intended for a production environment. Security aspects of the application are not fully covered.
{style="color: red;"}{style="font-size: 1.2em;"}{style="font-weight: bold;"}

---

## Objectives
By completing this exercise, you will:
- Gain hands-on experience with Google Cloud Functions.
- Learn to manage and secure Cloud Storage resources.
- Use Firestore to store structured metadata securely.
- Apply serverless computing and schema-less database concepts.
- Implement cleanup to ensure all resources are removed when the exercise is complete.

---

## Prerequisites
1. A Google Cloud Platform (GCP) account with billing enabled.
2. Install the following tools locally:
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
   - Node.js and npm.

---

## Part 1: Set Up a New GCP Project
### 1. Create a New Project
1. Create a new project in the [Google Cloud Console](https://console.cloud.google.com/):
   - Click "Select a project" in the top bar.
   - Click "New Project" and follow the prompts.
2. Note your **Project ID** (e.g., `your-project-id`).
3. Set the project ID as the default for the `gcloud` CLI:
   ```bash
   gcloud config set project your-project-id
   ```
4. Enable billing for the project:
   - Navigate to the **Billing** section of your project.
   - Ensure billing is enabled.


### 2. Enable APIs
Enable the necessary APIs for the project:
```bash
gcloud services enable \
    cloudfunctions.googleapis.com \
    storage.googleapis.com \
    firestore.googleapis.com \
    secretmanager.googleapis.com
```

## Part 2: Set Up Resources
### 1. Create Cloud Storage Buckets
Create the following buckets:

Bucket names in Google Cloud Storage must be unique across all users globally. 

Append a unique identifier to your bucket names. For example:

image-upload-bucket-your-unique-id
thumbnail-bucket-your-unique-id
processed-images-bucket-your-unique-id

```bash
gsutil mb -l europe-west2 gs://image-upload-bucket-dm01
gsutil mb -l europe-west2 gs://thumbnail-bucket-dm01
gsutil mb -l europe-west2 gs://processed-images-bucket-dm01
```

Grant Permissions (if you have admin access):

Use the following command to grant yourself the necessary permissions:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:YourEmailAddress@some-email.com" \
    --role="roles/storage.admin"
```

Verify Permissions:

Run the following command to check if you have access:
```bash
gcloud storage buckets list
```

# Disable public access for all buckets
```bash
gsutil iam ch -d allUsers gs://image-upload-bucket-dm01
gsutil iam ch -d allUsers gs://thumbnail-bucket-dm01
gsutil iam ch -d allUsers gs://processed-images-bucket-dm01

```
### 2. Set Up Firestore
Create a Firestore database in native mode. First install tools

```bash
npm install -g firebase-tools
npx firebase login
```
follow the login prompts

Manually add Firebase to your Google Cloud project via the Firebase Console:

Go to the [Firebase Console](https://console.firebase.google.com/u/0/).
Click Add Project.
Select Import a Google Cloud Project.
Choose immage-processing-app and add Firebase resources.

In Firebase console ensure you selected Spark (No cost) billing plan.

Verify the linking of the project to the firebase project
```bash
npx firebase projects:list
```
1. Initialize Firebase in Your Project Directory
Run the following command from your project directory:

```bash
npx firebase init
```
Follow these steps during the initialization process:

Select Features:
Choose Firestore from the list (use the arrow keys and spacebar to select).
Select Project:
Select Use an existing project and choose your linked Firebase project (immage-processing-app).
Set Up Firestore Rules:
When prompted, allow Firebase to create a firestore.rules file and a firestore.indexes.json file in your project directory.
Choose Default Settings:
Accept the default settings for Firestore.
Update Firestore Rules
After initialization, open the firestore.rules file created in your directory and replace its contents with the following:

```bash

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /image_logs/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Deploy the Rules
Deploy the rules using:
   
   ```bash

   npx firebase deploy --only firestore:rules
   ```

4. Verify the Rules
5. Open the Firestore Console and verify that the rules are set correctly.


### 3. Set Up IAM Policies
Grant the Cloud Function's service account appropriate access:
Verify service account name:

```bash
gcloud iam service-accounts list
```

Grant permissions to the service account:
```bash
# Replace Immage-Processing-App with your GCP project ID
gsutil iam ch \
    serviceAccount:immage-processing-app@appspot.gserviceaccount.com:roles/storage.objectViewer \
    gs://image-upload-bucket-dm01

gsutil iam ch \
    serviceAccount:immage-processing-app@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://thumbnail-bucket-dm01

gsutil iam ch \
    serviceAccount:immage-processing-app@appspot.gserviceaccount.com:roles/storage.objectCreator \
    gs://processed-images-bucket-dm01

```
## Part 3: Develop the Cloud Function
### 1. Initialize a Node.js Project
Create a directory for the function:

```bash
mkdir image-processing
```

Install required dependencies:
```bash

npm install @google-cloud/storage firebase-admin sharp exiftool-vendored

```
### 2. Add Function Code
Create a file named index.js and add the Cloud Function source code provided in the GitHub repository.

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


```bash
gcloud functions deploy processImage \
    --region europe-west2 \
    --runtime nodejs20 \
    --trigger-resource image-upload-bucket-dm01 \
    --trigger-event google.storage.object.finalize \
    --entry-point processImage \
    --no-gen2


```
Enable CloudbuildAPI when asked. Deployment may take a few minutes

## Part 5: Test the Application
1. Upload an image to the image-upload-bucket.

```bash   
   gsutil cp sample.jpg gs://image-upload-bucket-dm-01
```

2. Verify that the thumbnail and processed image are generated.
   - Thumbnails appear in thumbnail-bucket.
   - Processed images appear in processed-images-bucket.
   - Metadata is logged in Firestore under the image_logs collection.

## Part 6: Clean Up

1. Delete the Cloud Function:
```bash
gcloud functions delete processImage
```

2. Delete the Cloud Storage buckets:
```bash
gsutil rm -r gs://image-upload-bucket-dm01
gsutil rm -r gs://thumbnail-bucket-dm01
gsutil rm -r gs://processed-images-bucket-dm01
```

3. Delete the Project:
   - Open the [Google Cloud Console](https://console.cloud.google.com/).
   - Navigate to the project settings.
   - Click on **Shut Down**.

---

