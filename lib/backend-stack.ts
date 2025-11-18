import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  Vpc, 
  SecurityGroup 
} from 'aws-cdk-lib/aws-ec2';
import { 
  Cluster, 
  FargateService, 
  FargateTaskDefinition, 
  ContainerImage,
  Protocol as EcsProtocol
} from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';

interface BackendStackProps extends StackProps {
  vpc: Vpc;
  backendAlbSecurityGroup: SecurityGroup;
  backendSecurityGroup: SecurityGroup;
}

export class BackendStack extends Stack {
  public readonly alb: ApplicationLoadBalancer;
  public readonly backendService: FargateService;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { vpc, backendAlbSecurityGroup, backendSecurityGroup } = props;

    // =========================
    // 1. ECS クラスター
    // =========================
    const cluster = new Cluster(this, 'BackendCluster', {
      vpc: vpc,
      clusterName: 'backend-cluster',
    });

    // =========================
    // 2. バックエンド タスク定義
    // =========================
    const backendTaskDef = new FargateTaskDefinition(this, 'BackendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const backendContainer = backendTaskDef.addContainer('BackendContainer', {
      image: ContainerImage.fromRegistry('nmatsui/hello-world-api'),
      essential: true,
      logging: undefined,
    });

    backendContainer.addPortMappings({
      containerPort: 3000,
      protocol: EcsProtocol.TCP,
    });

    // =========================
    // 3. バックエンド ECS サービス
    // =========================
    this.backendService = new FargateService(this, 'BackendService', {
      cluster: cluster,
      taskDefinition: backendTaskDef,
      desiredCount: 1,
      securityGroups: [backendSecurityGroup],
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
      serviceName: 'backend-service',
    });

    // =========================
    // 4. ALB (Application Load Balancer)
    // =========================
    this.alb = new ApplicationLoadBalancer(this, 'BackendAlb', {
      vpc: vpc,
      internetFacing: true,
      securityGroup: backendAlbSecurityGroup,
      loadBalancerName: 'backend-alb',
    });

    // =========================
    // 5. ALB リスナーとターゲットグループ
    // =========================
    const listener = this.alb.addListener('BackendListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    });

    listener.addTargets('BackendTargets', {
      port: 3000,
      targets: [this.backendService],
      protocol: ApplicationProtocol.HTTP,
      healthCheck: {
        path: '/',
        port: '3000',
      },
    });

    // =========================
    // 6. Outputs
    // =========================
    new CfnOutput(this, 'BackendURL', {
      value: `http://${this.alb.loadBalancerDnsName}`,
      description: 'Backend API URL',
    });

    new CfnOutput(this, 'BackendLoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'Backend Load Balancer DNS Name',
    });
  }
}