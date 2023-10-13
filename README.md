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

router deploy and set up  this command will deploy router ,FeeManager,SwapAdaper and TransferProxy  also set setAuthorization and setFeeManager

```
npx hardhat router --network <network>
```

set up fee manager

1.initialFeeStruct

```
npx hardhat feeManager:initialFeeStruct --feetype 1 --fixedplatformnativefee 100000 --platformtokenfee 100 --network <network>
```

2.setIntegratorFees

```
npx hardhat feeManager:setIntegratorFees --integrator 0xE796bc0Ef665D5F730408a55AA0FF4e6f8B90920 --feetype 1 --tokenfee 100000 --platformtokenshare 100 --platformnativeshare 100 --fixednativeamount 10000000 --network <network>
```
