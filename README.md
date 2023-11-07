# router-contracts

OpenLiq router contracts

### Contract Deployment and SetUp Workflow

#### Pre-requirement

Since all of the contracts are developed in Hardhat development environment, developers need to install Hardhat before working through our contracts. The hardhat installation tutorial can be found here[hardhat](https://hardhat.org/hardhat-runner/docs/getting-started#installation)

install

```
npm install
```

create an .env file and fill following in the contents

```
PRIVATE_KEY =  
TRON_PRIVATE_KEY = 
ALCHEMY_KEY =

FEE_MANAGER_SALT = 
ROUTER_DEPLOY_SALT = 
SWAP_ADAPTER_DEPLOY_SALT = 
TRANSFER_PROXY_SALT = 
RECEIVER_DEPLOY_SALT =
```

Compiling contracts

```
$ npx hardhat compile
Compiling...
Compiled 1 contract successfully
```

The compiled artifacts will be saved in the `artifacts/` directory by default

if deploy chain is zksync or zksyncTestnet,please compile this contract use

```
npx hardhat compile --network  `<zkSync or zkSyncTest>`
```

Testing

Deploy and setup

router deploy and set up  this command will deploy router ,SwapAdaper and TransferProxy  also set setAuthorization and setFeeManager

```
npx hardhat router --network <network>
```

deploy fee manager and setRouterFee from config

```
npx hardhat feeManager:deploy --network <network>
```

set up fee manager

1.setRouterFee

```
npx hardhat feeManager:setRouterFee --receiver <default router receiver address> --fixednative <fixed native fee> --tokenfeerate <input token fee rate> --routershare <input token fee share of router> --routernativeshare <native fee share of router>  --network <network>
```

2.setIntegratorFee

```
npx hardhat feeManager:setIntegratorFees --integrator <integrator address> --receiver <router recerver> -- fixednative <fixed native fee> --tokenfeerate <input token fee rate> --routershare <input token fee share of router> --routernativeshare <native token fee share of router>--network Makalu  
```
