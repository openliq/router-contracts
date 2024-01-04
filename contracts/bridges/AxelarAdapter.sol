// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;


import "../lib/Helper.sol";
import "../lib/ErrorMessage.sol";
import "../abstract/RemoteSwapper.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
contract AxelarAdapter is RemoteSwapper,AxelarExecutable {
    IAxelarGasService public gasService;
    uint256 public recoverGas = 200000;

    event RecoverGasSet(uint256 indexed _recoverGas);
    event SetGasService(address indexed _gasService);
    event AxelarBridge(address indexed bridgeToken,uint256 indexed amount,string  destinationChain,string  destinationAddress);
    struct Param {
        uint256 amount;
        string  bridgedTokenSymbol;
        string  destinationChain;
        string  destinationAddress;
    }
    constructor(address _gateway,address _gasService)AxelarExecutable(_gateway){
         gasService = IAxelarGasService(_gasService);
    }
    function setGasService(address _gasService) external onlyOwner {
        gasService = IAxelarGasService(_gasService);
        emit SetGasService(_gasService);
    }
    function setRecoverGas(uint256 _recoverGas) external onlyOwner {
        recoverGas = _recoverGas;
        emit RecoverGasSet(_recoverGas);
    }

    function bridgeCall(
        bytes calldata payload,
        address gasRefundRecipient,
        Param calldata param
    ) external payable {
        require(param.amount != 0,ErrorMessage.ZERO_IN);
        require(gasRefundRecipient != Helper.ZERO_ADDRESS,ErrorMessage.ZERO_ADDR);
        address bridgedTokenAddress = gateway.tokenAddresses(param.bridgedTokenSymbol);
        require(bridgedTokenAddress != Helper.ZERO_ADDRESS,"unsupport token");
        require(payload.length != 0,"empty payload");
        SafeERC20.safeTransferFrom(IERC20(bridgedTokenAddress),msg.sender, address(this), param.amount);

        gasService.payNativeGasForContractCallWithToken{value: msg.value}(
            address(this),
            param.destinationChain,
            param.destinationAddress,
            payload,
            param.bridgedTokenSymbol,
            param.amount,
            gasRefundRecipient
        );


        SafeERC20.safeIncreaseAllowance(IERC20(bridgedTokenAddress), address(gateway), param.amount);
        gateway.callContractWithToken(
            param.destinationChain,
            param.destinationAddress,
            payload,
            param.bridgedTokenSymbol,
            param.amount
        );
        SafeERC20.safeApprove(IERC20(bridgedTokenAddress), address(gateway), 0);

        emit AxelarBridge(bridgedTokenAddress,param.amount,param.destinationChain,param.destinationAddress);
    }

     
    function bridge(Param calldata param) external {
        require(param.amount != 0,ErrorMessage.ZERO_IN);
        address bridgedTokenAddress = gateway.tokenAddresses(param.bridgedTokenSymbol);
        require(Helper._isNative(bridgedTokenAddress),"unsupport token");
        SafeERC20.safeTransferFrom(IERC20(bridgedTokenAddress),msg.sender, address(this), param.amount);
        SafeERC20.safeIncreaseAllowance(IERC20(bridgedTokenAddress), address(gateway), param.amount);
        gateway.sendToken(param.destinationChain, param.destinationAddress, param.bridgedTokenSymbol,param.amount);
        SafeERC20.safeApprove(IERC20(bridgedTokenAddress), address(gateway), 0);
        emit AxelarBridge(bridgedTokenAddress,param.amount,param.destinationChain,param.destinationAddress);
    }

    function _executeWithToken(
        string calldata,
        string calldata,
        bytes calldata payload,
        string calldata bridgedTokenSymbol,
        uint256 amount
    ) internal override {
        (bytes32 transactionId, bytes memory swap, bytes memory callDatas) = abi.decode(
            payload,
            (bytes32, bytes, bytes)
        );
        address bridgedTokenAddress = gateway.tokenAddresses(bridgedTokenSymbol);
        _swapAndCall(transactionId, bridgedTokenAddress, amount, swap, callDatas, recoverGas);
    }
}