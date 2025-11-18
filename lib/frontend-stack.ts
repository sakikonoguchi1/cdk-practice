import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  Vpc, 
  SecurityGroup 
} from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { 
  Cluster, 
  FargateService, 
  FargateTaskDefinition, 
  ContainerImage,
  Protocol as EcsProtocol,
  LogDriver
} from 'aws-cdk-lib/aws-ecs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
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
  public readonly repository: Repository;
  public readonly alb: ApplicationLoadBalancer;
  public readonly frontendService: FargateService;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { vpc, albSecurityGroup, frontendSecurityGroup } = props;

    // =========================
    // 1. ECR リポジトリ
    // =========================
    this.repository = new Repository(this, 'FrontendRepository', {
      repositoryName: 'frontend-app',
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // =========================
    // 2. ECS クラスター
    // =========================
    const cluster = new Cluster(this, 'FrontendCluster', {
      vpc: vpc,
      clusterName: 'frontend-cluster',
    });

    // =========================
    // 3. ALB (Application Load Balancer)
    // =========================
    this.alb = new ApplicationLoadBalancer(this, 'FrontendAlb', {
      vpc: vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'frontend-alb',
    });

    // =========================
    // 4. フロントエンド タスク定義
    // =========================
    const frontendTaskDef = new FargateTaskDefinition(this, 'FrontendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    // CloudWatch Logs
    const logGroup = new LogGroup(this, 'FrontendLogGroup', {
      logGroupName: '/ecs/frontend-service',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const frontendContainer = frontendTaskDef.addContainer('FrontendContainer', {
      image: ContainerImage.fromEcrRepository(this.repository, 'latest'),
      essential: true,
      logging: LogDriver.awsLogs({
        streamPrefix: 'frontend',
        logGroup: logGroup,
      }),
    });

    frontendContainer.addPortMappings({
      containerPort: 80,
      protocol: EcsProtocol.TCP,
    });

    // =========================
    // 5. フロントエンド ECS サービス
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
    // 6. ALB リスナーとターゲットグループ
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
    // 7. Outputs
    // =========================
    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'Frontend ECR Repository URI',
    });

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