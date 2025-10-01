// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Button as AmplifyButton,
  Flex,
  Heading,
  useAuthenticator,
  View,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Button, SpaceBetween } from '@cloudscape-design/components';
import { useMetaStore } from 'src/app/stores/metaStore';

const TopBar = () => {
  const { signOut } = useAuthenticator();
  const currentMode = useMetaStore((state) => state.currentMode);
  const setCurrentMode = useMetaStore((state) => state.setCurrentMode);


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
            AWS Edge Visual Assistant
          </Heading>

          {/* Right side: User info and sign-out */}
          <Flex alignItems="center">
            <AmplifyButton
              onClick={signOut}
              variation="primary"
              size="small"
              backgroundColor="#f59e0b"
              color="white"
            >
              Sign Out
            </AmplifyButton>
          </Flex>
        </Flex>

        <Flex alignItems="center" gap="2rem">
          <div style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
            {currentMode === 'navigation' ? 'Navigation mode' :
              currentMode === 'chat' ? 'Chat mode' : 'Playground mode'}
          </div>
          <div>
            <div
              style={{ color: 'white', fontSize: '10px', marginBottom: '8px' }}
            >
              Select mode: Playground for testing, Navigation for guidance, Chat for conversation
            </div>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant={currentMode === 'playground' ? 'primary' : 'normal'}
                onClick={() => setCurrentMode('playground')}
                size="small"
              >
                Playground
              </Button>
              <Button
                variant={currentMode === 'navigation' ? 'primary' : 'normal'}
                onClick={() => setCurrentMode('navigation')}
                size="small"
              >
                Navigation
              </Button>
              <Button
                variant={currentMode === 'chat' ? 'primary' : 'normal'}
                onClick={() => setCurrentMode('chat')}
                size="small"
              >
                Chat
              </Button>
            </SpaceBetween>
          </div>
        </Flex>
      </Flex>
    </View>
  );
};

export default TopBar;
