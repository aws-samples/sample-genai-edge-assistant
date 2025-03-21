// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  Container,
  Header,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useRef } from 'react';
import CameraSelector from 'src/app/components/camera/cameraSelector';
import VideoDisplay from 'src/app/components/camera/videoDisplay';
import { STATUS_CONFIG } from 'src/app/globals';
import useCamera from 'src/app/hooks/useCamera';

const NavigationCamera = () => {
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
  const statusIndicator = error ? (
    <StatusIndicator type="error">{error}</StatusIndicator>
  ) : (
    <StatusIndicator type={statusConfig.type}>
      {statusConfig.label}
    </StatusIndicator>
  );

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Image stream stops when this component is not displayed on screen"
          info={statusIndicator}
        >
          Navigation mode video capture
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
      <VideoDisplay videoRef={videoRef} />
    </Container>
  );
};

export default NavigationCamera;
