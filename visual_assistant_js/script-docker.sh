#!/bin/bash

# Set variables
GLIB_VERSION=${GLIB_VERSION:-2.74.7-689.amzn2023.0.2}
IMAGE_NAME="libvips-image"
CONTAINER_NAME="libvips-container"

# Define the Dockerfile content
DOCKERFILE_CONTENT=$(cat << EOF
FROM --platform=linux/amd64 public.ecr.aws/amazonlinux/amazonlinux:2023

# Install necessary build tools and dependencies
RUN dnf install -y git meson ninja-build gcc gcc-c++ glib2-devel expat-devel && dnf clean all

# Downgrade to the version of glib2 that Amplify uses, could change over time
RUN dnf downgrade glib2-${GLIB_VERSION} -y

# Clone libvips repository
RUN git clone https://github.com/libvips/libvips.git

# Build and install libvips
WORKDIR /libvips
RUN meson setup build && \
    cd build && \
    meson compile && \
    meson install

# Copy libvips files to /output directory inside the container
RUN mkdir /output && cp /usr/local/lib64/libvips.so.[0-9]*.[0-9]* /usr/local/lib64/libvips-cpp.so.[0-9]*.[0-9]* /output/
EOF
)

# Create a temporary directory for the Dockerfile
TEMP_DIR=$(mktemp -d)
echo "$DOCKERFILE_CONTENT" > "$TEMP_DIR/Dockerfile"

# Step 1: Build the Docker image
echo "Building Docker image..."
docker build -t $IMAGE_NAME "$TEMP_DIR"
if [ $? -ne 0 ]; then
    echo "Error: Failed to build Docker image."
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up temporary Dockerfile
rm -rf "$TEMP_DIR"

# Step 2: Create and start a container from the built image
echo "Creating and starting container..."
docker create --name $CONTAINER_NAME $IMAGE_NAME
if [ $? -ne 0 ]; then
    echo "Error: Failed to create container."
    exit 1
fi

# Step 3: Use docker cp to copy the /output folder from the container to the host
OUTPUT_DIR="./libvips_x64"
mkdir -p $OUTPUT_DIR

echo "Copying files from container to host..."
docker cp $CONTAINER_NAME:/output/. $OUTPUT_DIR/
if [ $? -ne 0 ]; then
    echo "Error: Failed to copy files from container."
    docker rm $CONTAINER_NAME > /dev/null 2>&1
    exit 1
fi

# Step 4: Clean up by removing the temporary container
echo "Cleaning up..."
docker rm $CONTAINER_NAME > /dev/null 2>&1

# Optionally remove image
#docker rmi $IMAGE_NAME > /dev/null 2>&1

echo "Process completed successfully. Output is available in the '$OUTPUT_DIR' directory."

