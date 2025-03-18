from projen.awscdk import AwsCdkPythonApp

project = AwsCdkPythonApp(
    author_email="mccunha+aws-visual-assistant-dev@amazon.com",
    author_name="mccunha+aws-visual-assistant-dev@amazon.com",
    cdk_version="2.1.0",
    module_name="backend",
    name="backend",
    version="0.1.0",
    deps =[
    'aws-cdk-lib@>=2.1.0 <3.0.0',
    'boto3',
    'cdk-nag',
    'constructs@>=10.0.5 <11.0.0',
    'sagemaker'
  ],
  dev_deps= [
    'black',
    'isort',
    'projen@0.88.3',
    'pytest@7.4.3'
  ],
    context={"@aws-cdk/customresources:installLatestAwsSdkDefault": False},
)

black_task = project.add_task("black")
black_task.exec("black .")

black_check_task = project.add_task("black:check")
black_check_task.exec("black . --check")

isort_task = project.add_task("isort")
isort_task.exec("isort .")

isort_check_task = project.add_task("isort:check")
isort_check_task.exec("isort . --check-only")

lint_task = project.add_task("lint")
lint_task.exec("black .")
lint_task.exec("isort .")

lint_check_task = project.add_task("lint:check")
lint_check_task.exec("black . --check")
lint_check_task.exec("isort . --check-only")

project.synth()
