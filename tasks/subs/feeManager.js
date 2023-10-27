let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { task } = require("hardhat/config");
let {
    deployFeeManager,
    initialFeeStruct,
    setIntegratorFees,
    withdrawPlatformFees,
} = require("./utils/tronFeeManager.js");

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
    .addParam("feetype", "feeType")
    .addParam("fixedplatformnativefee", "fixedplatformnativeFee")
    .addParam("platformtokenfee", "platformTokenFee")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();

        if (network.name === "Tron" || network.name === "TronTest") {
            await initialFeeStruct(
                hre.artifacts,
                network.name,
                taskArgs.feetype,
                taskArgs.fixedplatformnativefee,
                taskArgs.platformtokenfee
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
            await (
                await feeManager.initialFeeStruct(
                    taskArgs.feetype,
                    taskArgs.fixedplatformnativefee,
                    taskArgs.platformtokenfee
                )
            ).wait();
        }
    });

task("feeManager:setIntegratorFees", "setIntegratorFees feeManager")
    .addParam("integrator", "integrator")
    .addParam("feetype", "feeType")
    .addParam("tokenfee", "tokenFee")
    .addParam("platformtokenshare", "platformTokenShare")
    .addParam("platformnativeshare", "platformNativeShare")
    .addParam("fixednativeamount", "fixedNativeAmount")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();
        if (network.name === "Tron" || network.name === "TronTest") {
            await setIntegratorFees(
                hre.artifacts,
                network.name,
                taskArgs.integrator,
                taskArgs.feetype,
                taskArgs.tokenfee,
                taskArgs.platformtokenshare,
                taskArgs.platformnativeshare,
                taskArgs.fixednativeamount
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
                feeType: taskArgs.feetype,
                tokenFee: taskArgs.tokenfee,
                platformTokenShare: taskArgs.platformtokenshare,
                platformNativeShare: taskArgs.platformnativeshare,
                fixedNativeAmount: taskArgs.fixednativeamount,
            };
            await (await feeManager.setIntegratorFees(taskArgs.integrator, fee)).wait();
        }
    });

task("feeManager:withdrawPlatformFees", "initialFeeStruct feeManager")
    .addParam("tokens", "feeType")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();

        if (network.name === "Tron" || network.name === "TronTest") {
            await withdrawPlatformFees(hre.artifacts, network.name, taskArgs.tokens);
        } else {
            console.log("deployer :", deployer);
            let deploy = await readFromFile(network.name);
            if (!deploy[network.name]["FeeManager"]) {
                throw "feeManager not deploy";
            }
            console.log("feeManager  address :", deploy[network.name]["FeeManager"]);
            let FeeManager = await ethers.getContractFactory("FeeManager");
            let feeManager = FeeManager.attach(deploy[network.name]["FeeManager"]);
            let tokenList = taskArgs.tokens.split(",");
            await (await feeManager.withdrawPlatformFees(tokenList)).wait();
        }
    });
