#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { BackendStack } from '../lib/backend-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

// 環境設定
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '423014875142',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// 1. ネットワークスタック (VPC, セキュリティグループ)
const networkStack = new NetworkStack(app, 'NetworkStack', { env });

// 2. フロントエンドスタック (ECS + ALB)
const frontendStack = new FrontendStack(app, 'FrontendStack', {
  env,
  vpc: networkStack.vpc,
  albSecurityGroup: networkStack.albSecurityGroup,
  frontendSecurityGroup: networkStack.frontendSecurityGroup,
});

// 3. バックエンドスタック (ECS)
const backendStack = new BackendStack(app, 'BackendStack', {
  env,
  vpc: networkStack.vpc,
  backendSecurityGroup: networkStack.backendSecurityGroup,
});

// 4. ストレージスタック (S3 + CloudFront)
const storageStack = new StorageStack(app, 'StorageStack', { env });

// スタック依存関係の設定
frontendStack.addDependency(networkStack);
backendStack.addDependency(networkStack);