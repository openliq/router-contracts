let { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
let { BigNumber } = require("ethers");
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

let v5_router_addr = "0x1111111254EEB25477B68fb85Ed929f73A960582";

let wToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let ERC20 = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint value) external returns (bool)",
];

let ERC1155 = ["function balanceOf(address account, uint256 id) external view returns (uint256)"];
//// fork mainnet
describe("Router", function () {
    let router;
    let swapAdapter;
    let feeManager;

    async function deployFixture(_wToken) {
        let [wallet, other] = await ethers.getSigners();

        let SwapAdapter = await ethers.getContractFactory("SwapAdapter");
        swapAdapter = await SwapAdapter.deploy(wallet.address);
        await swapAdapter.deployed();
        let Router = await ethers.getContractFactory("Router");
        if (!_wToken) {
            _wToken = swapAdapter.address;
        }
        router = await Router.deploy(wallet.address, _wToken);
        await router.deployed();
        let FeeManager = await ethers.getContractFactory("FeeManager");
        feeManager = await FeeManager.deploy(wallet.address);
        await feeManager.deployed();
        await (await router.setAuthorization([swapAdapter.address], true)).wait();
    }

    it("setAuthorization only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).setAuthorization([swapAdapter.address], true)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("rescueFunds correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        let tx = {
            to: router.address,
            value: ethers.utils.parseEther("1"),
        };

        await (await wallet.sendTransaction(tx)).wait();
        let before = await ethers.provider.getBalance(wallet.address);
        await router.connect(wallet).rescueFunds(ethers.constants.AddressZero, ethers.utils.parseEther("1"));
        let after = await ethers.provider.getBalance(wallet.address);

        expect(before).lt(after);
    });

    it("rescueFunds only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).rescueFunds(ethers.constants.AddressZero, 100)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("setFeeManager only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(other).setFeeManager(feeManager.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it("setFeeManager not contract", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setFeeManager(ethers.constants.AddressZero)).to.be.revertedWith(
            "Router: not contract"
        );
    });

    it("setFeeManager correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setFeeManager(feeManager.address)).to.emit(router, "SetFeeManager");
        expect(await router.feeManager()).eq(feeManager.address);
    });

    it("setAuthorization only owner", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setAuthorization([wallet.address], true)).to.be.revertedWith(
            "Router: not contract"
        );
    });

    it("setAuthorization correct", async () => {
        let [wallet, other] = await ethers.getSigners();
        await deployFixture();
        await expect(router.connect(wallet).setAuthorization([swapAdapter.address], true)).to.be.emit(
            router,
            "Approve"
        );
        let p = await router.approved(swapAdapter.address);
        expect(p).to.be.true;
        await expect(router.connect(wallet).setAuthorization([swapAdapter.address], false)).to.be.emit(
            router,
            "Approve"
        );
        p = await router.approved(swapAdapter.address);
        expect(p).to.be.false;
    });

    //  call rubic
    it("swapAndCall", async () => {
        let rubic = "0x3335733c454805df6a77f825f266e136FB4a3333";
        let user;
        // 0x1252eb0912559a206dd3600f283f2a48dca24196
        this.timeout(0);
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
                        blockNumber: 17278048,
                    },
                },
            ],
        });
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x2152c4b93c86ead03ab44a63c4147ad1e6152604"],
        });
        user = await ethers.getSigner("0x2152c4b93c86ead03ab44a63c4147ad1e6152604");
        await deployFixture(wToken);
        await (await router.setFeeManager(feeManager.address)).wait();
        await (await router.setAuthorization([rubic], true)).wait();
        //tx https://etherscan.io/tx/0x2af1262e6bb3cb4d7dacba31308feaa494ec7baa8f9c5e5852ce8ef7ba13c5e3
        let data =
            "0xe1fcde8e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000502ae820000000000000000000000000000000000000000000000000000000000000364b3474174a75cec0a383680e9b6c8cd3d75f8b9615f7e41a836062df704f28d284ed4d925000000000000000000000000a96598475cb54c281e898d2d66fcfbe9c876950700000000000000000000000057819398ec5e589df7accb8a415ce718b6ab3b6e0000000000000000000000002152c4b93c86ead03ab44a63c4147ad1e6152604000000000000000000000000000000000000000000188082aa6e42ebe757afa900000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000006450dee7fd2fb8e39061434babcfc05599a6fb8000000000000000000000000000000000000000000000000000000000502ae8200000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001486af479b200000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000005016625000000000000000000000000000000000000000000188082aa6e42ebe757afa800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000646b175474e89094c44da98b954eedeac495271d0f00271006450dee7fd2fb8e39061434babcfc05599a6fb8000000000000000000000000000000000000000000000000000000000000869584cd000000000000000000000000a96598475cb54c281e898d2d66fcfbe9c8769507000000000000000000000000000000000000000000000026fd57ed7d6464899100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        let _amount = BigNumber.from("84061826");
        let extraNativeAmount = ethers.utils.parseEther("0.00052109388027347");
        let _srcToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        let _swapData = "0x";
        let _callData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(address,address,uint256,uint256,address,bytes)"],
            [[rubic, rubic, _amount, extraNativeAmount, user.address, data]]
        );
        let _permitData = "0x";
        let token = await ethers.getContractAt(ERC20, _srcToken, user);
        let tokenOut = await ethers.getContractAt(ERC20, "0x06450dEe7FD2Fb8E39061434BAbCFC05599a6Fb8", user);
        let balanceBefore = await tokenOut.balanceOf(user.address);
        await (await token.approve(router.address, _amount)).wait();
        await (
            await router
                .connect(user)
                .swapAndCall(
                    ethers.constants.HashZero,
                    _srcToken,
                    _amount,
                    user.address,
                    _swapData,
                    _callData,
                    _permitData,
                    {
                        value: extraNativeAmount,
                    }
                )
        ).wait();
        let balanceAfter = await tokenOut.balanceOf(user.address);

        expect(balanceAfter).gt(balanceBefore);
    });

    it("swapAndCall", async () => {
        let user;
        // 0x1252eb0912559a206dd3600f283f2a48dca24196
        this.timeout(0);
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
                        blockNumber: 16930372,
                    },
                },
            ],
        });
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x1252eb0912559a206dd3600f283f2a48dca24196"],
        });
        user = await ethers.getSigner("0x1252eb0912559a206dd3600f283f2a48dca24196");
        await deployFixture(wToken);
        await (await router.setFeeManager(feeManager.address)).wait();
        await (await router.setAuthorization([v5_router_addr], true)).wait();
        //tx https://etherscan.io/tx/0x2af1262e6bb3cb4d7dacba31308feaa494ec7baa8f9c5e5852ce8ef7ba13c5e3
        let data =
            "0x12aa3caf0000000000000000000000007122db0ebe4eb9b434a9f2ffe6760bc03bfbd0e00000000000000000000000006f3277ad0782a7da3eb676b85a8346a100bf9c1c000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000004c7e62fbb86b204f7c6dc1f582ddd889182d5cf50000000000000000000000001252eb0912559a206dd3600f283f2a48dca2419600000000000000000000000000000000000000000083225966d50d5bd8100000000000000000000000000000000000000000000000000000000000001559be1a000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001100000000000000000000000000000000000000000000000000000000000f200a007e5c0d20000000000000000000000000000000000000000000000000000ce00006700206ae40711b8002dc6c04c7e62fbb86b204f7c6dc1f582ddd889182d5cf50d4a11d5eeaac28ec3f61d100daf4d40471f185200000000000000000000000000000000000000000000000000000000000000016f3277ad0782a7da3eb676b85a8346a100bf9c1c00206ae40711b8002dc6c00d4a11d5eeaac28ec3f61d100daf4d40471f18521111111254eeb25477b68fb85ed929f73a9605820000000000000000000000000000000000000000000000000000000000000001c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000e26b9977";
        let _amount = BigNumber.from("158531492000000000000000000");
        let _srcToken = "0x6f3277ad0782a7DA3eb676b85a8346A100BF9C1c";
        let _swapData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(uint8,address,address,address,address,uint256,bytes)"],
            [[0, v5_router_addr, v5_router_addr, user.address, "0xdAC17F958D2ee523a2206206994597C13D831ec7", 0, data]]
        );
        let _permitData = "0x";
        let token = await ethers.getContractAt(ERC20, "0x6f3277ad0782a7DA3eb676b85a8346A100BF9C1c", user);
        let tokenOut = await ethers.getContractAt(ERC20, "0xdAC17F958D2ee523a2206206994597C13D831ec7", user);
        let balanceBefore = await tokenOut.balanceOf(user.address);
        await (await token.approve(router.address, _amount)).wait();
        await (
            await router
                .connect(user)
                .swapAndCall(ethers.constants.HashZero, _srcToken, _amount, user.address, _swapData, "0x", _permitData)
        ).wait();
        let balanceAfter = await tokenOut.balanceOf(user.address);

        expect(balanceAfter).gt(balanceBefore);
    });

    it("swapAndCall", async () => {
        let user;
        // 0x1252eb0912559a206dd3600f283f2a48dca24196
        this.timeout(0);
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
                        blockNumber: 16930863,
                    },
                },
            ],
        });
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x90c1d107ad3f503cd6ba3d1756da9935530816bf"],
        });
        user = await ethers.getSigner("0x90c1d107ad3f503cd6ba3d1756da9935530816bf");
        await deployFixture(wToken);
        await (await router.setFeeManager(feeManager.address)).wait();
        await (await router.setAuthorization([v5_router_addr], true)).wait();
        //tx https://etherscan.io/tx/0xb6a7276b87b9763898c38ea19b7573cd81e6af5643031b835d15aa2ad6000442
        let data =
            "0xe449022e00000000000000000000000000000000000000000000002040afeac5ac1a3767000000000000000000000000000000000000000000000000250875e870d7b5850000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000120000000000000000000000080c7770b4399ae22149db17e97f9fc8a10ca5100e26b9977";
        let _amount = BigNumber.from("594957012632774260583");
        let _srcToken = "0xA8b919680258d369114910511cc87595aec0be6D";
        let _swapData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(uint8,address,address,address,address,uint256,bytes)"],
            [[0, v5_router_addr, v5_router_addr, user.address, ethers.constants.AddressZero, 0, data]]
        );
        let _permitData = "0x";
        let _callData = "0x";
        let token = await ethers.getContractAt(ERC20, _srcToken, user);
        let balanceBefore = await user.getBalance();
        await (await token.approve(router.address, _amount)).wait();
        await (
            await router
                .connect(user)
                .swapAndCall(
                    ethers.constants.HashZero,
                    _srcToken,
                    _amount,
                    user.address,
                    _swapData,
                    _callData,
                    _permitData
                )
        ).wait();
        let balanceAfter = await user.getBalance();
        expect(balanceAfter).gt(balanceBefore);
    });

    it("swapAndCall", async () => {
        let user;
        // 0x1252eb0912559a206dd3600f283f2a48dca24196
        this.timeout(0);
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
                        blockNumber: 16930863,
                    },
                },
            ],
        });
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x90c1d107ad3f503cd6ba3d1756da9935530816bf"],
        });
        user = await ethers.getSigner("0x90c1d107ad3f503cd6ba3d1756da9935530816bf");
        PayMock = await ethers.getContractFactory("PayMock");
        let pay = await PayMock.deploy();
        await pay.deployed();
        await deployFixture(wToken);
        await (await router.setAuthorization([v5_router_addr], true)).wait();
        await (await router.setAuthorization([pay.address], true)).wait();
        await (await router.setFeeManager(feeManager.address)).wait();
        //tx https://etherscan.io/tx/0xb6a7276b87b9763898c38ea19b7573cd81e6af5643031b835d15aa2ad6000442
        let data =
            "0xe449022e00000000000000000000000000000000000000000000002040afeac5ac1a3767000000000000000000000000000000000000000000000000250875e870d7b5850000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000120000000000000000000000080c7770b4399ae22149db17e97f9fc8a10ca5100e26b9977";
        let _amount = BigNumber.from("594957012632774260583");
        let _srcToken = "0xA8b919680258d369114910511cc87595aec0be6D";

        let _swapData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(uint8,address,address,address,address,uint256,bytes)"],
            [[0, v5_router_addr, v5_router_addr, user.address, ethers.constants.AddressZero, 0, data]]
        );

        let pay_fuc_encode = PayMock.interface.encodeFunctionData("payFor", [user.address]);

        let _payData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(address,address,uint256,uint256,address,bytes)"],
            [[pay.address, pay.address, ethers.utils.parseEther("1"), 0, user.address, pay_fuc_encode]]
        );

        let _permitData = "0x";
        let token = await ethers.getContractAt(ERC20, _srcToken, user);
        await (await token.approve(router.address, _amount)).wait();
        await expect(
            router
                .connect(user)
                .swapAndCall(
                    ethers.constants.HashZero,
                    _srcToken,
                    _amount,
                    user.address,
                    _swapData,
                    _payData,
                    _permitData
                )
        )
            .to.be.emit(pay, "Pay")
            .emit(router, "SwapAndCall");
        let result = await ethers.provider.getBalance(pay.address);
        expect(result).gt(0);
    });
});
