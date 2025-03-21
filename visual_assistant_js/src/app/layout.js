// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import '@cloudscape-design/global-styles/index.css';
import 'src/app/globals.css';

export const metadata = {
  title: 'Visual Assistant',
  /* icons: {
    icon: '/favicon.ico',
  }, */
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
