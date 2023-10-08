
let { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
let { BigNumber } = require("ethers");
const { expect } = require("chai");
const { ethers, network } = require("hardhat");



let v5_router_addr = "0x1111111254EEB25477B68fb85Ed929f73A960582";

let wToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let ERC20 = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint value) external returns (bool)'
]

let ERC1155 = [
    'function balanceOf(address account, uint256 id) external view returns (uint256)'
]
//// fork mainnet
describe("Router", function () {
    let router;
    let mos;
    let swapAdapter;
    let feeManager;

    async function deployFixture(_wToken) {
        let [wallet, other] = await ethers.getSigners();
    
        let SwapAdapter = await ethers.getContractFactory("SwapAdapter");
        swapAdapter = await SwapAdapter.deploy(wallet.address);
        await swapAdapter.deployed();
        let Router = await ethers.getContractFactory("Router");
        router = await Router.deploy(wallet.address, _wToken);
        await router.deployed()
        let FeeManager = await ethers.getContractFactory("FeeManager");
        feeManager = await FeeManager.deploy(wallet.address);
        await feeManager.deployed();
        await (await router.setAuthorization([swapAdapter.address],true)).wait();
    }


    it("setAuthorization only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).setAuthorization([mos.address], true)).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("rescueFunds correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        let tx = {
            to: router.address,
            value: ethers.utils.parseEther('1')
        };

        await (await wallet.sendTransaction(tx)).wait();
        await expect(router.connect(other).rescueFunds(ethers.constants.AddressZero, ethers.utils.parseEther('1'))).to.be.ok;
    })

    it("rescueFunds only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).rescueFunds(ethers.constants.AddressZero, 100)).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("setFeeManager only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).setFeeManager(feeManager.address)).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("setFeeManager not contract", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setFeeManager(ethers.constants.AddressZero)).to.be.revertedWith("ButterRouterV2: not contract");
    })

    it("setFeeManager correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setFeeManager(feeManager.address)).to.emit(router,"SetFeeManager");
        expect(await router.feeManager()).eq(feeManager.address);
    })


    it("setAuthorization only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setAuthorization([wallet.address], true)).to.be.revertedWith("ButterRouterV2: not contract");
    })

    it("setAuthorization correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setAuthorization([mos.address], true)).to.be.emit(router, "Approve");
        let p = await router.approved(mos.address);
        expect(p).to.be.true;
        await expect(router.connect(wallet).setAuthorization([mos.address], false)).to.be.emit(router, "Approve");
        p = await router.approved(mos.address);
        expect(p).to.be.false;
    })


})