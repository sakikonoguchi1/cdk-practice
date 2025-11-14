import { Stack, Duration, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Cluster, FargateService, FargateTaskDefinition, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer, ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { SecurityGroup, Port, Peer } from 'aws-cdk-lib/aws-ec2';

interface FrontendEcsStackProps extends StackProps {
  vpc: any;
}

export class FrontendEcsStack extends Stack {
  public readonly feSg: SecurityGroup;

  constructor(scope: Construct, id: string, props: FrontendEcsStackProps) {
    super(scope, id);

    const cluster = new Cluster(this, 'FrontendCluster', {
      vpc: props.vpc,
    });

    // Frontend ECS用のセキュリティグループを先に作成
    this.feSg = new SecurityGroup(this, 'FrontendSG', {
      vpc: props.vpc,
      allowAllOutbound: false, // デフォルトのアウトバウンドを無効化
    });

    // ALB用のセキュリティグループを作成
    const albSg = new SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    // インターネットからのHTTP/HTTPSアクセスを許可
    albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP from Internet');
    albSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS from Internet');
    
    // ALBからFrontend ECSへのアクセスを許可
    albSg.addEgressRule(this.feSg, Port.tcp(3000), 'Allow ALB → Frontend ECS');

    // ALBからのインバウンドアクセスを許可
    this.feSg.addIngressRule(albSg, Port.tcp(3000), 'Allow ALB → Frontend');

    // 必要なアウトバウンド通信を許可
    // Backend APIへのアクセス用（後でBackendスタックで許可設定を行う）
    this.feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(8080), 'Allow Frontend → Backend API');
    // HTTPS/TLS通信用のアウトバウンドを許可（外部API、パッケージ取得など）
    this.feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS outbound');
    // DNS解決用
    this.feSg.addEgressRule(Peer.anyIpv4(), Port.tcp(53), 'Allow DNS TCP');
    this.feSg.addEgressRule(Peer.anyIpv4(), Port.udp(53), 'Allow DNS UDP');

    const alb = new ApplicationLoadBalancer(this, 'FrontendAlb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg, // ALB専用のセキュリティグループを使用
    });

    const taskDef = new FargateTaskDefinition(this, 'FrontendTask');
    taskDef.addContainer('FrontendContainer', {
      image: ContainerImage.fromRegistry('your-registry/your-frontend'),
      portMappings: [{ containerPort: 3000 }],
    });

    const service = new FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
      securityGroups: [this.feSg],
    });

    const listener = alb.addListener('Listener', { port: 80 });
    listener.addTargets('FE', {
      port: 3000,
      protocol: ApplicationProtocol.HTTP, // HTTPプロトコルを明示的に指定
      targets: [service],
      healthCheck: {
        path: '/', // ヘルスチェックのパスを指定
      },
    });
  }
}
