let { task } = require("hardhat/config");
let { deployReceiver, tronSetRouter } = require("./utils/tronReceiver.js");
let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { verify } = require("./utils/verify.js");

task("receiver:deploy", "deploy receiver").setAction(async (taskArgs) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();

    if (network.name === "Tron" || network.name === "TronTest") {
        await deployReceiver(hre.artifacts, network.name);
    } else {
        console.log("deployer :", deployer);
        let chainId = await hre.network.config.chainId;
        let receiver;
        if (chainId === 324 || chainId === 280) {
            receiver = await createZk("Receiver", [deployer], hre);
        } else {
            let salt = process.env.RECEIVER_DEPLOY_SALT;
            let salt_hash = await ethers.utils.keccak256(await ethers.utils.toUtf8Bytes(salt));
            let Receiver = await ethers.getContractFactory("Receiver");
            let param = ethers.utils.defaultAbiCoder.encode(["address"], [deployer]);
            let result = await create(salt_hash, Receiver.bytecode, param);
            receiver = result[0];
        }
        console.log("Receiver  address :", receiver);
        let deploy = await readFromFile(network.name);
        deploy[network.name]["Receiver"] = receiver;
        await writeToFile(deploy);
        const verifyArgs = [deployer].map((arg) => (typeof arg == "string" ? `'${arg}'` : arg)).join(" ");
        console.log(`To verify, run: npx hardhat verify --network ${network.name} ${receiver} ${verifyArgs}`);
        await verify(receiver, [deployer], "contracts/Receiver.sol:Receiver", chainId);
    }
});

task("receiver:setRouter", "set bridges router address")
    .addParam("receiver", "receiver address")
    .addParam("name", "router name")
    .addParam("router", "router address")
    .setAction(async (taskArgs) => {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();
        let deploy = await readFromFile(network.name);
        if (!deploy[network.name]["Receiver"]) {
            throw "receiver not deploy";
        }
        let receiver_addr = deploy[network.name]["Receiver"];
        if (network.name === "Tron" || network.name === "TronTest") {
            await tronSetRouter(hre.artifacts, network.name, receiver_addr, taskArgs.router, taskArgs.name);
        } else {
            let Receiver = await ethers.getContractFactory("Receiver");
            let receiver = Receiver.attach(taskArgs.receiver);
            let result;
            if (taskArgs.name === "btter") {
                result = await (await receiver.setButterMos(taskArgs.router)).wait();
            } else if (taskArgs.name === "amarok") {
                result = await (await receiver.setAmarokRouter(taskArgs.router)).wait();
            } else if (taskArgs.name === "stargate") {
                result = await (await receiver.setStargateRouter(taskArgs.router)).wait();
            } else {
                throw "unspport name";
            }

            if (result.status == 1) {
                console.log(`set ${taskArgs.name} succeed`);
            } else {
                console.log(`set ${taskArgs.name} failed`);
            }

            deploy[network.name]["Receiver"][taskArgs.name] = taskArgs.router;
            await writeToFile(deploy);
        }
    });
