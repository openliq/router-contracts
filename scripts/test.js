const hre = require("hardhat");
let { getCCTP } = require("../configs/CCTPConfig.js");


let usdc = "0x5425890298aed601595a70AB815c96711a31Bc65"; //Fuji - usdc

async function main() {
    //  await deployCCTPAdapter();
    //  await setRemoteAdapter()
    // await bridge()
    // await onReceive();
    // await getHash();
    await multiBridge();
    // let MulitBridge = await hre.ethers.getContractFactory("MulitBridge");
    // let m = await MulitBridge.deploy();
    // await m.deployed();
    // console.log(m.address);

}
//p - 0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2
//a - 0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2

async function getHash() {
    let a =
        "";
    let d = ethers.utils.defaultAbiCoder.decode(["bytes"], a)[0];
    console.log(d);
    console.log(ethers.utils.keccak256(d));
}


async function deployCCTPAdapter() {
    let [wallet] = await hre.ethers.getSigners();
    console.log(wallet.address);
    let CCTPAdapter = await hre.ethers.getContractFactory("CCTPAdapter");
    let cctp = getCCTP(hre.network.name);
    let adapter = await CCTPAdapter.deploy(wallet.address, cctp.tokenMessenger, cctp.messageTransmitter);
    await adapter.deployed();
    console.log(adapter.address);
}

async function setRemoteAdapter() {
    let CCTPAdapter = await hre.ethers.getContractFactory("CCTPAdapter");
    let adapter = await CCTPAdapter.attach("0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2");
    let _domain = 7;
    let _adpter = "0x000000000000000000000000cC64a1A099ac8d77f42aF406d386d680e9fC45d2";
    await (await adapter.setRemoteAdapter(_domain, _adpter)).wait();
    console.log("------------done---------");
}

async function bridge() {
    let [wallet] = await hre.ethers.getSigners();
    let ERC20 = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint value) external returns (bool)",
    ];

    let token = await ethers.getContractAt(ERC20, usdc, wallet);
    let amount = 100000;
    await (await token.approve("0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2", amount)).wait();
    let CCTPAdapter = await hre.ethers.getContractFactory("CCTPAdapter");
    let PayMock = await hre.ethers.getContractFactory("PayMock");
    let payMock = PayMock.attach("0x769CFd4D1606fa51bDaE9a65088Fd3F8C2f02e46")
    let adapter = CCTPAdapter.attach("0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2");
    let _mintRecipient = "0x000000000000000000000000cC64a1A099ac8d77f42aF406d386d680e9fC45d2";

    let c = payMock.interface.encodeFunctionData("mockTransfer", ["0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97",wallet.address, amount]);
    let _callData = ethers.utils.defaultAbiCoder.encode(
        ["tuple(address,address,uint256,uint256,address,bytes)"],
        [
            [
                payMock.address,
                payMock.address,
                110,
                0,
                wallet.address,
                c,
            ],
        ]
    );

    await (
        await adapter.bridge(
            amount,
            7,
            _mintRecipient,
            usdc,
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes", "bytes"],
                [ethers.constants.HashZero, "0x", _callData]
            )
        )
    ).wait();
}


async function multiBridge() {
    let [wallet] = await hre.ethers.getSigners();
    let ERC20 = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint value) external returns (bool)",
    ];

    let token = await ethers.getContractAt(ERC20, usdc, wallet);
    let amount = 100000;
 
  

    let adapt = "0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2"
    let MulitBridge = await hre.ethers.getContractFactory("MulitBridge");
    let PayMock = await hre.ethers.getContractFactory("PayMock");
    let payMock = PayMock.attach("0x769CFd4D1606fa51bDaE9a65088Fd3F8C2f02e46")
    let mulitBridge = MulitBridge.attach("0xaA802d303948738373E3C1e5B529e93CFAF4ac18");
    let _mintRecipient = "0x000000000000000000000000cC64a1A099ac8d77f42aF406d386d680e9fC45d2";
    let c = payMock.interface.encodeFunctionData("mockTransfer", ["0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97",wallet.address, amount]);
    let _callData = ethers.utils.defaultAbiCoder.encode(
        ["tuple(address,address,uint256,uint256,address,bytes)"],
        [
            [
                payMock.address,
                payMock.address,
                110,
                0,
                wallet.address,
                c,
            ],
        ]
    );

    let p = [{
     amount:amount,
     destinationDomain:7,
     mintRecipient:_mintRecipient,
     burnToken:usdc,
     payload:ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes", "bytes"],[ethers.constants.HashZero, "0x", _callData])
    }
    ,{
        amount:amount,
        destinationDomain:7,
        mintRecipient:_mintRecipient,
        burnToken:usdc,
        payload:ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes", "bytes"],[ethers.constants.HashZero, "0x", _callData])
    }]
    await (await token.approve(mulitBridge.address, "200000")).wait();
    await (await mulitBridge.mulitBridge(adapt,p)).wait();

}

async function onReceive() {
    let CCTPAdapter = await hre.ethers.getContractFactory("CCTPAdapter");

    let adapter = await CCTPAdapter.attach("0xcC64a1A099ac8d77f42aF406d386d680e9fC45d2");
    let messages = [
        "0x0000000000000001000000070000000000049379000000000000000000000000eb08f243e5d3fcff26a9e38ae5520a669f4019d00000000000000000000000009f3b8679c73c2fef8b59b4f3444d4e156fb70aa5000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d2000000000000000000000000000000005425890298aed601595a70ab815c96711a31bc65000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d200000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d2",
        "0x000000000000000100000007000000000004937a000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d2000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d2000000000000000000000000cc64a1a099ac8d77f42af406d386d680e9fc45d2000000000000000000000000000000000000000000000000000000000004937900000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000769cfd4d1606fa51bdae9a65088fd3f8c2f02e46000000000000000000000000769cfd4d1606fa51bdae9a65088fd3f8c2f02e46000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000cdae5da23b64bfecd421d6487ffeabf6558828d00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000006466be0ee90000000000000000000000009999f7fea5938fd3b1e26a12c3f2fb024e194f970000000000000000000000000cdae5da23b64bfecd421d6487ffeabf6558828d00000000000000000000000000000000000000000000000000000000000186a000000000000000000000000000000000000000000000000000000000",
    ];

    let signatures = [
        "0xd936a0a953cc3768a575b556d22a84a8af5793a80915a3f47909c130fc7d42e00d8bd7d3c27ddc6a07e8091698bc09905fac26f3d0db6406c4265be3c2d05e791c409d04c261fac88c0d314cc1e0d39bbe45a0636fff06587c5716ab6d52c7dc1b23452cbdeccb025aca24e171c9248585581339a130c3893b682223284d31b85a1b",
        "0xa7421485273257bbf1c82d90b5a8f380fd697df66b4699a429288c7bc5039575076dd8a74c7076f93cdef380d6678324f8f12808715d26c95c6ce417c96ffcf71c4e2e25d5d473e4930a1b55f29b88c8d3e5b3d25585163ee931619032454f1db70c97a6562fc2413a18a6ef50f8c961f44ababb6964d391eace3b1b1e11c8e0571b",
    ];
    await (
        await adapter.onReceive("0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97", messages, signatures, {
            gasLimit: 2000000,
        })
    ).wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
