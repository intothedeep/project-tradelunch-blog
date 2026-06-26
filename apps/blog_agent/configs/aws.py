# configs/aws.py
"""
AWS Configuration

S3, RDS, and other AWS service settings.
"""

import os


# ==================== AWS Credentials ====================
AWS_REGION = os.getenv("AWS_REGION", "us-west-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")


# ==================== S3 Configuration ====================
S3_BUCKET = os.getenv("AWS_S3_BUCKET", os.getenv("S3_BUCKET", "my-blog-bucket"))
S3_REGION = os.getenv("S3_REGION", AWS_REGION)
S3_PREFIX = "blog-images/"


# ==================== RDS Configuration ====================
# CA Certificate for SSL connection (optional)
AWS_RDS_CA = os.getenv("AWS_RDS_CA", "")


# ==================== CDN Configuration ====================
CDN_ASSET_POSTS = os.getenv("CDN_ASSET_POSTS", "https://posts.prettylog.com")
