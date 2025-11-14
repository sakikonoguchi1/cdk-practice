#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AllInOneStack } from '../lib/all-in-one-stack';

const app = new cdk.App();

// 共通の環境設定（東京リージョンに統一）
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '423014875142',
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// 全てのリソースを一つのスタックに統合
new AllInOneStack(app, 'AllInOneStack', { env });