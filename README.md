# cloudflare-backup

Simple AWS lambda function for backing up your CloudFlare hosted DNS records and other settings
It sends the result to an AWS S3 bucket
The lambda function is configured and uploaded with claudiajs

This script is 'as is', please review the code to adjust and inmprove the code to your needs

# Installation and usage

## Step 1
git clone https://github.com/mirkogeest/cloudflare-backup-s3.git
cd cloudflare-backup-s3
npm install
npm create (Create the initial lambda function and related security role)
npm run deploy (Deploy lambda function to server)

## Step 2
Set environment variables at the AWS console for the created lambda function: 
CF_BACKUP_AWS_BUCKET <AWS S3 Bucket>
CF_BACKUP_AWS_KEY <AWS S3 Key>
CF_EMAIL <CloudFlare account email>
CF_TOKEN <CloudFlare account token>

Lambda Execution role: Use or create one, with access to your S3 bucket.
No VPC is needed

## Step 3
npm test (Executes the lambda function at Lambda server)

Check S3 

---
Copyright &copy; 2015 Ryan Graham
