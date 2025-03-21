// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export function getNetworkInfo() {
  if (!navigator.onLine) {
    return { isOnline: false, type: 'offline', isMetered: false };
  }

  // This is only supported in Chrome as of Jan 7 2025
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  if (!connection) {
    return {
      isOnline: true,
      type: 'unknown',
      isMetered: false,
    };
  }

  let type;
  if (connection.effectiveType && !connection.type) {
    type =
      connection.effectiveType.toUpperCase() +
      ' (Effective Type, not real type)';
  } else {
    type = connection.type || 'unknown';
  }

  return {
    isOnline: true,
    type: type === 'unknown' ? type : type.toUpperCase(),
    isMetered: connection.saveData || false,
  };
}
