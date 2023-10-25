let { readFromFile, writeToFile } = require("../../../utils/create.js");
let { deploy_contract, getTronWeb } = require("../../../utils/tronUtil.js");

exports.deployTransferProxy = async function (artifacts, network) {
  let tronWeb = await getTronWeb(network);
  let deployer = "0x" + tronWeb.defaultAddress.hex.substring(2);
  console.log("deployer :", tronWeb.address.fromHex(deployer));
  let transferProxy = await deploy_contract(artifacts, "TransferProxy", [deployer], tronWeb);
  console.log("TransferProxy address :", transferProxy);
  let deploy = await readFromFile(network);
  deploy[network]["transferProxy"] = transferProxy;
  await writeToFile(deploy);
  return transferProxy;
};
