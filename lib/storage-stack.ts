import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Bucket,
  BlockPublicAccess,
} from 'aws-cdk-lib/aws-s3';
import {
  Distribution,
  ViewerProtocolPolicy,
  AllowedMethods,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class StorageStack extends Stack {
  public readonly bucket: Bucket;
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================
    // 1. S3 バケット
    // =========================
    this.bucket = new Bucket(this, 'StaticAssetsBucket', {
      bucketName: `static-assets-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // =========================
    // 2. CloudFront ディストリビューション
    // =========================
    this.distribution = new Distribution(this, 'CFDist', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      comment: 'CloudFront Distribution for Static Assets',
    });
  }
}