// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { forwardRef } from 'react';

/**
 * FittedContainer - Creates a container that fits to its parent's height
 */
export const FittedContainer = ({ children }) => {
  return (
    <div style={{ position: 'relative', flexGrow: 1 }}>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  );
};

/**
 * ScrollableContainer - Creates a scrollable container for messages
 */
export const ScrollableContainer = forwardRef(function ScrollableContainer(
  { children },
  ref
) {
  return (
    <div style={{ position: 'relative', blockSize: '100%' }}>
      <div
        style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
        ref={ref}
        data-testid="chat-scroll-container"
      >
        {children}
      </div>
    </div>
  );
});