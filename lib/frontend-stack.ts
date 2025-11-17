import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
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
  Protocol 
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';

interface FrontendStackProps extends StackProps {
  vpc: Vpc;
  albSecurityGroup: SecurityGroup;
  frontendSecurityGroup: SecurityGroup;
}

export class FrontendStack extends Stack {
  public readonly alb: ApplicationLoadBalancer;
  public readonly frontendService: FargateService;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { vpc, albSecurityGroup, frontendSecurityGroup } = props;

    // =========================
    // 1. ECS クラスター
    // =========================
    const cluster = new Cluster(this, 'FrontendCluster', {
      vpc: vpc,
      clusterName: 'frontend-cluster',
    });

    // =========================
    // 2. ALB (Application Load Balancer)
    // =========================
    this.alb = new ApplicationLoadBalancer(this, 'FrontendAlb', {
      vpc: vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'frontend-alb',
    });

    // =========================
    // 3. フロントエンド タスク定義
    // =========================
    const frontendTaskDef = new FargateTaskDefinition(this, 'FrontendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const frontendContainer = frontendTaskDef.addContainer('FrontendContainer', {
      image: ContainerImage.fromRegistry('nginx:alpine'),
      essential: true,
      logging: undefined,
    });

    frontendContainer.addPortMappings({
      containerPort: 80,
      protocol: EcsProtocol.TCP,
    });

    // =========================
    // 4. フロントエンド ECS サービス
    // =========================
    this.frontendService = new FargateService(this, 'FrontendService', {
      cluster: cluster,
      taskDefinition: frontendTaskDef,
      desiredCount: 1,
      securityGroups: [frontendSecurityGroup],
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
      serviceName: 'frontend-service',
    });

    // =========================
    // 5. ALB リスナーとターゲットグループ
    // =========================
    const listener = this.alb.addListener('FrontendListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    });

    listener.addTargets('FrontendTargets', {
      port: 80,
      targets: [this.frontendService],
      protocol: ApplicationProtocol.HTTP,
      healthCheck: {
        path: '/',
        port: '80',
      },
    });

    // =========================
    // 6. Outputs
    // =========================
    new CfnOutput(this, 'FrontendURL', {
      value: `http://${this.alb.loadBalancerDnsName}`,
      description: 'Frontend Application URL',
    });

    new CfnOutput(this, 'LoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });
  }
}