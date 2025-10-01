// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Image processing utilities for backend integration
 */

// Constants for image validation
export const IMAGE_VALIDATION = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DIMENSIONS: {
    width: 4096,
    height: 4096,
  },
  MIN_DIMENSIONS: {
    width: 32,
    height: 32,
  },
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: /\.(jpg|jpeg|png|webp)$/i,
};

/**
 * Convert File object to ArrayBuffer
 * @param {File} file - The image file to convert
 * @returns {Promise<ArrayBuffer>} - Promise that resolves to ArrayBuffer
 */
export const fileToArrayBuffer = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target.result);
    };

    reader.onerror = (error) => {
      reject(new Error(`Failed to read file: ${error.message}`));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Validate image file
 * @param {File} file - The image file to validate
 * @returns {Promise<{isValid: boolean, errors: string[]}>} - Validation result
 */
export const validateImageFile = async (file) => {
  const errors = [];

  try {
    // Check file size
    if (file.size > IMAGE_VALIDATION.MAX_FILE_SIZE) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${IMAGE_VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Check file type
    const isValidType = IMAGE_VALIDATION.ALLOWED_TYPES.includes(file.type.toLowerCase());
    const hasValidExtension = IMAGE_VALIDATION.ALLOWED_EXTENSIONS.test(file.name.toLowerCase());

    if (!isValidType && !hasValidExtension) {
      errors.push('Unsupported file format. Please use JPG, PNG, or WebP files.');
    }

    // Check image dimensions
    const dimensions = await getImageDimensions(file);
    if (dimensions) {
      if (dimensions.width > IMAGE_VALIDATION.MAX_DIMENSIONS.width ||
        dimensions.height > IMAGE_VALIDATION.MAX_DIMENSIONS.height) {
        errors.push(`Image dimensions (${dimensions.width}x${dimensions.height}) exceed maximum allowed size (${IMAGE_VALIDATION.MAX_DIMENSIONS.width}x${IMAGE_VALIDATION.MAX_DIMENSIONS.height})`);
      }

      if (dimensions.width < IMAGE_VALIDATION.MIN_DIMENSIONS.width ||
        dimensions.height < IMAGE_VALIDATION.MIN_DIMENSIONS.height) {
        errors.push(`Image dimensions (${dimensions.width}x${dimensions.height}) are below minimum required size (${IMAGE_VALIDATION.MIN_DIMENSIONS.width}x${IMAGE_VALIDATION.MIN_DIMENSIONS.height})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      dimensions,
    };

  } catch (error) {
    errors.push(`Failed to validate image: ${error.message}`);
    return {
      isValid: false,
      errors,
      dimensions: null,
    };
  }
};

/**
 * Get image dimensions from file
 * @param {File} file - The image file
 * @returns {Promise<{width: number, height: number} | null>} - Image dimensions or null if failed
 */
export const getImageDimensions = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};

/**
 * Process image for backend processing
 * Converts image file to ArrayBuffer with validation
 * @param {File} file - The image file to process
 * @returns {Promise<{buffer: ArrayBuffer, metadata: object}>} - Processed image data
 */
export const processImageForBackend = async (file) => {
  try {
    // Validate the image file
    const validation = await validateImageFile(file);

    if (!validation.isValid) {
      throw new Error(`Image validation failed: ${validation.errors.join(', ')}`);
    }

    // Convert to ArrayBuffer
    const buffer = await fileToArrayBuffer(file);

    // Create metadata
    const metadata = {
      filename: file.name,
      size: file.size,
      type: file.type,
      dimensions: validation.dimensions,
      processedAt: new Date().toISOString(),
    };

    return {
      buffer,
      metadata,
    };

  } catch (error) {
    throw new Error(`Failed to process image for backend: ${error.message}`);
  }
};

/**
 * Process multiple images for backend processing
 * @param {File[]} files - Array of image files to process
 * @returns {Promise<{processed: Array, errors: Array}>} - Results with processed images and errors
 */
export const processMultipleImagesForBackend = async (files) => {
  const processed = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      const result = await processImageForBackend(file);
      processed.push({
        index: i,
        file,
        ...result,
      });
    } catch (error) {
      errors.push({
        index: i,
        file,
        error: error.message,
      });
    }
  }

  return {
    processed,
    errors,
  };
};

/**
 * Create a resized version of an image if it exceeds maximum dimensions
 * @param {File} file - The image file to resize
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} - Resized image file
 */
export const resizeImageIfNeeded = async (file, maxWidth = 2048, maxHeight = 2048, quality = 0.9) => {
  const dimensions = await getImageDimensions(file);

  if (!dimensions || (dimensions.width <= maxWidth && dimensions.height <= maxHeight)) {
    return file; // No resize needed
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      const aspectRatio = dimensions.width / dimensions.height;
      let newWidth = dimensions.width;
      let newHeight = dimensions.height;

      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = newWidth / aspectRatio;
      }

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
      }

      // Set canvas dimensions
      canvas.width = newWidth;
      canvas.height = newHeight;

      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);

          if (blob) {
            // Create new file with resized image
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = url;
  });
};

/**
 * Error classes for image processing
 */
export class ImageProcessingError extends Error {
  constructor(message, code = 'IMAGE_PROCESSING_ERROR') {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
  }
}

export class ImageValidationError extends ImageProcessingError {
  constructor(message, validationErrors = []) {
    super(message, 'IMAGE_VALIDATION_ERROR');
    this.name = 'ImageValidationError';
    this.validationErrors = validationErrors;
  }
}

export class ImageConversionError extends ImageProcessingError {
  constructor(message) {
    super(message, 'IMAGE_CONVERSION_ERROR');
    this.name = 'ImageConversionError';
  }
}