let { readFromFile, writeToFile } = require("../../../utils/create.js");
let { deploy_contract, getTronWeb } = require("../../../utils/tronUtil.js");

exports.deployReceiver = async function (artifacts, network, router) {
  let tronWeb = await getTronWeb(network);
  let deployer = "0x" + tronWeb.defaultAddress.hex.substring(2);
  console.log("deployer :", tronWeb.address.fromHex(deployer));
  let receiver = await deploy_contract(artifacts, "Receiver", [router, deployer], tronWeb);
  console.log("Receiver address :", receiver);
  let deploy = await readFromFile(network);
  deploy[network]["Receiver"] = receiver;
  await writeToFile(deploy);
  return receiver;
};

exports.tronSetRouter = async function (artifacts, network, receiver_addr, router, name) {
  let tronWeb = await getTronWeb(network);
  if (receiver_addr.startsWith("0x")) {
    receiver_addr = tronWeb.address.fromHex(receiver_addr);
  }
  let Receiver = await artifacts.readArtifact("Receiver");
  if (receiver_addr.startsWith("0x")) {
    receiver_addr = tronWeb.address.fromHex(receiver_addr);
  }
  let receiver = await tronWeb.contract(Receiver.abi, receiver_addr);
  let result;
  if (name === "cbridge") {
    result = await receiver.setCBridgeMessageBus(taskArgs.router).send();
  } else if (name === "amarok") {
    result = await receiver.setAmarokRouter(taskArgs.router).send();
  } else if (name === "stargate") {
    result = await receiver.setStargateRouter(taskArgs.router).send();
  } else if (name === "openliq") {
    result = await receiver.setAuthorization(taskArgs.router).send();
  } else {
    throw "unspport name";
  }

  console.log(result);
  let deploy = await readFromFile(network.name);
  deploy[network.name]["Receiver"][name] = router;
  await writeToFile(deploy);
};
