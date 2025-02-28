import time

import boto3


def handler(event, context):
    efs_id = event["EfsId"]
    efs_client = boto3.client("efs")

    try:
        # Get all mount targets for the EFS
        mount_targets = efs_client.describe_mount_targets(FileSystemId=efs_id)[
            "MountTargets"
        ]

        # Delete all mount targets
        for mount_target in mount_targets:
            mount_target_id = mount_target["MountTargetId"]
            print(f"Deleting mount target {mount_target_id}")
            efs_client.delete_mount_target(MountTargetId=mount_target_id)

        # Wait for all mount targets to be deleted
        while True:
            remaining_targets = efs_client.describe_mount_targets(FileSystemId=efs_id)[
                "MountTargets"
            ]
            if not remaining_targets:
                break
            print(
                f"Waiting for {len(remaining_targets)} mount targets to be deleted..."
            )
            time.sleep(10)  # Wait for 30 seconds before checking again

        # Delete the EFS
        print(f"Deleting EFS {efs_id}")
        efs_client.delete_file_system(FileSystemId=efs_id)

        print(f"Successfully deleted EFS {efs_id}")
        return {
            "statusCode": 200,
            "body": f"EFS {efs_id} and all its mount targets deleted successfully",
        }

    except Exception as e:
        print(f"Error deleting EFS {efs_id}: {str(e)}")

        return {"statusCode": 500, "body": f"{e}"}
