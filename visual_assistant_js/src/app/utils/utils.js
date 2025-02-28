// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export async function hasFp16() {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter.features.has('shader-f16');
  } catch (e) {
    return false;
  }
}

const COLOURS = [
  'rgba(244,67,54,1)',
  'rgba(233,30,99,1)',
  'rgba(156,39,176,1)',
  'rgba(103,58,183,1)',
  'rgba(63,81,181,1)',
  'rgba(33,150,243,1)',
  'rgba(3,169,244,1)',
  'rgba(0,188,212,1)',
  'rgba(0,150,136,1)',
  'rgba(76,175,80,1)',
  'rgba(139,195,74,1)',
  'rgba(205,220,57,1)',
  'rgba(255,235,59,1)',
  'rgba(255,193,7,1)',
];

export function renderBox(
  [xmin, ymin, xmax, ymax, score, id],
  [w, h],
  id2label,
  threshold,
) {
  if (score < threshold) {
    return;
  } // Skip boxes with low confidence

  // Generate a random color for the box
  const color = COLOURS[id % COLOURS.length];

  // Draw the box
  const boxElement = document.createElement('div');
  boxElement.className = 'bounding-box';
  Object.assign(boxElement.style, {
    borderColor: color,
    left: (100 * xmin) / w + '%',
    top: (100 * ymin) / h + '%',
    width: (100 * (xmax - xmin)) / w + '%',
    height: (100 * (ymax - ymin)) / h + '%',
  });

  // Draw label
  const labelElement = document.createElement('span');
  labelElement.textContent = `${id2label[id]} (${(100 * score).toFixed(2)}%)`;
  labelElement.className = 'bounding-box-label';
  labelElement.style.backgroundColor = color;

  boxElement.appendChild(labelElement);
  overlay.appendChild(boxElement);
}

export function calculateMedian(
  actualDepth,
  detectionInfo,
  threshold,
  actualDepthWidth,
  actualDepthHeight,
) {
  const elements = [];

  const xmax_old = detectionInfo.sizes[0];
  const ymax_old = detectionInfo.sizes[1];

  if (actualDepth === undefined || actualDepth === null) {
    return;
  }

  for (let index = 0; index < detectionInfo.outputs.length; index++) {
    // detectionInfo.outputs[index], detectionInfo.sizes, detectionInfo.id2label, threshold
    //xmin, ymin, xmax, ymax, score, id
    const score = detectionInfo.outputs[index][4];
    const id = detectionInfo.outputs[index][5];
    if (score < threshold / 100) {
      continue;
    }

    // Rescale box to depth image
    const newX1 = Math.min(
      actualDepthWidth,
      Math.max(
        0,
        Math.floor(
          (detectionInfo.outputs[index][0] / xmax_old) * actualDepthWidth,
        ),
      ),
    );
    const newX2 = Math.min(
      actualDepthWidth,
      Math.max(
        0,
        Math.floor(
          (detectionInfo.outputs[index][2] / xmax_old) * actualDepthWidth,
        ),
      ),
    );
    const newY1 = Math.min(
      actualDepthHeight,
      Math.max(
        0,
        Math.floor(
          (detectionInfo.outputs[index][1] / ymax_old) * actualDepthHeight,
        ),
      ),
    );
    const newY2 = Math.min(
      actualDepthHeight,
      Math.max(
        0,
        Math.floor(
          (detectionInfo.outputs[index][2] / ymax_old) * actualDepthHeight,
        ),
      ),
    );

    // Take an average of the 10% smallest depth values
    const lengthX = Math.floor(Math.abs(newX1 - newX2));
    const lengthY = Math.floor(Math.abs(newY1 - newY2));

    let depth = Array(lengthX * lengthY);
    let i = 0;

    for (
      let pixelX = Math.min(newX1, newX2);
      pixelX <= Math.max(newX1, newX2);
      pixelX++
    ) {
      for (
        let pixelY = Math.min(newY1, newY2);
        pixelY <= Math.max(newY1, newY2);
        pixelY++
      ) {
        depth[i] = actualDepth[pixelX * pixelY];
        i++;
      }
    }

    depth = depth.sort((a, b) => a - b);

    const p_threshold = 0.1;
    depth = depth.slice(0, Math.max(1, Math.ceil(depth.length * p_threshold)));

    let distance = depth.reduce((acc, val) => acc + val, 0);
    distance = distance / depth.length;

    elements.push({ label: detectionInfo.id2label[id], distance: distance });
  }

  return elements;
}

export default hasFp16;
