#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <stack-name>"
    exit 1
fi

stack_name="$1"

outputs=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query 'Stacks[0].Outputs' --output json)

# Create new .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_COGNITO_USER_POOL_ID="$(echo "$outputs" | jq -r '.[] | select(.OutputKey | startswith("CognitoCognitoUserPoolId")) | .OutputValue')"
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID="$(echo "$outputs" | jq -r '.[] | select(.OutputKey | startswith("CognitoCognitoUserPoolClientId")) | .OutputValue')"
NEXT_PUBLIC_API_GATEWAY_ENDPOINT="$(echo "$outputs" | jq -r '.[] | select(.OutputKey | startswith("ApiGwConstructApiGatewayEndpoint")) | .OutputValue')"
NEXT_PUBLIC_DEBUG_AUDIO=true
NEXT_PUBLIC_DEBUG_DEPTH=true
NEXT_PUBLIC_DEBUG_DETECTION=true
NEXT_PUBLIC_DEBUG_IMAGE_CAPTIONING=true
EOF

echo ".env.local file created with $(wc -l < .env.local) environment variables."
