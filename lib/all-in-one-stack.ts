import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, SubnetType, IpAddresses, SecurityGroup, Port, Peer } from 'aws-cdk-lib/aws-ec2';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { Distribution, ViewerProtocolPolicy, AllowedMethods } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class AllInOneStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================
    // 1. VPC とネットワーク
    // =========================
    const vpc = new Vpc(this, 'AppVpc', {
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
    
    // ALB用のセキュリティグループ
    const albSg = new SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      allowAllOutbound: false,
    });
    albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP from Internet');
    albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS from Internet');

    // Frontend ECS用のセキュリティグループ
    const feSg = new SecurityGroup(this, 'FrontendSG', {
      vpc,
      allowAllOutbound: false,
    });
    feSg.addIngressRule(albSg, Port.tcp(80), 'Allow ALB to Frontend');
    feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(8080), 'Allow Frontend to Backend API');
    feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS outbound');
    feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(53), 'Allow DNS TCP');
    feSg.addEgressRule(Peer.anyIpv4(), Port.udp(53), 'Allow DNS UDP');

    // Backend ECS用のセキュリティグループ
    const beSg = new SecurityGroup(this, 'BackendSG', {
      vpc,
      allowAllOutbound: false,
    });
    beSg.addIngressRule(feSg, Port.tcp(8080), 'Allow FE to BE');
    beSg.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS outbound');
    beSg.addEgressRule(Peer.anyIpv4(), Port.tcp(53), 'Allow DNS TCP');
    beSg.addEgressRule(Peer.anyIpv4(), Port.udp(53), 'Allow DNS UDP');

    // ALBからFrontend ECSへのアクセスを許可
    albSg.addEgressRule(feSg, Port.tcp(80), 'Allow ALB to Frontend ECS');

    // =========================
    // 3. ECS クラスター
    // =========================
    const frontendCluster = new Cluster(this, 'FrontendCluster', { vpc });
    const backendCluster = new Cluster(this, 'BackendCluster', { vpc });

    // =========================
    // 4. Application Load Balancer
    // =========================
    const alb = new ApplicationLoadBalancer(this, 'FrontendAlb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    // =========================
    // 5. Frontend ECS Service
    // =========================
    const frontendTaskDef = new FargateTaskDefinition(this, 'FrontendTask');
    frontendTaskDef.addContainer('FrontendContainer', {
      image: ContainerImage.fromRegistry('nginx:alpine'), // 軽量なNginx（プレースホルダー）
      portMappings: [{ containerPort: 80 }], // Nginxのデフォルトポート
    });

    const frontendService = new FargateService(this, 'FrontendService', {
      cluster: frontendCluster,
      taskDefinition: frontendTaskDef,
      desiredCount: 2,
      securityGroups: [feSg],
    });

    const listener = alb.addListener('Listener', { port: 80 });
    listener.addTargets('FE', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targets: [frontendService],
      healthCheck: {
        path: '/',
      },
    });

    // =========================
    // 6. Backend ECS Service
    // =========================
    const backendTaskDef = new FargateTaskDefinition(this, 'BackendTask');
    backendTaskDef.addContainer('BackendContainer', {
      image: ContainerImage.fromRegistry('nmatsui/hello-world-api'),
      portMappings: [{ containerPort: 8080 }],
    });

    new FargateService(this, 'BackendService', {
      cluster: backendCluster,
      taskDefinition: backendTaskDef,
      desiredCount: 2,
      securityGroups: [beSg],
      vpcSubnets: { subnets: vpc.privateSubnets },
    });

    // =========================
    // 7. CloudFront + S3
    // =========================
    const bucket = new Bucket(this, 'AssetsBucket', {
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    new Distribution(this, 'CFDist', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      comment: 'CloudFront Distribution for Static Assets',
    });

    // =========================
    // 8. Outputs (アクセスURL表示用)
    // =========================
    new CfnOutput(this, 'FrontendURL', {
      value: `http://${alb.loadBalancerDnsName}`,
      description: 'Frontend Application URL',
    });

    new CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });
  }
}