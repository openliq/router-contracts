const { expect } = require("chai");
const { ethers, network } = require("hardhat");

let ERC20 = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint value) external returns (bool)",
];

describe("SwapAdapter", function () {
  let swapAdapter;
  let token;
  async function deployFixture(_wToken) {
    let [wallet, other] = await ethers.getSigners();
    let SwapAdapter = await ethers.getContractFactory("SwapAdapter");
    swapAdapter = await SwapAdapter.deploy(wallet.address);
    await swapAdapter.deployed();
    let MockToken = await ethers.getContractFactory("MockToken");
    token = await MockToken.deploy("TEST", "TT");
    await token.deployed();
  }
  it("deployments", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    expect(await swapAdapter.owner()).eq(wallet.address);
  });

  it("rescueFunds correct", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    let tx = {
      to: swapAdapter.address,
      value: ethers.utils.parseEther("1"),
    };

    await (await wallet.sendTransaction(tx)).wait();
    let before = await ethers.provider.getBalance(wallet.address);
    await swapAdapter
      .connect(wallet)
      .rescueFunds(ethers.constants.AddressZero, wallet.address, ethers.utils.parseEther("1"));
    let after = await ethers.provider.getBalance(wallet.address);

    expect(before).lt(after);
  });

  it("rescueFunds only owner", async () => {
    let [wallet, other] = await ethers.getSigners();
    await deployFixture();
    await expect(
      swapAdapter.connect(other).rescueFunds(ethers.constants.AddressZero, wallet.address, 100)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});
