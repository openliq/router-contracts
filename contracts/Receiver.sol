// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./abstract/RemoteSwapper.sol";
import "./interface/IMessageReceiverApp.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";

// Stargate deploy address https://stargateprotocol.gitbook.io/stargate/developers/contract-addresses/mainnet   -- router
// connext(Amarok) deploy address  https://docs.connext.network/resources/deployments  -- connext
// celer deploy address https://im-docs.celer.network/developer/contract-addresses-and-rpc-info -- MessageBus

contract Receiver is ReentrancyGuard, RemoteSwapper {
    using SafeERC20 for IERC20;
    using Address for address;

    uint256 public recoverGas = 100000;
    address public amarokRouter;
    address public sgRouter;
    address public cBridgeMessageBus;

    event StargateRouterSet(address indexed _router);
    event CBridgeMessageBusSet(address indexed _router);
    event AmarokRouterSet(address indexed _router);
    event RecoverGasSet(uint256 indexed _recoverGas);

    constructor(address _owner) {
        _transferOwnership(_owner);
    }

    function setStargateRouter(address _sgRouter) external onlyOwner {
        require(_sgRouter.isContract(), ErrorMessage.NOT_CONTRACT);
        sgRouter = _sgRouter;
        emit StargateRouterSet(_sgRouter);
    }

    function setAmarokRouter(address _amarokRouter) external onlyOwner {
        require(_amarokRouter.isContract(), ErrorMessage.NOT_CONTRACT);
        amarokRouter = _amarokRouter;
        emit AmarokRouterSet(_amarokRouter);
    }

    function setCBridgeMessageBus(address _messageBusAddress) external onlyOwner {
        require(_messageBusAddress.isContract(), ErrorMessage.NOT_CONTRACT);
        cBridgeMessageBus = _messageBusAddress;
        emit CBridgeMessageBusSet(_messageBusAddress);
    }

    /// @notice set execution recoverGas
    /// @param _recoverGas recoverGas
    function setRecoverGas(uint256 _recoverGas) external onlyOwner {
        recoverGas = _recoverGas;
        emit RecoverGasSet(_recoverGas);
    }

    /// @notice Completes a cross-chain transaction with calldata via Amarok facet on the receiving chain.
    /// @dev This function is called from Amarok Router.
    /// @param _transferId The unique ID of this transaction (assigned by Amarok)
    /// @param _amount the amount of bridged tokens
    /// @param _asset the address of the bridged token
    /// @param * (unused) the sender of the transaction
    /// @param * (unused) the domain ID of the src chain
    /// @param _callData The data to execute
    function xReceive(
        bytes32 _transferId,
        uint256 _amount,
        address _asset,
        address,
        uint32,
        bytes memory _callData
    ) external nonReentrant {
        require(msg.sender == amarokRouter, ErrorMessage.NO_APPROVE);
        (bytes32 transationId, bytes memory _swapData, bytes memory _callbackData) = abi.decode(
            _callData,
            (bytes32, bytes, bytes)
        );
        _swapAndCall(transationId, _asset, _amount, _swapData, _callbackData, recoverGas);
    }

    /// @notice Completes a cross-chain transaction on the receiving chain.
    /// @dev This function is called from Stargate Router.
    /// @param * (unused) The remote chainId sending the tokens
    /// @param * (unused) The remote Bridge address
    /// @param * (unused) Nonce
    /// @param * (unused) The token contract on the local chain
    /// @param _amountLD The amount of tokens received through bridging
    /// @param _payload The data to execute
    function sgReceive(
        uint16, // _srcChainId unused
        bytes memory, // _srcAddress unused
        uint256, // _nonce unused
        address _token,
        uint256 _amountLD,
        bytes memory _payload
    ) external nonReentrant {
        require(msg.sender == sgRouter, ErrorMessage.NO_APPROVE);
        (bytes32 transationId, bytes memory _swapData, bytes memory _callbackData) = abi.decode(
            _payload,
            (bytes32, bytes, bytes)
        );
        _swapAndCall(transationId, _token, _amountLD, _swapData, _callbackData, recoverGas);
    }

    /**
     * @notice Called by MessageBus to execute a message with an associated token transfer.
     * The Receiver is guaranteed to have received the right amount of tokens before this function is called.
     * @param * (unused) The address of the source app contract
     * @param _token The address of the token that comes out of the bridge
     * @param _amount The amount of tokens received at this contract through the cross-chain bridge.
     * @param * (unused)  The source chain ID where the transfer is originated from
     * @param _message Arbitrary message bytes originated from and encoded by the source app contract
     * @param * (unused)  Address who called the MessageBus execution function
     */
    function executeMessageWithTransfer(
        address,
        address _token,
        uint256 _amount,
        uint64,
        bytes calldata _message,
        address
    ) external payable nonReentrant returns (IMessageReceiverApp.ExecutionStatus) {
        require(msg.sender == cBridgeMessageBus, ErrorMessage.NO_APPROVE);
        // decode message
        (bytes32 transactionId, bytes memory _swapData, bytes memory _callbackData) = abi.decode(
            _message,
            (bytes32, bytes, bytes)
        );
        _swapAndCall(transactionId, _token, _amount, _swapData, _callbackData, recoverGas);
        return IMessageReceiverApp.ExecutionStatus.Success;
    }

    /**
     * @notice Called by MessageBus to process refund of the original transfer from this contract.
     * The contract is guaranteed to have received the refund before this function is called.
     * @param _token The token address of the original transfer
     * @param _amount The amount of the original transfer
     * @param _message The same message associated with the original transfer
     * @param * (unused) Address who called the MessageBus execution function
     */
    function executeMessageWithTransferRefund(
        address _token,
        uint256 _amount,
        bytes calldata _message,
        address
    ) external payable nonReentrant returns (IMessageReceiverApp.ExecutionStatus) {
        require(msg.sender == cBridgeMessageBus, ErrorMessage.NO_APPROVE);
        (bytes32 transactionId, bytes memory _swapData, bytes memory _callbackData) = abi.decode(
            _message,
            (bytes32, bytes, bytes)
        );
        address receiver;
        if (_swapData.length > 0) {
            Helper.SwapParam memory swap = abi.decode(_swapData, (Helper.SwapParam));
            receiver = swap.receiver;
        } else {
            Helper.CallbackParam memory callParam = abi.decode(_callbackData, (Helper.CallbackParam));
            receiver = callParam.receiver;
        }
        // return funds to cBridgeData.refundAddress
        Helper._transfer(_token, receiver, _amount);
        return IMessageReceiverApp.ExecutionStatus.Success;
    }

    function rescueFunds(address _token, uint256 _amount) external onlyOwner {
        Helper._transfer(_token, msg.sender, _amount);
    }

    receive() external payable {}
}
