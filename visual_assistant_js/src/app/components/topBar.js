// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Button,
  Flex,
  Heading,
  Text,
  useAuthenticator,
  View,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Toggle } from '@cloudscape-design/components';
import { useMetaStore } from 'src/app/stores/metaStore';

const TopBar = () => {
  const { user, signOut } = useAuthenticator();
  const navigationModeActivated = useMetaStore(
    (state) => state.navigationModeActivated,
  );
  const setNavigationModeActivated = useMetaStore(
    (state) => state.setNavigationModeActivated,
  );


  return (
    <View
      as="header"
      backgroundColor="#1f2937" // Dark background
      padding="1rem 2rem"
      boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)" // Soft shadow for depth
      style={{
        position: 'sticky',
        top: 0,
      }}
    >
      <Flex direction="column" gap="1rem">
        <Flex justifyContent="space-between" alignItems="center">
          {/* Left side: App Logo or Name */}
          <Heading level={6} color="white" margin="0">
            AWS real-time visual assistant
          </Heading>

          {/* Right side: User info and sign-out */}
          <Flex alignItems="center">
            <Button
              onClick={signOut}
              variation="primary"
              size="small"
              backgroundColor="#f59e0b"
              color="white"
            >
              Sign Out
            </Button>
          </Flex>
        </Flex>

        <Flex alignItems="center" gap="2rem">
          <div style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
            {navigationModeActivated ? 'Navigation mode' : 'Playground mode'}
          </div>
          <div>
            <div
              style={{ color: 'white', fontSize: '10px', marginBottom: '8px' }}
            >
              Use navigation mode for guidance to objects
            </div>
            <Toggle
              checked={navigationModeActivated}
              onChange={({ detail }) => setNavigationModeActivated(detail.checked)}
            >
              <span style={{ color: 'white', fontSize: '12px'}}>Switch to navigation mode</span>
            </Toggle>
          </div>
        </Flex>
      </Flex>
    </View>
  );
};

export default TopBar;
