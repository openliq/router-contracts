// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interface/IFeeManager.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";

contract Router is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    address internal immutable wToken;
    IFeeManager public feeManager;
    uint256 internal nativeBalanceBeforeExec;

    mapping(address => bool) public approved;

    event Approve(address indexed executor, bool indexed flag);
    event SetFeeManager(address indexed _feeManager);
    event CollectFee(
        address indexed token,
        address indexed receiver,
        address indexed integrator,
        uint256 amount,
        uint256 nativeAmount,
        bytes32 transferId
    );

    // use to solve deep stack
    struct SwapTemp {
        address srcToken;
        address swapToken;
        uint256 srcAmount;
        uint256 swapAmount;
        bytes32 transferId;
        address receiver;
        address target;
        uint256 callAmount;
    }

    event SwapAndCall(
        address indexed from,
        address indexed receiver,
        address indexed target,
        bytes32 transferId,
        address originToken,
        address swapToken,
        uint256 originAmount,
        uint256 swapAmount,
        uint256 callAmount
    );

    modifier transferIn(
        address token,
        uint256 amount,
        bytes memory permitData
    ) {
        require(amount > 0, ErrorMessage.ZERO_IN);

        if (permitData.length > 0) {
            Helper._permit(permitData);
        }
        nativeBalanceBeforeExec = address(this).balance - msg.value;
        if (Helper._isNative(token)) {
            require(msg.value >= amount, ErrorMessage.FEE_MISMATCH);
        } else {
            SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        }

        _;

        nativeBalanceBeforeExec = 0;
    }

    constructor(address _owner, address _wToken) payable {
        require(_owner != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);
        require(_wToken.isContract(), ErrorMessage.NOT_CONTRACT);
        wToken = _wToken;
        _transferOwnership(_owner);
    }

    function setFeeManager(address _feeManager) public onlyOwner {
        require(_feeManager.isContract(), ErrorMessage.NOT_CONTRACT);
        feeManager = IFeeManager(_feeManager);
        emit SetFeeManager(_feeManager);
    }

    function swapAndCall(
        bytes32 _transferId,
        address _srcToken,
        uint256 _amount,
        address integrator,
        bytes calldata _swapData,
        bytes calldata _callbackData,
        bytes calldata _permitData
    ) external payable nonReentrant transferIn(_srcToken, _amount, _permitData) {
        SwapTemp memory swapTemp;
        swapTemp.srcToken = _srcToken;
        swapTemp.srcAmount = _amount;
        swapTemp.transferId = _transferId;
        require(_swapData.length + _callbackData.length > 0, ErrorMessage.DATA_EMPTY);

        swapTemp.swapAmount = _collectFee(swapTemp.srcToken, swapTemp.srcAmount, swapTemp.transferId, integrator);

        (swapTemp.receiver, swapTemp.target, swapTemp.swapToken, swapTemp.swapAmount, swapTemp.callAmount) = _doSwapAndCall(_swapData, _callbackData, swapTemp.srcToken, swapTemp.swapAmount);

        if (swapTemp.swapAmount > swapTemp.callAmount) {
            Helper._transfer(swapTemp.swapToken, swapTemp.receiver, (swapTemp.swapAmount - swapTemp.callAmount));
        }

        emit SwapAndCall(
            msg.sender,
            swapTemp.receiver,
            swapTemp.target,
            swapTemp.transferId,
            swapTemp.srcToken,
            swapTemp.swapToken,
            swapTemp.srcAmount,
            swapTemp.swapAmount,
            swapTemp.callAmount
        );
    }

    function getFee(
        address integrator,
        address inputToken,
        uint256 inputAmount
    ) external view returns (address feeToken, uint256 amount, uint256 nativeAmount) {
        return feeManager.getFee(integrator, inputToken, inputAmount);
    }

    function getAmountBeforeFee(
        address integrator,
        address inputToken,
        uint256 inputAmount
    ) external view returns (address feeToken, uint256 beforeAmount) {
        return feeManager.getAmountBeforeFee(integrator, inputToken, inputAmount);
    }

    function _doSwapAndCall(
        bytes memory _swapData,
        bytes memory _callbackData,
        address _srcToken,
        uint256 _amount
    ) internal returns (address receiver, address target, address dstToken, uint256 swapOutAmount, uint256 callAmount) {
        bool result;
        swapOutAmount = _amount;
        dstToken = _srcToken;
        if (_swapData.length > 0) {
            Helper.SwapParam memory swap = abi.decode(_swapData, (Helper.SwapParam));
            (result, dstToken, swapOutAmount) = _makeSwap(_amount, _srcToken, swap);
            require(result, ErrorMessage.SWAP_FAIL);
            require(swapOutAmount >= swap.minReturnAmount, ErrorMessage.RECEIVE_LOW);
            receiver = swap.receiver;
            target = swap.executor;
        }

        if (_callbackData.length > 0) {
            Helper.CallbackParam memory callParam = abi.decode(_callbackData, (Helper.CallbackParam));
            require(swapOutAmount >= callParam.amount, ErrorMessage.CALL_AMOUNT_INVALID);
            (result, callAmount) = _callBack(dstToken, callParam);
            require(result, ErrorMessage.CALL_FAIL);
            receiver = callParam.receiver;
            target = callParam.target;
        }
    }

    function _collectFee(
        address _token,
        uint256 _amount,
        bytes32 transferId,
        address integrator
    ) internal returns (uint256 _remain) {
        if (address(feeManager) == address(0)) return (_amount);

        address feeToken;
        uint256 _nativeFee;
        uint256 _fee;
        _remain = _amount;

        (feeToken, _fee, _nativeFee) = feeManager.getFee(integrator, _token, _amount);
        if (feeToken == _token && Helper._isNative(feeToken)) {
            require(msg.value >= _fee + _nativeFee, ErrorMessage.FEE_MISMATCH);
            _remain = _amount - _fee - _nativeFee;
        } else if (Helper._isNative(feeToken)) {
            require(msg.value >= _fee + _nativeFee, ErrorMessage.FEE_MISMATCH);
        } else if (feeToken == _token) {
            require(msg.value >= _nativeFee, ErrorMessage.FEE_MISMATCH);
            _remain = _amount - _fee;
        } else {
            require(msg.value >= _nativeFee, ErrorMessage.FEE_MISMATCH);
            if (_fee != 0) {
                SafeERC20.safeTransferFrom(IERC20(feeToken), msg.sender, address(this), _fee);
            }
        }
        if (_fee != 0 && !Helper._isNative(feeToken)) {
            SafeERC20.safeApprove(IERC20(_token), address(feeManager), _fee);
        }
        feeManager.payFeeWithIntegrator{value: _nativeFee}(integrator, _token, _amount);
        emit CollectFee(feeToken, address(feeManager), integrator, _fee, _nativeFee, transferId);
    }

    function _callBack(
        address _token,
        Helper.CallbackParam memory _callParam
    ) internal returns (bool _result, uint256 _callAmount) {
        require(approved[_callParam.target], ErrorMessage.NO_APPROVE);
        (_result, _callAmount) = Helper._callBack(_token, _callParam);
        require(address(this).balance >= nativeBalanceBeforeExec, ErrorMessage.NATIVE_VAULE_OVERSPEND);
    }

    function _makeSwap(
        uint256 _amount,
        address _srcToken,
        Helper.SwapParam memory _swap
    ) internal returns (bool _result, address _dstToken, uint256 _returnAmount) {
        require(approved[_swap.executor] || _swap.executor == wToken, ErrorMessage.NO_APPROVE);
        if (_swap.executor == wToken) {
            bytes4 sig = Helper._getFirst4Bytes(_swap.data);
            // 0x2e1a7d4d -> withdraw(uint256 wad)
            // 0xd0e30db0 -> deposit()
            if (sig != bytes4(0x2e1a7d4d) && sig != bytes4(0xd0e30db0)) {
                return (false, _srcToken, 0);
            }
        }
        (_result, _dstToken, _returnAmount) = Helper._makeSwap(_amount, _srcToken, _swap);
    }

    function setAuthorization(address[] calldata _executors, bool _flag) external onlyOwner {
        require(_executors.length > 0, ErrorMessage.DATA_EMPTY);
        for (uint i = 0; i < _executors.length; i++) {
            require(_executors[i].isContract(), ErrorMessage.NOT_CONTRACT);
            approved[_executors[i]] = _flag;
            emit Approve(_executors[i], _flag);
        }
    }

    function rescueFunds(address _token, uint256 _amount) external onlyOwner {
        Helper._transfer(_token, msg.sender, _amount);
    }

    receive() external payable {}
}
