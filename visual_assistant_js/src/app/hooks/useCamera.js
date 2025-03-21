// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, useEffect, useRef } from 'react';
import { RawImage } from '@huggingface/transformers';
import FrameManager from 'src/app/utils/frameManager';

const DEFAULT_VIDEO_CONFIG = {
  width: { ideal: 640 },
  height: { ideal: 480 },
};

const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

const useCamera = (videoRef) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [status, setStatus] = useState('initializing');
  const processingCanvas = useRef(new OffscreenCanvas(640, 480));
  const streamRef = useRef(null);

  const handleError = (errorMessage) => {
    console.error(errorMessage);
    setError(errorMessage);
    setStatus('error');
    setHasPermission(false);
  };

  const enumerateCameras = async () => {
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      window.mediaStream = initialStream;
      const devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(
        (device) => device.kind === 'videoinput',
      );

      // Ensure device labels are available
      if (videoDevices.some((device) => !device.label)) {
        await navigator.mediaDevices.getUserMedia({ video: true });
        videoDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === 'videoinput',
        );
      }

      const formattedDevices = videoDevices.map((device) => ({
        label: device.label || `Camera ${device.deviceId.slice(0, 4)}...`,
        value: device.deviceId,
        facingMode:
          device.getCapabilities?.()?.facingMode?.[0] ||
          (device.label.toLowerCase().includes('back')
            ? 'environment'
            : device.label.toLowerCase().includes('front')
              ? 'user'
              : null),
      }));

      setAvailableCameras(formattedDevices);

      // Select default camera
      if (formattedDevices.length > 0) {
        const defaultCamera = isMobile()
          ? formattedDevices.find(
            (device) =>
              device.facingMode === 'environment' ||
                device.label.toLowerCase().includes('back'),
          )
          : formattedDevices[0];
        setSelectedCamera(defaultCamera || formattedDevices[0]);
      }

      initialStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      handleError('Failed to enumerate video devices');
    }
  };

  // Cleanup stream and reset references
  const cleanup = () => {
    FrameManager.getInstance().unregisterCallback();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Camera setup
  useEffect(() => {
    enumerateCameras();
    return cleanup;
  }, []);

  // Camera connection
  useEffect(() => {
    const setupCamera = async () => {
      if (!selectedCamera) {
        return;
      }

      try {
        setStatus('connecting');

        const constraints = {
          video: {
            deviceId: { exact: selectedCamera.value },
            ...DEFAULT_VIDEO_CONFIG,
          },
        };

        cleanup();

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current.readyState >= 2) {
                resolve();
              }
            };
          });

          setHasPermission(true);
          setError(null);
          setStatus('capturing');

          // Register frame capture callback
          FrameManager.getInstance().registerCallback(() => {
            try {
              const video = videoRef.current;
              if (!video || video.readyState !== 4) {
                return null;
              }

              const ctx = processingCanvas.current.getContext('2d', {
                willReadFrequently: true,
              });
              if (!ctx) {
                return null;
              }

              ctx.drawImage(video, 0, 0, 640, 480);
              const pixelData = ctx.getImageData(0, 0, 640, 480).data;

              return new RawImage(pixelData, 640, 480, 4);
            } catch (err) {
              handleError('Frame capture error');
              return null;
            }
          });
        }
      } catch (err) {
        handleError('Camera access denied or not available');
      }
    };

    setupCamera();
    return cleanup;
  }, [selectedCamera]);

  useEffect(() => cleanup, []);

  // Permission request handler
  const handleRequestPermission = async () => {
    try {
      setStatus('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      cleanup();
      streamRef.current = stream;

      setHasPermission(true);
      setError(null);
      setStatus('capturing');
    } catch (err) {
      handleError('Camera access denied');
    }
  };

  return {
    hasPermission,
    error,
    selectedCamera,
    availableCameras,
    status,
    handleCameraChange: setSelectedCamera,
    handleRequestPermission,
  };
};

export default useCamera;
