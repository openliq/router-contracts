let { readFromFile, writeToFile } = require("../../../utils/create.js");
let { deploy_contract, getTronWeb } = require("../../../utils/tronUtil.js");

exports.deployRouter = async function (artifacts, network, wtoken) {
  await deployRouter(artifacts, network, wtoken);
};

exports.deploySwapAdapter = async function (artifacts, network) {
  await deploySwapAdapter(artifacts, network);
};

exports.tronSetAuthorization = async function (artifacts, network, router_addr, executors, flag) {
  let tronWeb = await getTronWeb(network);
  await setAuthorization(tronWeb, artifacts, router_addr, executors, flag);
};

exports.tronSetFeeManager = async function (artifacts, network, router_addr, feeManager) {
  let tronWeb = await getTronWeb(network);
  if (router_addr.startsWith("0x")) {
    router_addr = tronWeb.address.fromHex(router_addr);
  }
  let Router = await artifacts.readArtifact("Router");
  let router = await tronWeb.contract(Router.abi, router_addr);
  await router.setFeeManager(feeManager).send();
  console.log("router setFeeManager:", feeManager);
};

async function deployRouter(artifacts, network, wtoken) {
  let tronWeb = await getTronWeb(network);
  let deployer = "0x" + tronWeb.defaultAddress.hex.substring(2);
  console.log("deployer :", tronWeb.address.fromHex(deployer));
  let router = await deploy_contract(artifacts, "Router", [deployer, wtoken], tronWeb);
  console.log("router address :", router);
  let deploy = await readFromFile(network);
  if (!deploy[network]["Router"]) {
    deploy[network]["Router"] = {};
  }
  deploy[network]["Router"]["addr"] = router;
  await writeToFile(deploy);
  return router;
}

exports.tronSetAuthFromConfig = async function (artifacts, network, router_addr, config) {
  let deploy_json = await readFromFile(network);
  if (router_addr === "router") {
    if (deploy_json[network]["Router"] === undefined) {
      throw "can not get router address";
    }
    router_addr = deploy_json[network]["Router"]["addr"];
  }
  console.log("router: ", router_addr);

  let adapter_address = deploy_json[network]["SwapAdapter"];
  if (adapter_address != undefined) {
    console.log("SwapAdapter: ", adapter_address);
    config.executors.push(adapter_address);
  }
  let tronWeb = await getTronWeb(network);
  let Router = await artifacts.readArtifact("Router");
  if (router_addr.startsWith("0x")) {
    router_addr = tronWeb.address.fromHex(router_addr);
  }
  let router = await tronWeb.contract(Router.abi, router_addr);
  let executors = [];
  for (let i = 0; i < config.executors.length; i++) {
    let result = await await router.approved(config.executors[i]).call();

    if (result === false || result === undefined) {
      executors.push(config.executors[i]);
    }
  }
  if (executors.length > 0) {
    let executors_s = executors.join(",");

    console.log("routers to set :", executors_s);

    await setAuthorization(tronWeb, artifacts, router_addr, executors_s, true);
  }
  console.log("Router sync authorization from config file.");
};

async function deploySwapAdapter(artifacts, network) {
  let tronWeb = await getTronWeb(network);
  let deployer = "0x" + tronWeb.defaultAddress.hex.substring(2);
  console.log("deployer :", tronWeb.address.fromHex(deployer));
  let adapt = await deploy_contract(artifacts, "SwapAdapter", [deployer], tronWeb);
  console.log("SwapAdapter address :", adapt);
  let deploy = await readFromFile(network);
  deploy[network]["SwapAdapter"] = adapt;
  await writeToFile(deploy);
  return adapt;
}

async function setAuthorization(tronWeb, artifacts, router_addr, executors, flag) {
  let Router = await artifacts.readArtifact("Router");
  if (router_addr.startsWith("0x")) {
    router_addr = tronWeb.address.fromHex(router_addr);
  }
  let router = await tronWeb.contract(Router.abi, router_addr);
  let executorList = executors.split(",");
  if (executorList.length < 1) {
    console.log("executors is empty ...");
    return;
  }
  await router.setAuthorization(executorList, flag).send();
  console.log(`Router ${router_addr} setAuthorization ${executorList} succeed`);
}
