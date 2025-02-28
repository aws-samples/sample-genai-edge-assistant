import time

import boto3


def handler(event, context):
    vpc_id = event["vpc_id"]
    ec2 = boto3.client("ec2")

    def get_non_default_security_groups():
        response = ec2.describe_security_groups(
            Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
        )
        return [sg for sg in response["SecurityGroups"] if sg["GroupName"] != "default"]

    while True:
        security_groups = get_non_default_security_groups()

        if not security_groups:
            print("All non-default security groups have been deleted.")
            break

        for sg in security_groups:
            sg_id = sg["GroupId"]
            print(f"Processing security group: {sg_id}")

            # Remove all ingress rules
            if sg["IpPermissions"]:
                try:
                    ec2.revoke_security_group_ingress(
                        GroupId=sg_id, IpPermissions=sg["IpPermissions"]
                    )
                except ec2.exceptions.ClientError as e:
                    print(f"Error removing ingress rules for {sg_id}: {str(e)}")

            # Remove all egress rules
            if sg["IpPermissionsEgress"]:
                try:
                    ec2.revoke_security_group_egress(
                        GroupId=sg_id, IpPermissions=sg["IpPermissionsEgress"]
                    )
                except ec2.exceptions.ClientError as e:
                    print(f"Error removing egress rules for {sg_id}: {str(e)}")

            # Attempt to delete the security group
            try:
                ec2.delete_security_group(GroupId=sg_id)
                print(f"Deleted security group: {sg_id}")
            except ec2.exceptions.ClientError as e:
                print(f"Error deleting security group {sg_id}: {str(e)}")

        # Wait for a short period before the next iteration
        time.sleep(20)

    return {"statusCode": 200, "body": "Security group deletion process completed"}
