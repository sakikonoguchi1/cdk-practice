import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, SubnetType, IpAddresses } from 'aws-cdk-lib/aws-ec2';

export class NetworkStack extends Stack {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, 'AppVpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'), // cidrの代わりにipAddressesを使用
      maxAzs: 2,
      restrictDefaultSecurityGroup: false, // 権限エラーを回避するため無効化
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
  }
}