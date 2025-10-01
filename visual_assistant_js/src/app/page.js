// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import { I18nProvider } from '@cloudscape-design/components/i18n';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import messages from '@cloudscape-design/components/i18n/messages/all.en';
import { useMetaStore } from 'src/app/stores/metaStore';
import NavigationMode from 'src/app/components/navigation/navigationModeWidget';
import PlaygroundMode from 'src/app/components/playground/playgroundWidget';
import ChatMode from 'src/app/components/chat/chatModeWidget';
import { useSpeechRecognition } from 'src/app/hooks/useSpeechRecognition';
import config from '/amplify-config';


Amplify.configure({ ...config });

export default function Home() {
  const currentMode = useMetaStore((state) => state.currentMode);
  useSpeechRecognition();

  // Three-way mode rendering function
  const renderCurrentMode = () => {
    switch (currentMode) {
    case 'navigation':
      return <NavigationMode />;
    case 'chat':
      return <ChatMode />;
    case 'playground':
    default:
      return <PlaygroundMode />;
    }
  };

  const LOCALE = 'en';

  return (
    <I18nProvider locale={LOCALE} messages={[messages]}>
      <Authenticator hideSignUp>
        {({ user }) => (
          <div style={{ height: '100vh' }}>
            {renderCurrentMode()}
            {/* <ContentLayout defaultPadding disableOverlap headerVariant="high-contrast">
          </ContentLayout> */}
          </div>
        )}
      </Authenticator>
    </I18nProvider>
  );
}
