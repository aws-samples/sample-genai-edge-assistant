// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Box } from '@cloudscape-design/components';
import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';
import { VIDEO_DISPLAY_COMMON_STYLE } from 'src/app/globals';

const VideoDisplay = ({ videoRef }) => {
  useEffect(() => {
    const videoElement = videoRef?.current;

    // Function to ensure video plays
    const ensureVideoPlays = () => {
      if (videoElement) {
        const playPromise = videoElement.play();

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn('Autoplay was prevented', error);
          });
        }
      }
    };

    // Visibility change listener
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        ensureVideoPlays();
      }
    };

    // Intersection Observer handler
    const handleIntersection = () => {
      ensureVideoPlays();
    };

    // Intersection Observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleIntersection();
        }
      },
      { threshold: 0 },
    );

    // Start observing if video element exists
    if (videoElement) {
      observer.observe(videoElement);
    }

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (videoElement) {
        observer.unobserve(videoElement);
      }
    };
  }, [videoRef]);

  return (
    <Box variant="div" padding={{ horizontal: 'l', vertical: 'l' }}>
      <div className="flex flex-col sm:flex-row justify-center gap-4 relative border-2 max-w-[640px] border-blue-600 rounded-lg">
        <video
          ref={videoRef}
          style={{ ...VIDEO_DISPLAY_COMMON_STYLE, objectFit: 'cover' }}
          autoPlay
          muted
          playsInline
        />
      </div>
    </Box>
  );
};

export default dynamic(() => Promise.resolve(VideoDisplay), {
  ssr: false,
  loading: () => <p>Loading...</p>,
});
