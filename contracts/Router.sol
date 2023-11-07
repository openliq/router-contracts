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
        uint256 openliqAmount,
        uint256 integratorAmount,
        uint256 nativeAmount,
        uint256 integratorNative,
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
        bytes calldata _swapData,
        bytes calldata _callbackData,
        bytes calldata _permitData,
        address _referrer,
        uint256 _fee
    ) external payable nonReentrant transferIn(_srcToken, _amount, _permitData) {
        SwapTemp memory swapTemp;
        swapTemp.srcToken = _srcToken;
        swapTemp.srcAmount = _amount;
        swapTemp.transferId = _transferId;
        require(_swapData.length + _callbackData.length > 0, ErrorMessage.DATA_EMPTY);
        swapTemp.swapAmount = _collectFee(swapTemp.srcToken, swapTemp.srcAmount, swapTemp.transferId, _referrer, _fee);
        (
            swapTemp.receiver,
            swapTemp.target,
            swapTemp.swapToken,
            swapTemp.swapAmount,
            swapTemp.callAmount
        ) = _doSwapAndCall(_swapData, _callbackData, swapTemp.srcToken, swapTemp.swapAmount);

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
        address inputToken,
        uint256 inputAmount,
        address referrer,
        uint256 fee
    ) external view returns (address feeToken, uint256 amount, uint256 nativeAmount) {
        if (address(feeManager) == Helper.ZERO_ADDRESS) return (Helper.ZERO_ADDRESS,0,0);
        IFeeManager.FeeDetail memory fd = feeManager.getFee(referrer, inputToken, inputAmount, fee);
        feeToken = fd.feeToken;
        if (Helper._isNative(inputToken)) {
            amount = 0;
            nativeAmount = fd.routerNative + fd.routerToken + fd.integratorToken + fd.integratorNative;
        } else {
            amount = fd.routerToken + fd.integratorToken;
            nativeAmount = fd.routerNative + fd.integratorNative;
        }
    }

    function getAmountBeforeFee(
        address inputToken,
        uint256 inputAmount,
        address referrer,
        uint256 fee
    ) external view returns (address feeToken, uint256 beforeAmount) {
        if (address(feeManager) == Helper.ZERO_ADDRESS) return (Helper.ZERO_ADDRESS,0);
        return feeManager.getAmountBeforeFee(referrer, inputToken, inputAmount, fee);
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
        bytes32 _transferId,
        address _referrer,
        uint256 _fee
    ) internal returns (uint256 _remain) {
        // _token == fd.feeToken
        if (address(feeManager) == Helper.ZERO_ADDRESS) return (_amount);
        IFeeManager.FeeDetail memory fd = feeManager.getFee(_referrer, _token, _amount, _fee);
        if (Helper._isNative(_token)) {
            uint256 openliqNative = fd.routerNative + fd.routerToken;
            if (openliqNative > 0) {
                Helper._transfer(_token, fd.routerReceiver, openliqNative);
            }
            uint256 integratorNative = fd.integratorToken + fd.integratorNative;
            if (fd.integratorToken > 0) {
                Helper._transfer(_token, _referrer, integratorNative);
            }
            _remain = _amount - openliqNative - integratorNative;
        } else {
            if (fd.routerNative > 0) {
                Helper._transfer(Helper.ZERO_ADDRESS, fd.routerReceiver, fd.routerNative);
            }
            if (fd.routerToken > 0) {
                Helper._transfer(_token, fd.routerReceiver, fd.routerToken);
            }
            if (fd.integratorNative > 0) {
                Helper._transfer(Helper.ZERO_ADDRESS, _referrer, fd.integratorNative);
            }
            if (fd.integratorToken > 0) {
                Helper._transfer(_token, _referrer, fd.integratorToken);
            }
            _remain = _amount - fd.routerToken - fd.integratorToken;
        }
        emit CollectFee(
            _token,
            fd.routerReceiver,
            _referrer,
            fd.routerToken,
            fd.routerToken,
            fd.routerNative,
            fd.integratorNative,
            _transferId
        );
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
