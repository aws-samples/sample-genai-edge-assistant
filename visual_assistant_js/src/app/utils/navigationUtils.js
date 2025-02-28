// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Converts a raw image to base64 string format
 * @param {ImageData} rawImage - The raw image data to convert
 * @returns {Promise<string>} A promise that resolves with the base64 string
 */
export function rawImageToBase64(rawImage) {
  return new Promise((resolve, reject) => {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set the canvas dimensions to match the image
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;

    // Create an ImageData object
    const imageData = new ImageData(
      new Uint8ClampedArray(rawImage.data),
      rawImage.width,
      rawImage.height,
    );

    // Put the image data onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert the canvas to a base64 string
    try {
      const base64String = canvas.toDataURL('image/png');
      resolve(base64String);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a hash from a base64 image string
 * @param {string} image_base_64 - The base64 image string
 * @returns {string} A 10-character hash of the image
 */
export function getImageHash(image_base_64) {
  const hash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36); // Convert to base 36 (0-9, a-z)
  };

  // Remove the data URL prefix if present
  const imageData = image_base_64.split(',')[1] || image_base_64;

  // Generate hash
  const fullHash = hash(imageData);

  // Take the first 10 characters
  return fullHash.slice(0, 10);
}
