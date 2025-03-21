// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Container,
  Header,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useEffect, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useDepthStore } from 'src/app/stores/depthStore';
import { useDetectionStore } from 'src/app/stores/detectionStore';
import { useMetaStore } from 'src/app/stores/metaStore';
import { useDepthProcessing } from 'src/app/hooks/useDepthProcessing';
import { useDetectionProcessing } from 'src/app/hooks/useDetectionProcessing';

import { calculateMedian } from 'src/app/utils/utils';

const ObjectDistancesBox = () => {
  const [distanceObject, setDistanceObjects] = useState(null);

  const alertThreshold = useMetaStore((state) => state.alertThreshold);

  const { status: depthStatus } = useDepthProcessing();
  const { status: detectionStatus } = useDetectionProcessing();

  const actualDepth = useDepthStore((state) => state.actualDepth, shallow);
  const actualDepthHeight = useDepthStore(
    (state) => state.actualDepthHeight,
    shallow,
  );
  const actualDepthWidth = useDepthStore(
    (state) => state.actualDepthWidth,
    shallow,
  );

  const detectionInfo = useDetectionStore(
    (state) => state.detectionInfo,
    shallow,
  );
  const threshold = useDetectionStore((state) => state.threshold, shallow);

  const isRunning = depthStatus === 'ready' && detectionStatus === 'ready';

  useEffect(() => {
    if (isRunning) {
      setDistanceObjects(
        calculateMedian(
          actualDepth,
          detectionInfo,
          threshold,
          actualDepthWidth,
          actualDepthHeight,
        ),
      );
    } else {
      setDistanceObjects(null);
    }
  }, [
    isRunning,
    actualDepth,
    detectionInfo,
    threshold,
    actualDepthWidth,
    actualDepthHeight,
  ]);

  if (!isRunning) {
    return null;
  }

  return (
    <Container
      header={
        <Header
          variant="h3"
          info={
            <StatusIndicator type={isRunning ? 'success' : 'stopped'}>
              {isRunning ? 'running' : 'stopped'}
            </StatusIndicator>
          }
          description="Both depth estimation and object detection are required"
        >
          Object distances estimation
        </Header>
      }
    >
      {distanceObject && (
        <div className="mt-3 max-h-60 overflow-auto">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>Label</th>
                <th>Distance</th>
                <th>Alert threshold</th>
              </tr>
            </thead>
            <tbody>
              {distanceObject.map((item, index) => (
                <tr key={index}>
                  <td className="pr-3">{item.label}</td>
                  <td>{item.distance.toFixed(2)}</td>
                  <td>
                    <StatusIndicator
                      type={
                        item.distance < alertThreshold ? 'warning' : 'success'
                      }
                    >
                      {item.distance < alertThreshold
                        ? 'Object is too close'
                        : 'Object is further away'}
                    </StatusIndicator>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
};

export default ObjectDistancesBox;
