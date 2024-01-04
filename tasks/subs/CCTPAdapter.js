let { create, createZk, readFromFile, writeToFile } = require("../../utils/create.js");
let { task } = require("hardhat/config");
let { getCCTP } = require("../../configs/CCTPConfig.js");

task("CCTPAdapter:deploy", "deploy CCTPAdapter").setAction(async (taskArgs, hre) => {
    const { getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    console.log("deployer :", deployer);
         let cctp = getCCTP(network.name);
         if(cctp){
            let salt = process.env.CCTP_ADAPTER_SALT;
            let CCTPAdapter = await ethers.getContractFactory("CCTPAdapter");
            let param = ethers.utils.defaultAbiCoder.encode(["address","address","address"], [deployer,cctp.tokenMessenger,cctp.messageTransmitter]);
            let result = await create(salt, CCTPAdapter.bytecode, param);
            let cctpAdapter = result[0];
            console.log("cctpAdapter  address :", cctpAdapter);
            let deploy = await readFromFile(network.name);
            deploy[network.name]["cctpAdapter"] = cctpAdapter;
            await writeToFile(deploy);
         }else{
            throw("set config first");
         }
   
});


task("CCTPAdapter:setRemoteAdapter", "setRemoteAdapter")
    .addParam("domain", "remote domain")
    .addParam("adpater", "remote adpater address")
    .setAction(async (taskArgs, hre) => {
    const { getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    console.log("deployer :", deployer);
    let CCTPAdapter = await ethers.getContractFactory("CCTPAdapter");
    let deploy = await readFromFile(network.name);
    if(!deploy[network.name]["cctpAdapter"]){
        throw("deploy adpter first");
    }
    let cctpAdapter = CCTPAdapter.attach(deploy[network.name]["cctpAdapter"]);

    await (await cctpAdapter.setRemoteAdapter(taskArgs.domain,taskArgs.adpater)).wait();
});