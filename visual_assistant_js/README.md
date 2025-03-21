## Getting started using Amplify for frontend deployment

### Pushing the frontend code to an empty Github repository

For the setup to be working seamlessly, you will need to push the content of the current directory (visual_assistant_js) to the root of a new Github repository. This repository will be used by AWS Amplify to deploy the frontend.

### Deploying with Amplify

To deploy the Webapp to Amplify, you can go into the Amplify console on you AWS account and click on deploy a new app. You will then be prompted to setup a Github integration between Amplify on your AWS account and your Github account. **Ideally you have your own version of the GitHub, to avoid any issue with the public repository.**

You can limit AWS integration to solely access the frontend repository. Just follow the instructions and select the correct Github branch to deploy the application. Deploy the application as a monorepo app, with the root directory set to the current directory `visual_assistant_js`.

> As of Feb 2025, the Amplify environment lacks **libvips**, crucial for the working of @huggingface/transformers (through dependancy **sharp**). Because of licensing issue, we removed all dependencies licensed under LGPL-3.0
which turns out to be some optional dependancies of **sharp** who can remediate the issue.  
However, **libvips** is licensed under LGPL-2.1, so we can compile it ourselves. Under <u>libvips_x64</u> folder we prepared some precompiled libs that should work, but with time this could be no longer the case.  
[script-docker.sh](./script-docker.sh) is a script that can automatically compile and populate the needed files into libvips_x64 folder in the repo. One important thing to keep in mind is that Amplify environment does not necessarily use the latest Amazon Linux 2023 image, so we need to downgrade to the needed version for some of the tools we use, particularly **glib2**, to the version that Amplify uses. We have **GLIB_VERSION** environment variable with a default value, you can override by invoking `GLIB_VERSION=xxxxxx ./script-docker.sh` 


## Getting started for a local or custom web server deployment

### Initialization

First, download the dependencies:

```bash
npm ci
```
> Note: @huggingface/transformers has dependency sharp, which is Apache-2.0 but has optional dependencies that are of LGPL-3.0-or-later if installed with `npm install`. You can optionally use the latter should this pose no problem.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Integration with backend

This app is meant to be deployed on Amplify service in the AWS cloud, and to be integrated with the backend deployed with AWS CDK from the `backend` directory. If you plan to rather run the Next.js app on your local or custom hosted machine, you need to adapt Next.js environment variables after backend creation for accessing its resources. Please create a file `.env.local` (or another way if you prefer to create the variables) in this directory and fill it with the following content: 

```bash
NEXT_PUBLIC_REGION_NAME="<REGION_NAME>"
NEXT_PUBLIC_COGNITO_USER_POOL_ID="<COGNITO_USER_POOL_ID>"
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID="<COGNITO_USER_POOL_CLIENT_ID>"
NEXT_PUBLIC_API_GATEWAY_ENDPOINT="<API_GATEWAY_ENDPOINT>"
NEXT_PUBLIC_DEBUG_AUDIO=false
NEXT_PUBLIC_DEBUG_DEPTH=false
NEXT_PUBLIC_DEBUG_DETECTION=false
NEXT_PUBLIC_DEBUG_IMAGE_CAPTIONING=false
```

Where the values to fill are the output of the CDK stack you deployed for the backend.


## Credits

This app has been boostrapped with Next.js.

## Licenses

You can find the licenses [here](./package-lock.json)