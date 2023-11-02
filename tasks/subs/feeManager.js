let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { task } = require("hardhat/config");
let { deployFeeManager, initialFeeStruct, setIntegratorFees } = require("./utils/tronFeeManager.js");

task("feeManager:deploy", "deploy feeManager").setAction(async (taskArgs, hre) => {
    const { getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    if (network.name === "Tron" || network.name === "TronTest") {
        await deployFeeManager(hre.artifacts, network.name);
    } else {
        console.log("deployer :", deployer);
        let chainId = hre.network.config.chainId;
        let feeManager;
        if (chainId === 324 || chainId === 280) {
            feeManager = await createZk("FeeManager", [deployer], hre);
        } else {
            let salt = process.env.FEE_MANAGER_SALT;
            let FeeManager = await ethers.getContractFactory("FeeManager");
            let param = ethers.utils.defaultAbiCoder.encode(["address"], [deployer]);
            let result = await create(salt, FeeManager.bytecode, param);
            feeManager = result[0];
        }
        console.log("feeManager  address :", feeManager);
        let deploy = await readFromFile(network.name);
        deploy[network.name]["FeeManager"] = feeManager;
        await writeToFile(deploy);
    }
});

task("feeManager:initialFeeStruct", "initialFeeStruct feeManager")
    .addParam("receiver", "fee receiver")
    .addParam("fixednative", "fixedNative")
    .addParam("tokenfeerate", "tokenFeeRate")
    .addParam("share", "openliq share of toekn fee")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();

        let feeStruct = {
            receiver: taskArgs.receiver,
            tokenFeeRate: taskArgs.tokenfeerate,
            fixedNative: taskArgs.fixednative,
            share: taskArgs.share,
        };

        if (network.name === "Tron" || network.name === "TronTest") {
            await initialFeeStruct(
                hre.artifacts,
                network.name,
                taskArgs.receiver,
                taskArgs.fixednative,
                taskArgs.tokenfeerate,
                taskArgs.share
            );
        } else {
            console.log("deployer :", deployer);
            let deploy = await readFromFile(network.name);
            if (!deploy[network.name]["FeeManager"]) {
                throw "feeManager not deploy";
            }
            console.log("feeManager  address :", deploy[network.name]["FeeManager"]);
            let FeeManager = await ethers.getContractFactory("FeeManager");
            let feeManager = FeeManager.attach(deploy[network.name]["FeeManager"]);
            await (await feeManager.initialFeeStruct(feeStruct)).wait();
        }
    });

task("feeManager:setIntegratorFees", "setIntegratorFees feeManager")
    .addParam("integrator", "integrator")
    .addParam("receiver", "openliq fee Receiver")
    .addParam("fixednative", "fixedNative")
    .addParam("tokenfeerate", "tokenFeeRate")
    .addParam("share", "share")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();
        if (network.name === "Tron" || network.name === "TronTest") {
            await setIntegratorFees(
                hre.artifacts,
                network.name,
                taskArgs.integrator,
                taskArgs.receiver,
                taskArgs.fixednative,
                taskArgs.tokenfeerate,
                taskArgs.share
            );
        } else {
            console.log("deployer :", deployer);
            let deploy = await readFromFile(network.name);
            if (!deploy[network.name]["FeeManager"]) {
                throw "feeManager not deploy";
            }
            console.log("feeManager  address :", deploy[network.name]["FeeManager"]);
            let FeeManager = await ethers.getContractFactory("FeeManager");
            let feeManager = FeeManager.attach(deploy[network.name]["FeeManager"]);
            let fee = {
                openliqReceiver: taskArgs.receiver,
                fixedNative: taskArgs.fixednative,
                tokenFeeRate: taskArgs.tokenfeerate,
                share: taskArgs.share,
            };
            await (await feeManager.setIntegratorFees(taskArgs.integrator, fee)).wait();
        }
    });
