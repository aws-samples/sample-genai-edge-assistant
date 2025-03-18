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

| name                             | licensePeriod | material | licenseType               | link                                                           | remoteVersion | installedVersion | definedVersion | author                                                                     |
|----------------------------------|---------------|----------|---------------------------|----------------------------------------------------------------|---------------|------------------|----------------|----------------------------------------------------------------------------|
| @aws-amplify/adapter-nextjs      | perpetual     | material | Apache-2.0                | https://aws-amplify.github.io/                                 | 1.4.0         | 1.2.29           | ^1.2.21        | Amazon Web Services                                                        |
| @aws-amplify/ui-react            | perpetual     | material | Apache-2.0                | git+https://github.com/aws-amplify/amplify-ui.git              | 6.8.1         | 6.7.0            | ^6.5.4         | n/a                                                                        |
| @cloudscape-design/components    | perpetual     | material | Apache-2.0                | git+https://github.com/cloudscape-design/components.git        | 3.0.866       | 3.0.831          | ^3.0.748       | n/a                                                                        |
| @cloudscape-design/global-styles | perpetual     | material | Apache-2.0                | git+https://github.com/cloudscape-design/global-styles.git     | 1.0.34        | 1.0.32           | ^1.0.32        | n/a                                                                        |
| @huggingface/transformers        | perpetual     | material | Apache-2.0                | git+https://github.com/huggingface/transformers.js.git         | 3.2.4         | 3.0.2            | ^3.0.2         | Hugging Face                                                               |
| @stdlib/datasets-cmudict         | perpetual     | material | Apache-2.0 and BSD        | git://github.com/stdlib-js/datasets-cmudict.git                | 0.2.2         | 0.2.2            | ^0.2.2         | The Stdlib Authors https://github.com/stdlib-js/stdlib/graphs/contributors |
| aws-amplify                      | perpetual     | material | Apache-2.0                | git+https://github.com/aws-amplify/amplify-js.git              | 6.12.0        | 6.9.0            | ^6.6.4         | Amazon Web Services                                                        |
| axios                            | perpetual     | material | MIT                       | git+https://github.com/axios/axios.git                         | 1.7.9         | 1.7.7            | ^1.7.7         | Matt Zabriskie                                                             |
| jszip                            | perpetual     | material | (MIT OR GPL-3.0-or-later) | git+https://github.com/Stuk/jszip.git                          | 3.10.1        | 3.10.1           | ^3.10.1        | Stuart Knightley <stuart@stuartk.com>                                      |
| next                             | perpetual     | material | MIT                       | git+https://github.com/vercel/next.js.git                      | 14.2.23       | 14.2.22          | ^14.2.22       | n/a                                                                        |
| react                            | perpetual     | material | MIT                       | git+https://github.com/facebook/react.git                      | 18.3.1        | 18.3.1           | ^18            | n/a                                                                        |
| react-dom                        | perpetual     | material | MIT                       | git+https://github.com/facebook/react.git                      | 18.3.1        | 18.3.1           | ^18            | n/a                                                                        |
| reactflow                        | perpetual     | material | MIT                       | git+https://github.com/xyflow/xyflow.git                       | 11.11.4       | 11.11.4          | ^11.11.4       | n/a                                                                        |
| wavefile                         | perpetual     | material | MIT                       | git://github.com/rochars/wavefile.git                          | 11.0.0        | 11.0.0           | ^11.0.0        | Rafael da Silva Rocha <rocha.rafaelsilva@gmail.com>                        |
| zustand                          | perpetual     | material | MIT                       | git+https://github.com/pmndrs/zustand.git                      | 5.0.3         | 5.0.1            | ^5.0.1         | Paul Henschel                                                              |
| @types/react                     | perpetual     | material | MIT                       | https://github.com/DefinitelyTyped/DefinitelyTyped.git         | 18.3.11       | 18.3.11          | 18.3.11        | n/a                                                                        |
| eslint                           | perpetual     | material | MIT                       | git+https://github.com/eslint/eslint.git                       | 8.57.1        | 8.57.1           | ^8.57.1        | Nicholas C. Zakas <nicholas+npm@nczconsulting.com>                         |
| eslint-config-next               | perpetual     | material | MIT                       | git+https://github.com/vercel/next.js.git                      | 15.0.3        | 15.0.3           | 15.0.3         | n/a                                                                        |
| eslint-import-resolver-alias     | perpetual     | material | MIT                       | git+https://github.com/johvin/eslint-import-resolver-alias.git | 1.1.2         | 1.1.2            | ^1.1.2         | johvin                                                                     |
| eslint-plugin-import             | perpetual     | material | MIT                       | git+https://github.com/import-js/eslint-plugin-import.git      | 2.31.0        | 2.31.0           | ^2.31.0        | Ben Mosher <me@benmosher.com>                                              |
| lint-staged                      | perpetual     | material | MIT                       | git+https://github.com/lint-staged/lint-staged.git             | 15.3.0        | 15.3.0           | ^15.3.0        | Andrey Okonetchnikov <andrey@okonet.ru>                                    |
| postcss                          | perpetual     | material | MIT                       | git+https://github.com/postcss/postcss.git                     | 8.5.1         | 8.4.49           | ^8             | Andrey Sitnik <andrey@sitnik.ru>                                           |
| prettier                         | perpetual     | material | MIT                       | git+https://github.com/prettier/prettier.git                   | 3.4.2         | 3.4.2            | ^3.4.2         | James Long                                                                 |
| tailwindcss                      | perpetual     | material | MIT                       | git+https://github.com/tailwindlabs/tailwindcss.git            | 3.4.17        | 3.4.15           | ^3.4.1         | n/a                                                                        |
| typescript                       | perpetual     | material | Apache-2.0                | git+https://github.com/microsoft/TypeScript.git                | 5.7.2         | 5.7.2            | 5.7.2          | Microsoft Corp.                                                            |
                                                |

