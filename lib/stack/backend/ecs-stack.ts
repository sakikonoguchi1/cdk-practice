import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup, Peer, Port } from 'aws-cdk-lib/aws-ec2';

interface BackendEcsStackProps extends StackProps {
  vpc: any;
  feSg: SecurityGroup;
}

export class BackendEcsStack extends Stack {
  public readonly beSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: BackendEcsStackProps) {
    super(scope, id);

    const cluster = new Cluster(this, 'BackendCluster', {
      vpc: props.vpc,
    });

    this.beSg = new SecurityGroup(this, 'BackendSG', {
      vpc: props.vpc,
      allowAllOutbound: false, // デフォルトのアウトバウンドを無効化
    });

    // FEからのみアクセス許可
    this.beSg.addIngressRule(props.feSg, Port.tcp(8080), 'Allow FE → BE');

    // 必要なアウトバウンド通信を許可
    // HTTPS/TLS通信用（外部API、パッケージ取得など）
    this.beSg.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS outbound');
    // DNS解決用
    this.beSg.addEgressRule(Peer.anyIpv4(), Port.tcp(53), 'Allow DNS TCP');
    this.beSg.addEgressRule(Peer.anyIpv4(), Port.udp(53), 'Allow DNS UDP');

    const taskDef = new FargateTaskDefinition(this, 'BackendTask');
    taskDef.addContainer('BackendContainer', {
      // Hello World API コンテナイメージを使用
      image: ContainerImage.fromRegistry('nmatsui/hello-world-api'),
      portMappings: [{ containerPort: 8080 }],
    });

    new FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
      securityGroups: [this.beSg],
      vpcSubnets: { subnets: props.vpc.privateSubnets },
    });
  }
}