# Continuous Deployment System.

In this assigment I setup a Continuous Deployment pipeline using AWS Code Pipeline and AWS Code Build to upload a small React project to an AWS EC2 instance.

This helped me solidify my understanding of CI/CD Workflows and cloud services.

# Requirements
- AWS Account.

# Setup
Below I'll be listing how to setup the project.

# Setup a Git Repository
First let's start from a Git Repository, you can also use AWS Code Commit.

Setup a Git Repository and upload some project, preferably something using Node so its simple but also can be 'built' for deployent, this way we have the full experience going on in our CD Pipeline.

![Git Repository](doc/images/repository.png)

# Setup a Simple Project
For this project I developd a simple React app that shows the books I'm currently reading, you can find this code under `/frontend`.

Here is a screenshoot of it running locally.
![Frontend Running Locally](doc/images/frontend-local.png)

This is going to be the initial state of the project, later once the CD Pipeline is setup I'll be adding more books to see if our Pipeline works.

Now that both the Repository and the Project are ready, we can continue to setup our Pipeline.

# Setup the EC2 Instance
We will be deploying our basic app to an EC2 instance after the build process, so lets setup our EC2 first for later attach it to our pipeline.

To do this in your AWS Dashboard go to `EC2` then `Launch Instance`

In the Launch Instance Screen add a name to your EC2 Instance.

For the OS Image select either Amazon Linux or Ubuntu. *(Here I used Ubuntu)*

![EC2 Setup Screen](doc/images/ec2-setup.png)

Due to this instance only objective is provide us with the frontend, select a small instance like a `t2.micro`. *(Free Eligieble)**

![EC2 Setup Instance](doc/images/ec2-setup-instance.png)

Then generate an Access Key of type `RSA` in `.PPK` format, we will be using them for accessing our machine if needed.

![EC2 Access Key](doc/images/ec2-acceskey.png)

Now lets finish this by seting up Network Settings.

Here make sure to enable `SSH Trafic` from Anywhere.

And setup the least ammount of storage (8GB), this is more than enough for this project.

![ECT Setup Finish](doc/images/ec2-setup-finish.png)

Once setup, click on `Launch Instance`

## Configure the EC2 Instance.
Now that our EC2 instance is live, we need to setup some things inside the server to allow for it to serve as our Web Server.

Make sure the EC2 Instance is up and running and then look for its `Public DNS` by clicking on the Instance inside the EC2 Dashboard.

Then use some app like PuTTY to connect through SSL.

Remember that for Ubuntu instances you should be accessing it adding an `ubuntu@` before the DNS URL, and also add the `PPK` key under `Connection > SSH > Auth > Credentials`

![Putty Setup](doc/images/putty-connection.png)

Once inside our EC2 instance we will be running some commands to prepare it as a web server.

![Console of EC2 Instance](doc/images/console-1.png)

### Prepare EC2 Instance.
For this EC2 we will be using `nginx` as our web server, to install in in the EC2 run the following commands in the EC2 terminal:

```BASH
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

After running these commands we should be able to see that `nginx` service is Active.

![Console after installation](doc/images/console-2.png)

### Setup NGINX
Now we will need to add some configuration to our NGINX service so it knows where to look for our react project.

So lets create a special folder for where to put our pipeline build.

This creates a folder three finishing in /libraryApp where our build will reside.

Then it changes the access to the current user ubuntu, which is the default user for all EC2 Ubuntu instances.

```BASH
sudo mkdir -p /var/www/html/libraryApp
sudo chown -R ubuntu:ubuntu /var/www/html/libraryApp 
```

So now we will be setting up NGINX to look for our app inside these new directories.

```BASH
sudo nano /etc/nginx/sites-available/default
```

Once inside this file we will be editing it to add the following lines:
```BASH
    root /var/www/html/libraryApp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html =404;
    }
```

This tells NGIX to look for the index inside the folder we created, then we need to make sure that our Deployment phase copies the build content inside that folder.

*Note that these settings are already in the file, you might need to look for them.*
![NGINX Configuration](doc/images/console-3.png)

Save the file by clicking `CTRL + X` then pressing `Y` and then enter.

Now we need to check if the NGINX file syntax is valid and then we will reload the process so the changes apply, to do this, run these commands:

```BASH
sudo nginx -t
sudo systemctl reload nginx
```

![NGINX Validation](doc/images/console-4.png)

Now our EC2 is ready to host our React App, but we need to make sure our Code Deploy pushes the build files inside /libraryApp.

### Allow HTTP access
Now that our web server is setup, we need to allow access to our EC2 by using the port 80.

To do so, go into the `EC2` instances and check which security group is attached to the EC2 machine we are using.

In this case is `launch-wizard-1`
![EC2 Details](doc/images/ec2-security-group.png)

Then go to `Security Group` under Network & Security and then click in the security group attached to our EC2 and then click on `Edit Inbound Rules`

Here we will be selecting type `HTTP`, make sure the access is to everyone (0.0.0.0/0)

![Security Group Config](doc/images/ec2-allow-http.png)

Now if we try to reach our EC2 in our browser we will get a `404 Not Found`, but this is all right, it means that we can acces to our EC2 http server, but because there is no app yet, it returns the fallback 404.

![EC2 404 Error](doc/images/ec2-http-empty.png)

### Create IAM Role for Deployment
Now we need to grants some permissions to our EC2 instance, so it can work with other systems, this will enable it to let our Deployment Step to deploy into our EC2.

To do this go to `IAM` then `Roles` then `Create Role`

Here select `AWS Service` as the Trusted Entity and then select ECT as `Use Case`

Then click `Next`
![EC2 Role Setup](doc/images/ec2-role-setup-1.png)

Now we will be attaching two different permissions
```
AmazonSSMManagedInstanceCore
```
and
```
AmazonEC2RoleForAWSCodeDeploy
```

Search for them and click on their checkbox, then click `Next`
![EC2 Role Setup](doc/images/ec2-role-setup-2.png)

Now create a name for the new role and review the permissions so all checks up.

Yo should be seeing only TWO permissions added.

If everything checks up click `Create Role`
![EC2 Role Setup](doc/images/ec2-role-setup-3.png)

Now we will be attaching this role to our EC2.

### Attach Deployment IAM Role to EC2
Now go back to EC2 Dashboard and select the Instance where we will be deploying, then click on `Actions` then `Security` then `Modify IAM Role`

Here look for the role we just created and select it, now click `Update IAM Role`
![Attaching IAM Role to EC2](doc/images/ec2-attach-iam-role.png)

### Install SSM Agent
Now we need to install SSM Agent in our EC2 machine, this agent is what allows inter-service communication, so this allows the Deploy stage to communicate with EC2 to put the changes in it.

To do so we will be running some commands again in the CLI of the EC2 instance, so we will be needing PuTTY again.

```BASH
sudo apt install -y ruby-full wget
wget https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/debian_amd64/amazon-ssm-agent.deb
sudo dpkg -i amazon-ssm-agent.deb
sudo systemctl enable amazon-ssm-agent
sudo systemctl start amazon-ssm-agent
```

```BASH
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl enable codedeploy-agent
sudo systemctl start codedeploy-agent
```

Now our EC2 is completely ready to host and provide our web app, now we need to add our web app build, this is going to be achieved using our pipeline.

# Setup Code Pipeline
Now that our Repository and EC2 is ready we will be setting up the AWS CodePipeline to fetch the code from the repository, build it and then push the build result to our EC2 server.

To achieve this go to `CodePipeline` in your AWS Dashboard and then click on `Create Pipeline`

Now in the Step 1 we will be selecting `Build Custom Pipeline`
![Pipeline setp 1](doc/images/pipeline-1.png)

Now in Step 2: 
- Create a name for the pipeline.
- Select `quequed` in Execution Mode.
- Let AWS Create a new Service Role.

This will help us later in granting permissions, or you can attach yours if you already have roles and permissions.
![Pipeline step 2](doc/images/pipeline-2.png)

On Step 3 we wwill be connecting our repository to the Pipeline, here select the `Source Provider` as Github or CodeCommit, depending on where you setup the repository.

Then make sure to select the correct repository and the branch where the project is going to be.

![Pipeline step 3](doc/images/pipeline-3.png)

Now in step 4 we will be taking another direction a bit to setup a AWS Code Build Project, in there we will be defining the rules as to how to deploy our app.

Here click `Create Project`
![Pipeline step 4](doc/images/pipeline-4.png)

## Creating AWS Code Build
Now in the new window that should have pop out, we will be setting up the Code Build to specifically setup how we want our project to be built.

Here select a name for the code build and leave everything default.
![Codebuild Part1](doc/images/codebuild-1.png)

Make sure you have these settings in your enviroment.

Also make sure to let AWS create a new service role, we will be needing that to grant some access later.
![Codebuild Part2](doc/images/codebuild-2.png)

Here in `Buildspec` select `Use Buildspec File`
![Codebuild Part3](doc/images/codebuild-3.png)

The buildspec file is a .yml file that contains all the definition as to how to build our app.

`Create a buildspec.yml` in your root of your repo and add the following settings:

Make sure this file is in the root of the repository.
```YML
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - cd frontend
      - npm install
  build:
    commands:
      - npm run build
  post_build:
    commands:
      - echo "Build completed on `date`"
      - mkdir -p /tmp/deploy
      - cp -r build/* /tmp/deploy/
      - cp ../appspec.yml /tmp/deploy/

artifacts:
  files:
    - '**/*'
  base-directory: /tmp/deploy
```
*Note: Note that we are referencing an /appspec.yml file, this will be created on steps ahead*

Skimming through this config you can see that, this process will get the files from `/frontend` on our repo and run npm install, to get all dependencies.

Then it will `npm run build` to create a build package of our app.

Then it will create a temp folder `/tmp/deploy` and inside of it copies all files inside of /build (the one created by npm build)

And then, exposes those files to the next stage as the artifact of this build.

Leave `Cloud Watch Logs` on for debugging if needed, and then go ahead and click `Continue to Code Pipeline`

This take us back to our step 4, here we see that the build project gets attached to our Pipeline.
![Pipeline step 4-1](doc/images/pipeline-4-1.png)

In this same step, make sure you have `Input Artifact` set as Defined by: Source (Meaning our Repository).
![Pipeline step 4-2](doc/images/pipeline-4-2.png)

We will skip step 5, which is the Test stage, because we have nothing much to test here, go ahead an click `Skip Test Stage`.
![Pipeline step 5](doc/images/pipeline-5.png)

Now on step 6 we will be setting up our Deployment stage, due to our current configuration and for simplicity, we will be adding an EC2 instance directly for deployment.

Select EC2 as the `Provider`

And make sure the `Input Artifacts` are defined by Build.
![Pipeline step 6](doc/images/pipeline-6.png)

Then down below select EC2 as `Instance Type`, then select the EC2 we created earlier usin the key/value marked below. (This is a default tag, we can create a different one if we need/want), but using the value we make sure we select the one we want.

Then in `Deploy Specification` select `Use DeploySpec file`, this is going to be a file that the Deploy Step is going to use to know where to deploy the files.

Inside the `DeploySpec` input put `appspec.yml`, this is the name of the file this stage will look for.
![Pipeline step 6-1](doc/images/pipeline-6-1.png)

Now that we selected DeploySpec file, we need to create this file in our root folder in the repo, this way we make sure the Build Phase has access to it and it passes it to the Deploy Phase.

Go to your repository and in the `ROOT` folder create a file called `appspec.yml` and paste the following code:
```YML
version: 0.0

files:
  - source: /
    destination: /var/www/html/libraryApp

hooks:
  BeforeDeploy:
    - location: scripts/before_deploy
      timeout: 60
      runas: ubuntu
```

This simple command tells the Deploy stage to put the built result in `/var/www/html/libraryApp` (Where NGIGX expects the app to be).

---

### Bug fix for Deployment
For some reason, while I developed this project my Deploy phase in the pipeline always failed because it expected a `before-deploy` script, even if we never specified it and I could not got my head around it.

So as a last restort fix I gave the Deploy what it wanted, a 'before-deploy' script, this does nothing more than echoing something in the console, but this way I avoid the error of 'not having a script' that prevented me from deploying the app.

So to implement this fix you already set half of it above (The hooks part wasn't orignally planned).

So now create a folder in the root of the repository called `scripts` and inside of it create a `before_deploy.sh` and put the following inside:

```BASH
echo "Before Deploy. . ."
exit 0
```

Now the deploy phase gets what it 'expects' for some reason and it allow the deployment.


---

Make sure to include these files in the repository.

Now in step 7 verify that all our changes are setup properly.

At this point, the files we created should be in the remote repository already, because after the creation of the pipeline, it will attempt to run the process.

If everything looks good go ahead and click `Create Pipeline`
![Pipeline step 7](doc/images/pipeline-7.png)


Once created the process is going to start and attempt to deploy automatically.
![Pipeline flow](doc/images/pipeline-process-1.png)

But it will likely `fail` because of one warning that we got earlier in in step 6 (deploy), it states that we need to `manually grant access` to our pipeline to access, write and delete files in our EC2.

![Pipeline flow failing](doc/images/pipeline-process-1-fail.png)

This is because the direct integration of EC2 delegates the 'deployment' to our pipeline itself, that's why we need to grant him access, so we will be doing this next.

## Granting Access to EC2 to the Pipeline
Now we will be granting permission to our Pipeline to interact with the EC2 to finish the Deployment process, for this lets go to `IAM` then `Roles`.

Here we will be on the look for the role of our current pipeline, the name should be something like `AWSCodePipelineServiceRole-#Region#-#PipelineName#`

Click on it and then go to `Add Permissions` then select `Create Inline Policy` *(Or you can create a policy and attach it)*

Here we will be adding the following permissions definition:

Note that you will need:
- Pipeline Name (The complete name of the pipeline)
- Region Name (Where the EC2 resides)
- Account ID (Your 12 digits)
- Target group name (Of the EC2 bucket *[name]*)
- Target value (Of the EC2 bucket *[#Name#]*)

Remember to delete both [] or {} that surround the placeholders.
```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "StatementWithAllResource",
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "elasticloadbalancing:DescribeTargetGroupAttributes",
                "elasticloadbalancing:DescribeTargetGroups",
                "elasticloadbalancing:DescribeTargetHealth",
                "ssm:CancelCommand",
                "ssm:DescribeInstanceInformation",
                "ssm:ListCommandInvocations"
            ],
            "Resource": [
                "*"
            ]
        },
        {
            "Sid": "StatementForLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": [
                "arn:aws:logs:{{region}}:{{AccountId}}:log-group:/aws/codepipeline/{{pipelineName}}:*"
            ]
        },
        {
            "Sid": "StatementForElasticloadbalancing",
            "Effect": "Allow",
            "Action": [
                "elasticloadbalancing:DeregisterTargets",
                "elasticloadbalancing:RegisterTargets"
            ],
            "Resource": [
                "arn:aws:elasticloadbalancing:{{region}}:{{AccountId}}:targetgroup/[[targetGroupName]]/*"
            ]
        },
        {
            "Sid": "StatementForSsmOnTaggedInstances",
            "Effect": "Allow",
            "Action": [
                "ssm:SendCommand"
            ],
            "Resource": [
                "arn:aws:ec2:{{region}}:{{AccountId}}:instance/*"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:ResourceTag/{{tagKey}}": "{{tagValue}}"
                }
            }
        },
        {
            "Sid": "StatementForSsmApprovedDocuments",
            "Effect": "Allow",
            "Action": [
                "ssm:SendCommand"
            ],
            "Resource": [
                "arn:aws:ssm:{{region}}::document/AWS-RunPowerShellScript",
                "arn:aws:ssm:{{region}}::document/AWS-RunShellScript"
            ]
        }
    ]
}
```

Remember that the `Tag Name` is the tag of the EC2 instance, if not set any, the default should be `Name`, and then the `Tag Value` is the `actual name` of the EC2 instance

Once the policy is edited with your data it should look something like this:
![Policy Edit Page](doc/images/policy-edit.png)

If the editor detects no errors, go ahead and click `Next`

Create a name for the policy and review that the access level, resources and conditions look good, then click on `Create Policy`
![Policy Review Page](doc/images/policy-review.png)

Now our policy is attached and the pipeline now has the right permissions to create logs of deployment and also access the EC2 to deploy our project.

Now go ahead and make some changes in the repository so the pipeline picks it up and starts the deployment process again.

![Pipeline Flow](doc/images/pipeline-process-2.png)

Now our pipeline works correctly and it has been deployed to our EC2 Instance.

![Pipeline Flow Success](doc/images/pipeline-process-3.png)

And if we go to the EC2 instance URL we will be able to see our website.

![Website Deployed](doc/images/website-1.png)

# Continuous Deployment
Now lets add another book to the repository and wait for it to be atuomatically deployed by our pipeline.

