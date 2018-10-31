# cloudflare-backup

Simple AWS lambda function for backing up your CloudFlare hosted DNS records and other settings
It sends the result to an AWS S3 bucket
The function is uploaded with claudiajs

# Env vars:

Set `CF_EMAIL` and `CF_TOKEN` environment variables to your CloudFlare account
email address and API key, respectively. 

CF_BACKUP_AWS_BUCKET
CF_BACKUP_AWS_KEY
CF_EMAIL
CF_TOKEN

# Installation and usage

npm install -g cloudflare-backup-s3
npm create (Create the initial lambda function and related security role 
npm deploy (Deploy lambda function to server)
npm test (Executes the lambda function at Lambda server)

---
Copyright &copy; 2015 Ryan Graham
