const { expect } = require("chai");
const { ethers, network } = require("hardhat");

let ERC20 = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint value) external returns (bool)",
];

describe("FeeManager", function () {
    let feeManager;
    let token;

    async function deployFixture(_wToken) {
        let [wallet, other] = await ethers.getSigners();
        let FeeManager = await ethers.getContractFactory("FeeManager");
        feeManager = await FeeManager.deploy(wallet.address);
        await feeManager.deployed();
        let MockToken = await ethers.getContractFactory("MockToken");
        token = await MockToken.deploy("TEST", "TT");
        await token.deployed();
    }

    it("deployments", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        expect(await feeManager.owner()).eq(wallet.address);
        let feeStruct = await feeManager.feeStruct();
        expect(feeStruct.receiver).eq(ethers.constants.AddressZero);
        expect(feeStruct.tokenFeeRate).eq(0);
        expect(feeStruct.fixedNative).eq(0);
        expect(feeStruct.share).eq(0);
    });

    it("initialFeeStruct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        let feeStruct = {
            receiver: other.address,
            tokenFeeRate: 10,
            fixedNative: "100000000000",
            share: "6000",
        };
        await expect(feeManager.connect(other).initialFeeStruct(feeStruct)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        feeStruct.receiver = ethers.constants.AddressZero;
        await expect(feeManager.connect(wallet).initialFeeStruct(feeStruct)).to.be.revertedWith("Router: zero addr");
        feeStruct.receiver = other.address;
        feeStruct.tokenFeeRate = 10001;
        await expect(feeManager.connect(wallet).initialFeeStruct(feeStruct)).to.be.revertedWith(
            "FeeManager: invalid tokenFeeRate"
        );
        feeStruct.tokenFeeRate = 10;
        feeStruct.share = 10001;
        await expect(feeManager.connect(wallet).initialFeeStruct(feeStruct)).to.be.revertedWith(
            "FeeManager: invalid  share"
        );
        feeStruct.share = 6000;
        await expect(feeManager.connect(wallet).initialFeeStruct(feeStruct)).to.emit(feeManager, "InitialFeeStruct");

        let f = await feeManager.feeStruct();
        expect(feeStruct.receiver).eq(f.receiver);
        expect(feeStruct.tokenFeeRate).eq(f.tokenFeeRate);
        expect(feeStruct.fixedNative).eq(f.fixedNative);
        expect(feeStruct.share).eq(f.share);
    });

    it("setIntegratorFees", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();

        let feeInfo = {
            openliqReceiver: other.address,
            fixedNative: 1000000,
            tokenFeeRate: 100,
            share: 6000,
        };
        await expect(feeManager.connect(other).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(
            feeManager.connect(wallet).setIntegratorFees(ethers.constants.AddressZero, feeInfo)
        ).to.be.revertedWith("Router: zero addr");
        feeInfo.openliqReceiver = ethers.constants.AddressZero;
        await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
            "Router: zero addr"
        );
        feeInfo.openliqReceiver = other.address;
        feeInfo.tokenFeeRate = 10001;
        await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
            "FeeManager: invalid integrator tokenFeeRate"
        );
        feeInfo.tokenFeeRate = 10;
        feeInfo.share = 10001;
        await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
            "FeeManager: invalid integrator share"
        );

        feeInfo.share = 6000;
        await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
            feeManager,
            "SetIntegratorFees"
        );
        let integratorFeeInfo = await feeManager.integratorToFeeInfo(wallet.address);
        expect(integratorFeeInfo.openliqReceiver).eq(feeInfo.openliqReceiver);
        expect(integratorFeeInfo.fixedNative).eq(feeInfo.fixedNative);
        expect(integratorFeeInfo.tokenFeeRate).eq(feeInfo.tokenFeeRate);
        expect(integratorFeeInfo.share).eq(feeInfo.share);
    });

    it("getAmountBeforeFee", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        let feeStruct = {
            receiver: other.address,
            tokenFeeRate: 100,
            fixedNative: "100000000000",
            share: "6000",
        };

        await expect(feeManager.connect(wallet).initialFeeStruct(feeStruct)).to.emit(feeManager, "InitialFeeStruct");

        let feeInfo = {
            openliqReceiver: other.address,
            fixedNative: "100000000000",
            tokenFeeRate: 100,
            share: 6000,
        };

        await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
            feeManager,
            "SetIntegratorFees"
        );

        let amount = ethers.utils.parseEther("1000");
        console.log(amount);
        let before = await feeManager.getAmountBeforeFee(other.address, token.address, amount, 150);
        console.log(before.beforeAmount);
        let fee = await feeManager.getFee(other.address, token.address, before.beforeAmount, 150);
        console.log("1====", before.beforeAmount.sub(fee.openLiqToken.add(fee.integratorToken)));

        before = await feeManager.getAmountBeforeFee(wallet.address, token.address, amount, 150);
        console.log(before.beforeAmount);
        fee = await feeManager.getFee(wallet.address, token.address, before.beforeAmount, 150);
        console.log(fee.openLiqToken.add(fee.integratorToken));
        console.log("2====", before.beforeAmount.sub(fee.openLiqToken.add(fee.integratorToken)));

        before = await feeManager.getAmountBeforeFee(other.address, ethers.constants.AddressZero, amount, 150);
        console.log(before.beforeAmount);
        fee = await feeManager.getFee(other.address, ethers.constants.AddressZero, before.beforeAmount, 150);
        console.log("3====", before.beforeAmount.sub(fee.openLiqToken.add(fee.integratorToken.add(fee.openliqNative))));

        before = await feeManager.getAmountBeforeFee(wallet.address, ethers.constants.AddressZero, amount, 150);
        console.log(before.beforeAmount);
        fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, before.beforeAmount, 150);
        console.log("4====", before.beforeAmount.sub(fee.openLiqToken.add(fee.integratorToken.add(fee.openliqNative))));
    });
});
