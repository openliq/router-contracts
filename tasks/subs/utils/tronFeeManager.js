const { BigNumber } = require("ethers");
let {readFromFile,writeToFile} = require("../../../utils/create.js")
let {deploy_contract,getTronWeb} = require("../../../utils/tronUtil.js");




exports.deployFeeManager = async function(artifacts,network){
    let tronWeb = await getTronWeb(network);
    let deployer = '0x' + tronWeb.defaultAddress.hex.substring(2);
    console.log("deployer :",tronWeb.address.fromHex(deployer));
    let feeManager =  await deploy_contract(artifacts,"FeeManager",[deployer],tronWeb);
    console.log("FeeManager address :",feeManager);
    let deploy = await readFromFile(network);
    deploy[network]["FeeManager"] = feeManager;
    await writeToFile(deploy);
    return feeManager;
}


exports.initialFeeStruct = async function(artifacts,network,feeType,fixedPlatformNativeFee,platformTokenFee){
    let tronWeb = await getTronWeb(network);
    let deployer = '0x' + tronWeb.defaultAddress.hex.substring(2);
    console.log("deployer :",tronWeb.address.fromHex(deployer));
    let deploy = await readFromFile(network);
    if(!deploy[network]["FeeManager"]){
        throw("FeeManager not deploy");
    }
    let FeeManager = await artifacts.readArtifact("FeeManager");
    let address = deploy[network]["FeeManager"]
    if(address.startsWith("0x")){
        address = tronWeb.address.fromHex(address)
    }
    let feeManager = await tronWeb.contract(FeeManager.abi,address);
    let result = await feeManager.initialFeeStruct(feeType,fixedPlatformNativeFee,platformTokenFee).send();
    console.log(result);
}


exports.setIntegratorFees = async function(artifacts,network,integrator,feeType,tokenFee,platformTokenShare,platformNativeShare,fixedNativeAmount){
    let tronWeb = await getTronWeb(network);
    let deployer = '0x' + tronWeb.defaultAddress.hex.substring(2);
    console.log("deployer :",tronWeb.address.fromHex(deployer));
    let deploy = await readFromFile(network);
    if(!deploy[network]["FeeManager"]){
        throw("FeeManager not deploy");
    }
    let FeeManager = await artifacts.readArtifact("FeeManager");
    let address = deploy[network]["FeeManager"]
    if(address.startsWith("0x")){
        address = tronWeb.address.fromHex(address)
    }
    let feeManager = await tronWeb.contract(FeeManager.abi,address);
    let fee = [feeType,tokenFee,platformTokenShare,platformNativeShare,fixedNativeAmount]
    let result = await feeManager.setIntegratorFees(integrator,fee).send();
    console.log(result);
}


exports.withdrawPlatformFees = async function(artifacts,network,tokens){
    let tronWeb = await getTronWeb(network);
    let deployer = '0x' + tronWeb.defaultAddress.hex.substring(2);
    console.log("deployer :",tronWeb.address.fromHex(deployer));
    let deploy = await readFromFile(network);
    if(!deploy[network]["FeeManager"]){
        throw("FeeManager not deploy");
    }
    let FeeManager = await artifacts.readArtifact("FeeManager");
    let address = deploy[network]["FeeManager"]
    if(address.startsWith("0x")){
        address = tronWeb.address.fromHex(address)
    }
    let feeManager = await tronWeb.contract(FeeManager.abi,address);
    let tokenList = tokens.split(',');
    let result = await feeManager.withdrawPlatformFees(tokenList).send();
    console.log(result);
}


