let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { task } = require("hardhat/config");
let { getConfig } = require("../../configs/config");
require("./feeManager.js");
require("./transferProxy.js");
let {
    deployRouter,
    deploySwapAdapter,
    tronSetAuthorization,
    tronSetAuthFromConfig,
    tronSetFeeManager,
} = require("./utils/tronRouter.js");

task("router", "deploy router and set up").setAction(async (taskArgs, hre) => {
    const { getNamedAccounts, network } = hre;
    const { deployer } = await getNamedAccounts();
    let config = getConfig(network.name);
    if (!config) {
        throw "config not set";
    }
    await hre.run("router:deploy", { wtoken: config.wToken });
    await hre.run("router:deploySwapAdapter", {});
    await hre.run("feeManager:deploy", {});
    // await hre.run("transferProxy:deploy", {});
    let deploy_json = await readFromFile(network.name);
    let router_addr = deploy_json[network.name]["Router"]["addr"];
    if (!router_addr) {
        throw "router deploy fail";
    }
    let adapt_addr = deploy_json[network.name]["SwapAdapter"];
    if (adapt_addr) {
        config.executors.push(adapt_addr);
    }
    let transferProxy = deploy_json[network.name]["TransferProxy"];
    if (transferProxy) {
        config.executors.push(transferProxy);
    }

    let executors_s = config.executors.join(",");
    await hre.run("router:setAuthorization", { router: router_addr, executors: executors_s });

    let feeManager = deploy_json[network.name]["FeeManager"];

    if (feeManager) {
        await hre.run("router:setFeeManager", { router: router_addr, feemanager: feeManager });
    }
});

task("router:deploy", "deploy router")
    .addParam("wtoken", "wtoken address")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();

        console.log("\ndeploy router on", hre.network.name);

        if (network.name === "Tron" || network.name === "TronTest") {
            await deployRouter(hre.artifacts, network.name, taskArgs.wtoken);
        } else {
            console.log("deployer :", deployer);
            let chainId = hre.network.config.chainId;
            let router;
            if (chainId === 324 || chainId === 280) {
                router = await createZk("Router", [deployer, taskArgs.wtoken], hre);
            } else {
                let salt = process.env.ROUTER_DEPLOY_SALT;
                let Router = await ethers.getContractFactory("Router");
                let param = ethers.utils.defaultAbiCoder.encode(["address", "address"], [deployer, taskArgs.wtoken]);
                let result = await create(salt, Router.bytecode, param);
                router = result[0];
            }
            console.log("router  address :", router);
            let deploy = await readFromFile(network.name);
            if (!deploy[network.name]["Router"]) {
                deploy[network.name]["Router"] = {};
            }
            deploy[network.name]["Router"]["addr"] = router;
            await writeToFile(deploy);
        }
    });

task("router:deploySwapAdapter", "deploy SwapAdapter").setAction(async (taskArgs, hre) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();

    console.log("\ndeploy SwapAdapter on", hre.network.name);

    if (network.name === "Tron" || network.name === "TronTest") {
        await deploySwapAdapter(hre.artifacts, network.name);
    } else {
        console.log("deployer :", deployer);
        let chainId = hre.network.config.chainId;

        let swapAdapter;
        if (chainId === 324 || chainId === 280) {
            swapAdapter = await createZk("SwapAdapter", [deployer], hre);
        } else {
            let salt = process.env.SWAP_ADAPTER_DEPLOY_SALT;
            let SwapAdapter = await ethers.getContractFactory("SwapAdapter");
            let param = ethers.utils.defaultAbiCoder.encode(["address"], [deployer]);
            let result = await create(salt, SwapAdapter.bytecode, param);
            swapAdapter = result[0];
        }
        console.log("SwapAdapter address :", swapAdapter);

        let deploy = await readFromFile(network.name);

        deploy[network.name]["SwapAdapter"] = swapAdapter;

        await writeToFile(deploy);
    }
});

task("router:setFeeManager", "set fee manager")
    .addParam("router", "router address")
    .addParam("feemanager", "feeManager address")
    .setAction(async (taskArgs, hre) => {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deployer } = await getNamedAccounts();

        console.log("\nset  fee manager on", hre.network.name);

        let deploy_json = await readFromFile(network.name);
        let router_addr = taskArgs.router;
        if (router_addr === "router") {
            if (deploy_json[network.name]["Router"] === undefined) {
                throw "can not get router address";
            }
            router_addr = deploy_json[network.name]["Router"]["addr"];
        }
        console.log("router: ", router_addr);
        let feeManager = taskArgs.feemanager;
        if (feeManager === "feeManager") {
            if (deploy_json[network.name]["FeeManager"] === undefined) {
                throw "can not get router address";
            }
            feeManager = deploy_json[network.name]["FeeManager"];
        }
        console.log("feeManager: ", feeManager);
        if (network.name === "Tron" || network.name === "TronTest") {
            await tronSetFeeManager(hre.artifacts, network.name, router_addr, feeManager);
        } else {
            console.log("deployer :", deployer);
            let Router = await ethers.getContractFactory("Router");
            let router = Router.attach(router_addr);
            await (await router.setFeeManager(feeManager)).wait();
            console.log("router setFeeManager:", feeManager);
        }
    });

task("router:setAuthorization", "set Authorization")
    .addParam("router", "router address")
    .addParam("executors", "executors address array")
    .addOptionalParam("flag", "flag, default: true", true, types.boolean)
    .setAction(async (taskArgs, hre) => {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deploy } = deployments;
        const { deployer } = await getNamedAccounts();

        console.log("\nset authorizations on", hre.network.name);

        if (network.name === "Tron" || network.name === "TronTest") {
            await tronSetAuthorization(hre.artifacts, network.name, taskArgs.router, taskArgs.executors, taskArgs.flag);
        } else {
            console.log("deployer :", deployer);
            console.log("=========", taskArgs.executors);
            let executors = taskArgs.executors.split(",");

            if (executors.length < 1) {
                console.log("executors is empty ...");
                return;
            }
            let Router = await ethers.getContractFactory("Router");

            let router = Router.attach(taskArgs.router);

            let result = await (await router.setAuthorization(executors, taskArgs.flag)).wait();

            if (result.status == 1) {
                console.log(`Router ${router.address} setAuthorization ${executors} succeed`);
            } else {
                console.log("setAuthorization failed");
            }
        }
    });

task("router:setAuthFromConfig", "set Authorization from config file")
    .addOptionalParam("router", "router address", "router", types.string)
    .setAction(async (taskArgs, hre) => {
        const { deployments, getNamedAccounts, ethers } = hre;
        const { deploy } = deployments;
        const { deployer } = await getNamedAccounts();

        console.log("\nset authorizations from config file on", hre.network.name);

        let config = getConfig(network.name);
        if (!config) {
            throw "config not set";
        }
        if (network.name === "Tron" || network.name === "TronTest") {
            await tronSetAuthFromConfig(hre.artifacts, network.name, taskArgs.router, config);
        } else {
            console.log("\nset Authorization from config file deployer :", deployer);
            let deploy_json = await readFromFile(network.name);

            let router_addr = taskArgs.router;
            if (router_addr === "router") {
                if (deploy_json[network.name]["Router"] === undefined) {
                    throw "can not get router address";
                }
                router_addr = deploy_json[network.name]["Router"]["addr"];
            }
            console.log("router: ", router_addr);

            let adapter_address = deploy_json[network.name]["SwapAdapter"];
            if (adapter_address != undefined) {
                console.log("SwapAdapter: ", adapter_address);
                config.executors.push(adapter_address);
            }

            let Router = await ethers.getContractFactory("Router");
            let router = Router.attach(router_addr);

            let executors = [];
            for (let i = 0; i < config.executors.length; i++) {
                let result = await await router.approved(config.executors[i]);

                if (result === false || result === undefined) {
                    executors.push(config.executors[i]);
                }
            }

            if (executors.length > 0) {
                let executors_s = executors.join(",");

                console.log("routers to set :", executors_s);

                await setAuthorization(router_addr, executors_s, true);
            }

            console.log("Router sync authorization from config file.");
        }
    });
