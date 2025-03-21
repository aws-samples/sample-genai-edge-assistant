// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Container, Header, Tabs } from '@cloudscape-design/components';
import { useLogsStore } from 'src/app/stores/logsStore';
import { useEffect, useRef, useState } from 'react';

const WORKER_TABS = [
  { id: 'depth', label: 'Depth', content: null },
  { id: 'detection', label: 'Detection', content: null },
  { id: 'audio', label: 'Audio', content: null },
  { id: 'imageCaptioning', label: 'Image Captioning', content: null },
];

export default function WorkerLogsBox() {
  const [activeTabId, setActiveTabId] = useState('depth'); // Default to depth
  const logsContainerRef = useRef(null);
  const workerLogs = useLogsStore((state) => state.workerLogs);

  // Scroll to bottom when logs change
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [workerLogs]);

  // Create tabs with log content
  const tabs = WORKER_TABS.map((tab) => ({
    ...tab,
    content: (
      <div
        ref={logsContainerRef}
        className="max-h-40 overflow-y-auto font-mono text-sm"
      >
        {workerLogs[tab.id]?.map((log, index) => (
          <div
            key={index}
            className={`py-1 ${
              log.type === 'error'
                ? 'text-red-500'
                : log.type === 'warn'
                  ? 'text-yellow-500'
                  : 'text-gray-700'
            }`}
          >
            <span className="text-gray-400">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>{' '}
            <span className="font-semibold">[{log.type}]</span> {log.message}
          </div>
        ))}
        {(!workerLogs[tab.id] || workerLogs[tab.id].length === 0) && (
          <div className="text-gray-500 italic">No logs available</div>
        )}
      </div>
    ),
  }));

  return (
    <Container header={<Header variant="h3">Worker Logs</Header>}>
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
      />
    </Container>
  );
}
