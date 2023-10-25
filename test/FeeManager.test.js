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
    expect(feeStruct.feeType).eq(0);
    expect(feeStruct.platformTokenFee).eq(0);
    expect(feeStruct.fixedPlatformNativeFee).eq(0);
  });

  it("initialFeeStruct", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    await expect(feeManager.connect(other).initialFeeStruct(1, 1000, 1000)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(feeManager.connect(wallet).initialFeeStruct(2, 1000, 10000)).to.be.revertedWith(
      "invalid platformTokenFee"
    );
    await expect(feeManager.connect(wallet).initialFeeStruct(1, 1000, 10000)).to.emit(feeManager, "InitialFeeStruct");
    let feeStruct = await feeManager.feeStruct();
    expect(feeStruct.feeType).eq(1);
    expect(feeStruct.platformTokenFee).eq(10000);
    expect(feeStruct.fixedPlatformNativeFee).eq(1000);
  });

  it("setIntegratorFees", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    let feeInfo = {
      feeType: 1,
      tokenFee: 100,
      platformTokenShare: 100,
      platformNativeShare: 100,
      fixedNativeAmount: 100,
    };
    await expect(feeManager.connect(other).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(
      feeManager.connect(wallet).setIntegratorFees(ethers.constants.AddressZero, feeInfo)
    ).to.be.revertedWith("Router: zero addr");
    feeInfo.feeType = 2;
    feeInfo.tokenFee = 10000;
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
      "invalid tokenFee"
    );
    feeInfo.feeType = 2;
    feeInfo.tokenFee = 100;
    feeInfo.platformTokenShare = 10000;
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
      "invalid platformTokenShare"
    );
    feeInfo.platformTokenShare = 100;
    feeInfo.platformNativeShare = 10000;
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.be.revertedWith(
      "invalid platformNativeShare"
    );
    feeInfo.platformNativeShare = 100;
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );
    let integratorFeeInfo = await feeManager.integratorFeeInfo(wallet.address);
    expect(integratorFeeInfo.feeType).eq(feeInfo.feeType);
    expect(integratorFeeInfo.tokenFee).eq(feeInfo.tokenFee);
    expect(integratorFeeInfo.platformTokenShare).eq(feeInfo.platformTokenShare);
    expect(integratorFeeInfo.platformNativeShare).eq(feeInfo.platformNativeShare);
    expect(integratorFeeInfo.fixedNativeAmount).eq(feeInfo.fixedNativeAmount);
  });

  it("getFee -> erc20 FeeStruct fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(1, 1000, 10000)).to.emit(feeManager, "InitialFeeStruct");

    let fee = await feeManager.getFee(wallet.address, token.address, 90000);

    expect(fee.feeToken).eq(token.address);
    expect(fee.nativeAmount).eq(1000);
    expect(fee.amount).eq(10000);
  });

  it("getFee -> erc20 FeeStruct RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(2, 10000, 1000)).to.emit(feeManager, "InitialFeeStruct");

    let fee = await feeManager.getFee(wallet.address, token.address, 90000);

    expect(fee.feeToken).eq(token.address);
    expect(fee.nativeAmount).eq(10000);
    expect(fee.amount).eq((90000 * 1000) / 10000);
  });

  it("getFee -> native FeeStruct fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(1, 1000, 10000)).to.emit(feeManager, "InitialFeeStruct");

    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, 90000);

    expect(fee.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount).eq(1000 + 10000);
    expect(fee.amount).eq(0);
  });

  it("getFee -> native FeeStruct RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(2, 10000, 1000)).to.emit(feeManager, "InitialFeeStruct");

    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, 90000);

    expect(fee.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount).eq(10000 + (90000 * 1000) / 10000);
    expect(fee.amount).eq(0);
  });

  it("getFee -> erc20 Integrator fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 1,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );

    let fee = await feeManager.getFee(wallet.address, token.address, 90000);

    expect(fee.feeToken).eq(token.address);
    expect(fee.nativeAmount).eq(400);
    expect(fee.amount).eq(100);
  });

  it("getFee -> erc20 Integrator RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    let feeInfo = {
      feeType: 2,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );

    let fee = await feeManager.getFee(wallet.address, token.address, 90000);

    expect(fee.feeToken).eq(token.address);
    expect(fee.nativeAmount).eq(400);
    expect(fee.amount).eq((90000 * 100) / 10000);
  });

  it("getFee -> native Integrator fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 1,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );

    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, 90000);

    expect(fee.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount).eq(400 + 100);
    expect(fee.amount).eq(0);
  });

  it("getFee -> native Integrator RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 2,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );

    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, 90000);

    expect(fee.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount).eq(400 + (90000 * 100) / 10000);
    expect(fee.amount).eq(0);
  });

  it("getAmountBeforeFee -> erc20 FeeStruct fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(1, 1000, 2000)).to.emit(feeManager, "InitialFeeStruct");
    let before = await feeManager.getAmountBeforeFee(wallet.address, token.address, 10000);
    expect(before.feeToken).eq(token.address);
    let fee = await feeManager.getFee(wallet.address, token.address, before.beforeAmount);
    expect(fee.amount.add(10000)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> erc20 FeeStruct RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(2, 1000, 2000)).to.emit(feeManager, "InitialFeeStruct");
    let before = await feeManager.getAmountBeforeFee(wallet.address, token.address, 10000);
    expect(before.feeToken).eq(token.address);
    let fee = await feeManager.getFee(wallet.address, token.address, before.beforeAmount);

    expect(fee.amount.add(10000 + 1)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> native FeeStruct fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(1, 1000, 2000)).to.emit(feeManager, "InitialFeeStruct");
    let before = await feeManager.getAmountBeforeFee(wallet.address, ethers.constants.AddressZero, 10000);
    expect(before.feeToken).eq(ethers.constants.AddressZero);
    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, before.beforeAmount);

    expect(fee.nativeAmount.add(10000)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> native FeeStruct RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();

    await expect(feeManager.connect(wallet).initialFeeStruct(2, 1000, 2000)).to.emit(feeManager, "InitialFeeStruct");
    let before = await feeManager.getAmountBeforeFee(wallet.address, ethers.constants.AddressZero, 10000);
    expect(before.feeToken).eq(ethers.constants.AddressZero);
    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, before.beforeAmount);

    expect(fee.nativeAmount.add(10000 + 1)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> erc20 Integrator fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 1,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );
    let before = await feeManager.getAmountBeforeFee(wallet.address, token.address, 10000);
    let fee = await feeManager.getFee(wallet.address, token.address, before.beforeAmount);
    expect(before.feeToken).eq(token.address);
    expect(fee.amount.add(10000)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> erc20 Integrator RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 2,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );
    let before = await feeManager.getAmountBeforeFee(wallet.address, token.address, 10000);
    let fee = await feeManager.getFee(wallet.address, token.address, before.beforeAmount);
    expect(before.feeToken).eq(token.address);
    expect(fee.amount.add(10000 + 1)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> native Integrator fixed", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 1,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );
    let before = await feeManager.getAmountBeforeFee(wallet.address, ethers.constants.AddressZero, 10000);
    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, before.beforeAmount);
    expect(before.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount.add(10000)).eq(before.beforeAmount);
  });

  it("getAmountBeforeFee -> native Integrator RATIO", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let feeInfo = {
      feeType: 2,
      tokenFee: 100,
      platformTokenShare: 200,
      platformNativeShare: 300,
      fixedNativeAmount: 400,
    };
    await expect(feeManager.connect(wallet).setIntegratorFees(wallet.address, feeInfo)).to.emit(
      feeManager,
      "SetIntegratorFees"
    );
    let before = await feeManager.getAmountBeforeFee(wallet.address, ethers.constants.AddressZero, 10000);
    let fee = await feeManager.getFee(wallet.address, ethers.constants.AddressZero, before.beforeAmount);
    expect(before.feeToken).eq(ethers.constants.AddressZero);
    expect(fee.nativeAmount.add(10000 + 1)).eq(before.beforeAmount);
  });
});
