const hre = require("hardhat");
let { Wallet } = require("zksync-web3");
let { HardhatRuntimeEnvironment } = require("hardhat/types");
let { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
async function main() {
    // let Router = await ethers.getContractFactory("ButterRouterV2");
    // let router = Router.attach("0xeD0d32037dD62f09E550c3Cd798497feA7C34051");

    // console.log(await router.mosAddress());
    await deploy();
}

async function deploy() {
    console.log(`Running deploy script`);

    // Initialize the wallet.
    const wallet = new Wallet(process.env.PRIVATE_KEY);

    console.log(wallet.address);

    // Create deployer object and load the artifact of the contract we want to deploy.
    const deployer = new Deployer(hre, wallet);

    // Load contract
    const artifact = await deployer.loadArtifact("DeployFactory");

    // Deploy this contract. The returned object will be of a `Contract` type,
    // similar to the ones in `ethers`.
    const deployedContract = await deployer.deploy(artifact);

    // Show the contract info.
    console.log(JSON.stringify({ address: deployedContract.address, constructorArgs: "" }));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
