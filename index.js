const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const fs = require('fs');

// Initialize Firestore
admin.initializeApp();
const db = admin.firestore();

// Google Cloud Storage
const storage = new Storage();

// Bucket Names
const SOURCE_BUCKET = 'image-upload-bucket-dm01';
const THUMBNAIL_BUCKET = 'thumbnail-bucket-dm01';
const PROCESSED_BUCKET = 'processed-images-bucket-dm01';

// Helper function to convert metadata to Firestore-compatible format
const makeFirestoreCompatible = (data) => {
    const result = {};
    for (const key in data) {
        if (data[key] && typeof data[key] === 'object') {
            if (typeof data[key].toString === 'function') {
                // Convert objects with a toString method to strings
                result[key] = data[key].toString();
            } else if (Buffer.isBuffer(data[key])) {
                // Convert binary fields (e.g., Hash) to base64 strings
                result[key] = data[key].toString('base64');
            } else {
                // Recursively process nested objects
                result[key] = makeFirestoreCompatible(data[key]);
            }
        } else {
            // Directly copy primitive values
            result[key] = data[key];
        }
    }
    return result;
};

exports.processImage = async (event, context) => {
    const file = event;
    const fileName = file.name || event.name;

    console.log('Full Event Payload:', JSON.stringify(event, null, 2));
    console.log('File Name:', fileName);

    if (!fileName) {
        throw new Error('File name is missing from the event payload');
    }

    // Check if file has already been processed (idempotency)
    const existingLog = await db.collection('image_logs')
        .where('fileName', '==', fileName)
        .limit(1)
        .get();

    if (!existingLog.empty) {
        console.log(`File ${fileName} already processed, skipping to prevent duplicate processing`);
        return;
    }

    const sourceBucket = storage.bucket(SOURCE_BUCKET);
    const thumbnailBucket = storage.bucket(THUMBNAIL_BUCKET);
    const processedBucket = storage.bucket(PROCESSED_BUCKET);

    const tempFilePath = `/tmp/${fileName.split('/').pop()}`;
    const processedImagePath = `/tmp/processed-${fileName.split('/').pop()}`;
    const thumbnailPath = `/tmp/thumbnail-${fileName.split('/').pop()}`;

    try {
        console.log(`Processing file: ${fileName}`);

        // Normalize the file path
        const filePath = fileName.startsWith('/') ? fileName.slice(1) : fileName;

        // Download the image from the source bucket
        await sourceBucket.file(filePath).download({ destination: tempFilePath });

        // Validate the file type
        if (!fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
            console.error(`Unsupported file type: ${fileName}`);
            return;
        }

        // Generate a thumbnail
        const image = sharp(tempFilePath);
        const basicMetadata = await image.metadata();
        await image.resize(200, 200).toFile(thumbnailPath);

        // Extract comprehensive metadata using exiftool
        const fullMetadata = await exiftool.read(tempFilePath);

        // Convert metadata to Firestore-compatible format
        const firestoreMetadata = makeFirestoreCompatible(fullMetadata);

        // Upload the thumbnail
        await thumbnailBucket.upload(thumbnailPath, { destination: `thumbnail-${fileName.split('/').pop()}` });

        // Process and save the image
        await image.toFormat('jpeg').toFile(processedImagePath);
        await processedBucket.upload(processedImagePath, { destination: `processed-${fileName.split('/').pop()}` });

        // Log metadata to Firestore
        const logEntry = {
            fileName,
            sourceBucket: SOURCE_BUCKET,
            thumbnailBucket: THUMBNAIL_BUCKET,
            processedBucket: PROCESSED_BUCKET,
            basicMetadata,
            fullMetadata: firestoreMetadata, // Store converted metadata
            timestamp: new Date().toISOString(),
        };
        await db.collection('image_logs').add(logEntry);

        console.log('Processing completed successfully:', logEntry);
    } catch (error) {
        // Structured error logging for Cloud Error Reporting
        console.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Error processing file',
            fileName: fileName,
            error: error.message,
            stack: error.stack
        }));
        throw error;
    } finally {
        // Cleanup temporary files
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
        if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);

        // Cleanup ExifTool process to prevent memory leaks
        await exiftool.end();
    }
};
