import { Stack, StackProps, Duration } from 'aws-cdk-lib';
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

interface BackendStackProps extends StackProps {
  vpc: Vpc;
  backendSecurityGroup: SecurityGroup;
}

export class BackendStack extends Stack {
  public readonly backendService: FargateService;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { vpc, backendSecurityGroup } = props;

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
  }
}