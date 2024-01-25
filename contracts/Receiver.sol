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


contract Receiver is ReentrancyGuard, RemoteSwapper {
    using SafeERC20 for IERC20;
    using Address for address;

    uint256 public recoverGas = 100000;
    address public amarokRouter;
    address public sgRouter;
    address public butterMos;

    event StargateRouterSet(address indexed _router);
    event ButterMosSet(address indexed _router);
    event AmarokRouterSet(address indexed _butterMos);
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

    function setButterMos(address _butterMos) external onlyOwner {
        require(_butterMos.isContract(), ErrorMessage.NOT_CONTRACT);
        butterMos = _butterMos;
        emit ButterMosSet(_butterMos);
    }

    /// @notice set execution recoverGas
    /// @param _recoverGas recoverGas
    function setRecoverGas(uint256 _recoverGas) external onlyOwner {
        recoverGas = _recoverGas;
        emit RecoverGasSet(_recoverGas);
    }

    /// @notice Completes a cross-chain transaction with calldata via Amarok facet on the receiving chain.
    /// @dev This function is called from Amarok Router.
    /// @param * (unused) The unique ID of this transaction (assigned by Amarok)
    /// @param _amount the amount of bridged tokens
    /// @param _asset the address of the bridged token
    /// @param * (unused) the sender of the transaction
    /// @param * (unused) the domain ID of the src chain
    /// @param _callData The data to execute
    function xReceive(
        bytes32,
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
    
    // called by butter mos
    function onReceived(
        bytes32,
        address _srcToken,
        uint256 _amount,
        uint256,
        bytes calldata,
        bytes calldata _payload
    ) external {
        require(msg.sender == butterMos, ErrorMessage.NO_APPROVE);
        (bytes32 transationId,bytes memory _swapData, bytes memory _callbackData) = abi.decode(_payload, (bytes32,bytes, bytes));
        _swapAndCall(transationId, _srcToken, _amount, _swapData, _callbackData, recoverGas);
    }


    function rescueFunds(address _token, uint256 _amount) external onlyOwner {
        Helper._transfer(_token, msg.sender, _amount);
    }

    receive() external payable {}
}
