// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interface/IFeeManager.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";

contract FeeManager is Ownable2Step, IFeeManager {
    uint256 constant FEE_DENOMINATOR = 10000;

    struct FeeInfo {
        address openliqReceiver;
        uint256 fixedNative;
        uint256 tokenFeeRate;
        uint256 share;
    }

    struct FeeStruct {
        address receiver;
        uint256 tokenFeeRate;
        uint256 fixedNative;
        uint256 share;
    }

    FeeStruct public feeStruct;

    // Integrator -> IntegratorFeeInfo
    mapping(address => FeeInfo) public feeInfoList;

    event SetIntegratorFees(address integrator, FeeInfo fee);
    event InitialFeeStruct(FeeStruct feeStruct);

    constructor(address _owner) payable {
        require(_owner != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);
        _transferOwnership(_owner);
    }

    function initialFeeStruct(FeeStruct calldata _feeStruct) external onlyOwner {
        require(_feeStruct.receiver != address(0), ErrorMessage.ZERO_ADDR);
        require(_feeStruct.tokenFeeRate < FEE_DENOMINATOR, "FeeManager: invalid tokenFeeRate");
        require(_feeStruct.share <= FEE_DENOMINATOR, "FeeManager: invalid  share");
        feeStruct = _feeStruct;
        emit InitialFeeStruct(_feeStruct);
    }

    function setIntegratorFee(address _integrator, FeeInfo calldata _feeInfo) external onlyOwner {
        require(
            _integrator != Helper.ZERO_ADDRESS && _feeInfo.openliqReceiver != Helper.ZERO_ADDRESS,
            ErrorMessage.ZERO_ADDR
        );
        require(_feeInfo.tokenFeeRate < FEE_DENOMINATOR, "FeeManager: invalid integrator tokenFeeRate");
        require(_feeInfo.share <= FEE_DENOMINATOR, "FeeManager: invalid integrator share");
        feeInfoList[_integrator] = _feeInfo;
        emit SetIntegratorFees(_integrator, _feeInfo);
    }

    function getFee(
        address _integrator,
        address _inputToken,
        uint256 _inputAmount,
        uint256 _feeRate
    ) external view returns (FeeDetail memory feeDetail) {
        require(_feeRate < FEE_DENOMINATOR);
        FeeStruct memory f = feeStruct;
        FeeInfo memory info = feeInfoList[_integrator];
        feeDetail.feeToken = _inputToken;
        if (info.openliqReceiver == Helper.ZERO_ADDRESS) {
            if (_integrator != Helper.ZERO_ADDRESS && _feeRate > 0) {
                uint256 fee = (_inputAmount * _feeRate) / FEE_DENOMINATOR;
                feeDetail.openLiqToken = (fee * f.share) / FEE_DENOMINATOR;
                feeDetail.integratorToken = fee - feeDetail.openLiqToken;
            }
            feeDetail.openliqNative = f.fixedNative;
            if (f.tokenFeeRate > 0) {
                uint256 tokenFee = (_inputAmount * f.tokenFeeRate) / FEE_DENOMINATOR;
                if (f.fixedNative == 0) {
                    feeDetail.openLiqToken += tokenFee;
                } else {
                    if (tokenFee > feeDetail.integratorToken) {
                        feeDetail.openLiqToken = tokenFee;
                    }
                }
            }
            feeDetail.openliqReceiver = f.receiver;
        } else {
            if (_integrator != Helper.ZERO_ADDRESS && _feeRate > 0) {
                uint256 fee = (_inputAmount * _feeRate) / FEE_DENOMINATOR;
                feeDetail.openLiqToken = (fee * info.share) / FEE_DENOMINATOR;
                feeDetail.integratorToken = fee - feeDetail.openLiqToken;
            }
            feeDetail.openliqNative = info.fixedNative;
            if (info.tokenFeeRate > 0) {
                uint256 tokenFee = (_inputAmount * info.tokenFeeRate) / FEE_DENOMINATOR;
                if (tokenFee > feeDetail.openLiqToken) {
                    feeDetail.openLiqToken = tokenFee;
                }
            }
            feeDetail.openliqReceiver = info.openliqReceiver;
        }
    }

    function getAmountBeforeFee(
        address _integrator,
        address _inputToken,
        uint256 _inputAmount,
        uint256 _feeRate
    ) external view returns (address feeToken, uint256 beforeAmount) {
        require(_feeRate < FEE_DENOMINATOR);
        FeeStruct memory f = feeStruct;
        FeeInfo memory info = feeInfoList[_integrator];
        feeToken = _inputToken;
        if (info.openliqReceiver == address(0)) {
            if (Helper._isNative(_inputToken)) {
                _inputAmount += f.fixedNative;
            }
            if (_integrator != Helper.ZERO_ADDRESS && _feeRate > 0) {
                if (f.fixedNative == 0) {
                    uint256 p = _feeRate + f.tokenFeeRate;
                    beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - p) + 1;
                } else {
                    if (f.tokenFeeRate * FEE_DENOMINATOR > _feeRate * f.share) {
                        uint256 p = FEE_DENOMINATOR *
                            FEE_DENOMINATOR -
                            f.tokenFeeRate *
                            FEE_DENOMINATOR -
                            (FEE_DENOMINATOR - f.share) *
                            _feeRate;
                        beforeAmount = (_inputAmount * FEE_DENOMINATOR * FEE_DENOMINATOR) / p + 1;
                    } else {
                        beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - _feeRate) + 1;
                    }
                }
            } else {
                if (f.tokenFeeRate > 0) {
                    beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - f.tokenFeeRate) + 1;
                } else {
                    beforeAmount = _inputAmount;
                }
            }
        } else {
            if (Helper._isNative(_inputToken)) {
                _inputAmount += f.fixedNative;
            }
            if (_integrator != Helper.ZERO_ADDRESS && _feeRate > 0) {
                if (info.tokenFeeRate * FEE_DENOMINATOR > _feeRate * info.share) {
                    uint256 p = FEE_DENOMINATOR *
                        FEE_DENOMINATOR -
                        info.tokenFeeRate *
                        FEE_DENOMINATOR -
                        (FEE_DENOMINATOR - info.share) *
                        _feeRate;
                    beforeAmount += (_inputAmount * FEE_DENOMINATOR * FEE_DENOMINATOR) / p + 1;
                } else {
                    beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - _feeRate) + 1;
                }
            } else {
                if (info.tokenFeeRate > 0) {
                    beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - info.tokenFeeRate) + 1;
                } else {
                    beforeAmount = _inputAmount;
                }
            }
        }
    }
}
