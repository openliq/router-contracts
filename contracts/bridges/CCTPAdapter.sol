// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../lib/Helper.sol";
import "../lib/ErrorMessage.sol";
import "../abstract/RemoteSwapper.sol";

interface ITokenMessenger {
    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller
    ) external returns (uint64 nonce);
}

interface IMessageTransmitter {
    function sendMessageWithCaller(
        uint32 destinationDomain,
        bytes32 recipient,
        bytes32 destinationCaller,
        bytes calldata messageBody
    ) external returns (uint64);

    function receiveMessage(bytes calldata message, bytes calldata signature) external returns (bool success);
}

interface IMessageHandler {
    /**
     * @notice handles an incoming message from a Receiver
     * @param sourceDomain the source domain of the message
     * @param sender the sender of the message
     * @param messageBody The message raw bytes
     * @return success bool, true if successful
     */
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) external returns (bool);
}

// Be careful this contract contains unsafe call !.
// Do not approve token or just approve the right amount before call it.
// Clear approve in the same transaction if calling failed.
contract CCTPAdapter is RemoteSwapper, IMessageHandler {
    address public tokenMessenger;

    address public messageTransmitter;

    uint256 internal mintAmount;

    address internal mintToken;

    uint256 internal mintNonce;

    mapping(uint256 => bytes32) public remoteAdapters;

    event CCTPBridge(
        uint256 indexed _amount,
        uint32 indexed _destinationDomain,
        address indexed _burnToken,
        uint256 _burnNoce,
        uint256 _messageNonce,
        bytes32 _mintRecipient
    );

    constructor(address _owner, address _tokenMessenger, address _messageTransmitter) {
        tokenMessenger = _tokenMessenger;
        messageTransmitter = _messageTransmitter;
        _transferOwnership(_owner);
    }

    function setRemoteAdapter(uint256 _domain, bytes32 _adpater) external onlyOwner {
        remoteAdapters[_domain] = _adpater;
    }

    function setCCTP(address _tokenMessenger, address _messageTransmitter) external onlyOwner {
        tokenMessenger = _tokenMessenger;
        messageTransmitter = _messageTransmitter;
    }

    function bridge(
        uint256 _amount,
        uint32 _destinationDomain,
        bytes32 _mintRecipient,
        address _burnToken,
        bytes calldata _payload
    ) external {
        require(_amount > 0, "value_0");
        require(_mintRecipient != bytes32(""),"zero receiver");
        bytes32 caller = remoteAdapters[uint256(_destinationDomain)];
        require(caller != bytes32(""), "unsupported domain");
        SafeERC20.safeTransferFrom(IERC20(_burnToken), msg.sender, address(this), _amount);
        SafeERC20.safeIncreaseAllowance(IERC20(_burnToken), tokenMessenger, _amount);
        uint64 burnNonce = ITokenMessenger(tokenMessenger).depositForBurnWithCaller(
            _amount,
            _destinationDomain,
            _mintRecipient,
            _burnToken,
            caller
        );
        SafeERC20.safeApprove(IERC20(_burnToken), tokenMessenger, 0);
        uint64 messageNonce;
        if (_payload.length > 0) {
            messageNonce =  IMessageTransmitter(messageTransmitter).sendMessageWithCaller(
                _destinationDomain,
                caller,
                caller,
                abi.encode(burnNonce, _payload)
            );
        }
        emit CCTPBridge(_amount, _destinationDomain, _burnToken,uint256(burnNonce),uint256(messageNonce), _mintRecipient);
    }

    function onReceive(address _mintToken, bytes[2] calldata messages, bytes[2] calldata signatures) external {
        mintNonce = getNonce(messages[0]);
        mintToken = _mintToken;
        mintAmount = IERC20(mintToken).balanceOf(address(this));
        IMessageTransmitter(messageTransmitter).receiveMessage(messages[0], signatures[0]);
        mintAmount = IERC20(mintToken).balanceOf(address(this)) - mintAmount;
        if(messages[1].length != 0){
            IMessageTransmitter(messageTransmitter).receiveMessage(messages[1], signatures[1]);
        }
        mintAmount = 0;
        mintNonce = 0;
    }

    // onReceive -> messageTransmitter receiveMessage -> handleReceiveMessage
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) external override returns (bool) {
        require(remoteAdapters[uint256(sourceDomain)] == sender, "invalid sender");
        (uint64 compare, bytes memory swapAndCall) = abi.decode(messageBody, (uint64, bytes));
        require(mintNonce == compare, "invalid message pair");
        (bytes32 transactionId, bytes memory swap, bytes memory callDatas) = abi.decode(
            swapAndCall,
            (bytes32, bytes, bytes)
        );
        _swapAndCall(transactionId, mintToken, mintAmount, swap, callDatas, 0);
        return true;
    }

    function getNonce(bytes memory messages) public pure returns (uint256 result) {
        //12 + 32  nonce index is 12;
        assembly {
            // solium-disable-previous-line security/no-inline-assembly
            result := mload(add(messages, 44))
        }
        //uint64  256 - 64 = 192
        result = result >> 192;
    }
}
