import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  Vpc, 
  SecurityGroup 
} from 'aws-cdk-lib/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Repository } from 'aws-cdk-lib/aws-ecr';
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
  public readonly repository: Repository;
  public readonly alb: ApplicationLoadBalancer;
  public readonly backendService: FargateService;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { vpc, backendAlbSecurityGroup, backendSecurityGroup } = props;

    // =========================
    // 1. ECR リポジトリ
    // =========================
    this.repository = new Repository(this, 'BackendRepository', {
      repositoryName: 'backend-api',
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // =========================
    // 2. ECS クラスター
    // =========================
    const cluster = new Cluster(this, 'BackendCluster', {
      vpc: vpc,
      clusterName: 'backend-cluster',
    });

    // =========================
    // 3. バックエンド タスク定義
    // =========================
    // Execution Roleを明示的に作成
    const executionRole = new Role(this, 'BackendTaskExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // ECRリポジトリへのプルアクセス権限を付与
    this.repository.grantPull(executionRole);

    const backendTaskDef = new FargateTaskDefinition(this, 'BackendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
    });

    const backendContainer = backendTaskDef.addContainer('BackendContainer', {
      image: ContainerImage.fromEcrRepository(this.repository, 'latest'),
      essential: true,
      logging: undefined,
    });

    backendContainer.addPortMappings({
      containerPort: 3000, // backend-apiイメージはポート3000で動作
      protocol: EcsProtocol.TCP,
    });

    // =========================
    // 4. バックエンド ECS サービス
    // =========================
    this.backendService = new FargateService(this, 'BackendService', {
      cluster: cluster,
      taskDefinition: backendTaskDef,
      desiredCount: 1,
      securityGroups: [backendSecurityGroup],
      vpcSubnets: {
        subnetGroupName: 'PrivateBE', // バックエンド専用プライベートサブネット
      },
      serviceName: 'backend-service',
    });

    // =========================
    // 5. ALB (Application Load Balancer)
    // =========================
    this.alb = new ApplicationLoadBalancer(this, 'BackendAlb', {
      vpc: vpc,
      internetFacing: false, // 内部専用ALBに変更（インターネットからアクセス不可）
      securityGroup: backendAlbSecurityGroup,
      loadBalancerName: 'backend-alb-internal',
      vpcSubnets: {
        subnetGroupName: 'PrivateBE', // バックエンド専用プライベートサブネットに配置
      },
    });

    // =========================
    // 6. ALB リスナーとターゲットグループ
    // =========================
    const listener = this.alb.addListener('BackendListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    });

    listener.addTargets('BackendTargets', {
      port: 3000, // backend-apiイメージのポート
      targets: [this.backendService],
      protocol: ApplicationProtocol.HTTP,
      healthCheck: {
        path: '/',
        port: '3000',
      },
    });

    // =========================
    // 7. Outputs
    // =========================
    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'Backend ECR Repository URI',
    });

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