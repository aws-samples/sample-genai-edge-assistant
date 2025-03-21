// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const config = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: "code",
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
      authenticationFlows: {
        adminUserPassword: true,
        customAuth: true,
        refreshTokenAuth: true,
        userPassword: true,
      },
    },
  },
};

export default config;
