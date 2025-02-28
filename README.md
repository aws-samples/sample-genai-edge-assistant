# AWS visual assistant

Helping the visually impaired people.

> **General disclaimer**
> 1. This software is meant for development purposes. It does not claim to be immune from security issues, especially regarding the frontend web application or potential bugs. For production scenarios, it is your responsibility to ensure proper security measures for your users, and that the software meets defined security criterias and regulations for your area.
> 2. Cloud deployments can incur cost on your AWS accounts. Make sure to plan this accordingly and check for the prices in your region of deployment.
> 3. Some features might be unavailable for deployment in specific regions.


# Instructions for deployment

## If you plan to use AWS Amplify for frontend hosting

First follow the instructions in [./visual_assistant_js/README.MD](./visual_assistant_js/README.MD) to deploy the web-app to Amplify. Once the application is deployed, populate the infrastructure by following instructions in the [./backend/README.MD](./backend/README.MD) file. You need to create the Amplify application before as it will be modified by the backend deployment. **The first build of the Amplify application might faill because it awaits for backend deployment.**

## If your frontend runs on your local machine or a web server

This is the way to go if you do not want the frontend to be hosted on Amplify.
First follow the instructions in the [./backend/README.MD](./backend/README.MD) file to deploy backend resources. Once they are properly deployed, follow the instructions in [./visual_assistant_js/README.MD](./visual_assistant_js/README.MD) to deploy the web-app to your machine.

# Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

# License

This library is licensed under the MIT-0 License. See the LICENSE file.