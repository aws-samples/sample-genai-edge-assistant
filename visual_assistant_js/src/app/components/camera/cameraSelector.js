// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { FormField, Select, Button } from '@cloudscape-design/components';

const CameraSelector = ({
  selectedCamera,
  availableCameras,
  hasPermission,
  onCameraChange,
  onRequestPermission,
}) => {
  return (
    <FormField label="Camera">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Select
            selectedOption={selectedCamera}
            onChange={({ detail }) => onCameraChange(detail.selectedOption)}
            options={availableCameras}
            placeholder="Select a camera"
          />
        </div>
        {!hasPermission && (
          <div className="flex-none">
            <Button onClick={onRequestPermission}>Request Camera Access</Button>
          </div>
        )}
      </div>
    </FormField>
  );
};

export default CameraSelector;
