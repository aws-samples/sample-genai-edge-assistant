// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Box,
  Container,
  Header,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useRef } from 'react';
import CameraSelector from 'src/app/components/camera/cameraSelector';
import {
  COLOURS,
  VIDEO_DISPLAY_COMMON_STYLE,
  STATUS_CONFIG,
} from 'src/app/globals';
import useCamera from 'src/app/hooks/useCamera';
import { useDetectionStore } from 'src/app/stores/detectionStore';

const BoundingBox = ({ box, sizes, id2label, threshold }) => {
  const [xmin, ymin, xmax, ymax, score, id] = box;
  const [w, h] = sizes;

  if (score < threshold / 100) {
    return null;
  } // Skip boxes with low confidence

  // Generate a random color for the box
  const color = COLOURS[id % COLOURS.length];

  const boxStyle = {
    borderColor: color,
    left: `${(100 * xmin) / w}%`,
    top: `${(100 * ymin) / h}%`,
    width: `${(100 * (xmax - xmin)) / w}%`,
    height: `${(100 * (ymax - ymin)) / h}%`,
  };

  const labelStyle = {
    backgroundColor: color,
  };

  return (
    <div className="bounding-box" style={boxStyle}>
      <span className="bounding-box-label" style={labelStyle}>
        {`${id2label[id]} (${(100 * score).toFixed(2)}%)`}
      </span>
    </div>
  );
};

const PlaygroundCamera = ({ depthDrawingCanvasRef }) => {
  const videoRef = useRef(null);
  const {
    hasPermission,
    error,
    selectedCamera,
    availableCameras,
    status,
    handleCameraChange,
    handleRequestPermission,
  } = useCamera(videoRef);

  const statusConfig = STATUS_CONFIG[status] || {
    type: 'stopped',
    label: 'Stopped',
  };

  // Get detection overlay and depth processing state
  const overlay = useDetectionStore((state) => state.overlay);
  const { sizes, outputs, id2label } = overlay;

  const threshold = useDetectionStore((state) => state.threshold);

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Image stream stops when this component is not displayed on screen"
          info={
            <StatusIndicator type={statusConfig.type}>
              {statusConfig.label}
            </StatusIndicator>
          }
        >
          Playground mode video capture
        </Header>
      }
    >
      <CameraSelector
        selectedCamera={selectedCamera}
        availableCameras={availableCameras}
        hasPermission={hasPermission}
        onCameraChange={handleCameraChange}
        onRequestPermission={handleRequestPermission}
      />

      <Box variant="div" padding={{ horizontal: 'l', vertical: 'l' }}>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <div className="flex-1 max-w-[640px] relative border-2 border-green-600 rounded-lg">
            <video
              ref={videoRef}
              style={{ ...VIDEO_DISPLAY_COMMON_STYLE, objectFit: 'cover' }}
              autoPlay
              muted
              playsInline
            />
            <div
              className="absolute inset-0"
              style={VIDEO_DISPLAY_COMMON_STYLE}
            >
              {overlay &&
                outputs.map((output, index) => (
                  <BoundingBox
                    key={index}
                    box={output}
                    sizes={sizes}
                    id2label={id2label}
                    threshold={threshold}
                  />
                ))}
            </div>
          </div>
          <div className="flex-1 max-w-[640px] border-2 border-blue-600 rounded-lg">
            <canvas
              style={VIDEO_DISPLAY_COMMON_STYLE}
              ref={depthDrawingCanvasRef}
              width="640"
              height="480"
            />
          </div>
        </div>
      </Box>
    </Container>
  );
};

export default PlaygroundCamera;
