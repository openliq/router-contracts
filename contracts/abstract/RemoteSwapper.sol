// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../lib/Helper.sol";
import "../lib/ErrorMessage.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract RemoteSwapper is Ownable2Step {
    mapping(bytes4 => bool) blackList;

    // use to solve deep stack
    struct Temp {
        bytes32 transactionId;
        address swapToken;
        uint256 srcAmount;
        uint256 swapAmount;
        address receiver;
        address target;
        uint256 callAmount;
    }
    event SwapAndCall(
        address indexed from,
        address indexed receiver,
        address indexed target,
        bytes32 transactionId,
        address originToken,
        address swapToken,
        uint256 originAmount,
        uint256 swapAmount,
        uint256 callAmount
    );

    event EditBackList(bytes4 _func, bool flag);

    constructor() {
        //| a9059cbb | transfer(address,uint256)
        blackList[bytes4(0xa9059cbb)] = true;
        //| 095ea7b3 | approve(address,uint256) |
        blackList[bytes4(0x095ea7b3)] = true;
        //| 23b872dd | transferFrom(address,address,uint256) |
        blackList[bytes4(0x23b872dd)] = true;
        //| 39509351 | increaseAllowance(address,uint256)
        blackList[bytes4(0x39509351)] = true;
        //| a22cb465 | setApprovalForAll(address,bool) |
        blackList[bytes4(0xa22cb465)] = true;
        //| 42842e0e | safeTransferFrom(address,address,uint256) |
        blackList[bytes4(0x42842e0e)] = true;
        //| b88d4fde | safeTransferFrom(address,address,uint256,bytes) |
        blackList[bytes4(0xb88d4fde)] = true;
        //| 9bd9bbc6 | send(address,uint256,bytes) |
        blackList[bytes4(0x9bd9bbc6)] = true;
        //| fe9d9303 | burn(uint256,bytes) |
        blackList[bytes4(0xfe9d9303)] = true;
        //| 959b8c3f | authorizeOperator
        blackList[bytes4(0x959b8c3f)] = true;
        //| f242432a | safeTransferFrom(address,address,uint256,uint256,bytes) |
        blackList[bytes4(0xf242432a)] = true;
        //| 2eb2c2d6 | safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) |
        blackList[bytes4(0x2eb2c2d6)] = true;
    }

    function editBackList(bytes4 _func, bool _flag) external onlyOwner {
        blackList[_func] = _flag;
        emit EditBackList(_func, _flag);
    }

    function _swapAndCall(
        bytes32 _transactionId,
        address _srcToken,
        uint256 _amount,
        bytes memory _swapData,
        bytes memory _callbackData,
        uint256 recoverGas
    ) internal {
        Temp memory temp;
        temp.srcAmount = _amount;
        temp.swapToken = _srcToken;
        temp.swapAmount = _amount;
        temp.transactionId = _transactionId;
        uint256 balance = Helper._getBalance(_srcToken, address(this));
        require(balance >= _amount, "balance low");
        bool result = true;
        uint256 srcTokenBalanceBefore = balance - _amount;
        if (_swapData.length > 0) {
            Helper.SwapParam memory swap = abi.decode(_swapData, (Helper.SwapParam));
            temp.receiver = swap.receiver;
            if (gasleft() > recoverGas) {
                try this.doRemoteSwap{gas: gasleft() - recoverGas}(swap, _srcToken, temp.srcAmount) returns (
                    address target,
                    address dstToken,
                    uint256 dstAmount
                ) {
                    temp.swapToken = dstToken;
                    temp.target = target;
                    temp.swapAmount = dstAmount;
                } catch {
                    result = false;
                }
                temp.target = swap.executor;
            }
        }
        if (_callbackData.length > 0) {
            Helper.CallbackParam memory callParam = abi.decode(_callbackData, (Helper.CallbackParam));
            if (temp.receiver == address(0)) {
                temp.receiver = callParam.receiver;
            }
            if (result && gasleft() > recoverGas) {
                try this.doRemoteCall{gas: gasleft() - recoverGas}(callParam, temp.swapToken, temp.swapAmount) returns (
                    address target,
                    uint256 callAmount
                ) {
                    temp.target = target;
                    temp.callAmount = callAmount;
                    temp.receiver = callParam.receiver;
                } catch {}
            }
        }
        if (temp.swapAmount > temp.callAmount) {
            Helper._transfer(temp.swapToken, temp.receiver, (temp.swapAmount - temp.callAmount));
        }
        balance = Helper._getBalance(_srcToken, address(this));
        if (balance > srcTokenBalanceBefore) {
            Helper._transfer(_srcToken, temp.receiver, (balance - srcTokenBalanceBefore));
        }
        emit SwapAndCall(
            msg.sender,
            temp.receiver,
            temp.target,
            temp.transactionId,
            _srcToken,
            temp.swapToken,
            temp.srcAmount,
            temp.swapAmount,
            temp.callAmount
        );
    }

    function doRemoteSwap(
        Helper.SwapParam memory _swap,
        address _srcToken,
        uint256 _amount
    ) external returns (address target, address dstToken, uint256 dstAmount) {
        require(msg.sender == address(this));
        bool result;
        (result, dstToken, dstAmount) = _makeSwap(_amount, _srcToken, _swap);
        require(result, ErrorMessage.SWAP_FAIL);
        require(dstAmount >= _swap.minReturnAmount, ErrorMessage.RECEIVE_LOW);
        target = _swap.executor;
    }

    function doRemoteCall(
        Helper.CallbackParam memory _callParam,
        address _callToken,
        uint256 _amount
    ) external returns (address target, uint256 callAmount) {
        require(msg.sender == address(this));
        require(_amount >= _callParam.amount, ErrorMessage.CALL_AMOUNT_INVALID);
        bool result;
        (result, callAmount) = _callBack(_callToken, _callParam);
        require(result, ErrorMessage.CALL_FAIL);
        target = _callParam.target;
    }

    function _makeSwap(
        uint256 _amount,
        address _srcToken,
        Helper.SwapParam memory _swap
    ) internal returns (bool _result, address _dstToken, uint256 _returnAmount) {
        require(_checkCallFunction(_swap.data), "backList");
        (_result, _dstToken, _returnAmount) = Helper._makeSwap(_amount, _srcToken, _swap);
    }

    function _callBack(
        address _token,
        Helper.CallbackParam memory _callParam
    ) internal returns (bool _result, uint256 _callAmount) {
        require(_checkCallFunction(_callParam.data), "backList");
        (_result, _callAmount) = Helper._callBack(_token, _callParam);
    }

    function _checkCallFunction(bytes memory callDatas) internal view returns (bool) {
        if (callDatas.length < 4) {
            return false;
        }
        bytes4 _func = Helper._getFirst4Bytes(callDatas);
        if (blackList[_func]) {
            return false;
        }
        return true;
    }
}
