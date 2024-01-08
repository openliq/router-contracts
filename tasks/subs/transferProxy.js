let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { task } = require("hardhat/config");
let { deployTransferProxy } = require("./utils/tronTransferProxy.js");
let {verify} = require("./utils/verify.js")

task("transferProxy:deploy", "deploy feeManager").setAction(async (taskArgs, hre) => {
    const { getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();

    if (network.name === "Tron" || network.name === "TronTest") {
        await deployTransferProxy(hre.artifacts, network.name);
    } else {
        console.log("deployer :", deployer);
        let chainId = hre.network.config.chainId;
        let transferProxy;
        if (chainId === 324 || chainId === 280) {
            transferProxy = await createZk("TransferProxy", [], hre);
        } else {
            let salt = process.env.TRANSFER_PROXY_SALT;
            let TransferProxy = await ethers.getContractFactory("TransferProxy");
            let result = await create(salt, TransferProxy.bytecode, "0x");
            transferProxy = result[0];
        }
        console.log("TransferProxy  address :", transferProxy);
        let deploy = await readFromFile(network.name);
        deploy[network.name]["TransferProxy"] = transferProxy;
        await writeToFile(deploy);
        console.log(`To verify, run: npx hardhat verify --network ${network.name} ${transferProxy}`)
        await verify(transferProxy,[],"contracts/TransferProxy.sol:TransferProxy",chainId); 
    }
});
