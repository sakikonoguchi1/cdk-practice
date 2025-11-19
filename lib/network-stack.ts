import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  Vpc, 
  SubnetType, 
  IpAddresses, 
  SecurityGroup, 
  Port, 
  Peer 
} from 'aws-cdk-lib/aws-ec2';

export class NetworkStack extends Stack {
  public readonly vpc: Vpc;
  public readonly albSecurityGroup: SecurityGroup;
  public readonly backendAlbSecurityGroup: SecurityGroup;
  public readonly frontendSecurityGroup: SecurityGroup;
  public readonly backendSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================
    // 1. VPC とネットワーク
    // =========================
    this.vpc = new Vpc(this, 'AppVpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateFE',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'PrivateBE',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // =========================
    // 2. セキュリティグループ
    // =========================

    // ALB用セキュリティグループ
    this.albSecurityGroup = new SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      'Allow HTTP from anywhere'
    );

    this.albSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      'Allow HTTPS from anywhere'
    );

    // バックエンドALB用セキュリティグループ
    this.backendAlbSecurityGroup = new SecurityGroup(this, 'BackendAlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for backend ALB',
      allowAllOutbound: true,
    });

    // フロントエンドALBからのアクセスのみ許可（一般ユーザーからの直接アクセスをブロック）
    // 注意: フロントエンドALBのセキュリティグループを後で参照するため、先にフロントエンドALB SGを作成する必要があります

    // フロントエンド用セキュリティグループ
    this.frontendSecurityGroup = new SecurityGroup(this, 'FrontendSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for frontend ECS service',
      allowAllOutbound: true,
    });

    this.frontendSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      Port.tcp(80),
      'Allow traffic from ALB'
    );

    // バックエンド用セキュリティグループ
    this.backendSecurityGroup = new SecurityGroup(this, 'BackendSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for backend ECS service',
      allowAllOutbound: true,
    });

    this.backendSecurityGroup.addIngressRule(
      this.backendAlbSecurityGroup,
      Port.tcp(3000),
      'Allow traffic from backend ALB'
    );

    // バックエンドALBへのアクセスをフロントエンドALBのみに制限
    // フロントエンドのECSタスク（Fargateコンテナ）がバックエンドALBにアクセスする
    this.backendAlbSecurityGroup.addIngressRule(
      this.frontendSecurityGroup,
      Port.tcp(80),
      'Allow HTTP from frontend ECS tasks only'
    );
  }
}