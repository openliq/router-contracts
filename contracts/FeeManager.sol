// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interface/IFeeManager.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";

contract FeeManager is Ownable2Step, IFeeManager {
    uint256 constant FEE_DENOMINATOR = 10000;

    struct IntegratorFeeInfo {
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
    mapping(address => IntegratorFeeInfo) public integratorToFeeInfo;

    event SetIntegratorFees(address integrator, IntegratorFeeInfo fee);
    event InitialFeeStruct(FeeStruct _feeStruct);

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

    function setIntegratorFees(address integrator, IntegratorFeeInfo calldata fees) external onlyOwner {
        require(
            integrator != Helper.ZERO_ADDRESS && fees.openliqReceiver != Helper.ZERO_ADDRESS,
            ErrorMessage.ZERO_ADDR
        );
        require(fees.tokenFeeRate < FEE_DENOMINATOR, "FeeManager: invalid integrator tokenFeeRate");
        require(fees.share <= FEE_DENOMINATOR, "FeeManager: invalid integrator share");
        integratorToFeeInfo[integrator] = fees;
        emit SetIntegratorFees(integrator, fees);
    }

    function getFee(
        address integrator,
        address inputToken,
        uint256 inputAmount,
        uint256 feeP
    ) external view returns (FeeDetail memory returnFee) {
        require(feeP < FEE_DENOMINATOR);
        FeeStruct memory f = feeStruct;
        IntegratorFeeInfo memory info = integratorToFeeInfo[integrator];
        returnFee.feeToken = inputToken;
        if (info.openliqReceiver == address(0)) {
            if (integrator != Helper.ZERO_ADDRESS && feeP > 0) {
                uint256 fee = (inputAmount * feeP) / FEE_DENOMINATOR;
                returnFee.openLiqToken = (fee * f.share) / FEE_DENOMINATOR;
                returnFee.integratorToken = fee - returnFee.openLiqToken;
            }
            returnFee.openliqNative = f.fixedNative;
            if (f.tokenFeeRate > 0) {
                uint256 tokenFee = (inputAmount * f.tokenFeeRate) / FEE_DENOMINATOR;
                if (f.fixedNative == 0) {
                    returnFee.openLiqToken += tokenFee;
                } else {
                    if (tokenFee > returnFee.integratorToken) {
                        returnFee.openLiqToken = tokenFee;
                    }
                }
            }
            returnFee.openliqReceiver = f.receiver;
        } else {
            if (integrator != Helper.ZERO_ADDRESS && feeP > 0) {
                uint256 fee = (inputAmount * feeP) / FEE_DENOMINATOR;
                returnFee.openLiqToken = (fee * info.share) / FEE_DENOMINATOR;
                returnFee.integratorToken = fee - returnFee.openLiqToken;
            }
            returnFee.openliqNative = info.fixedNative;
            if (info.tokenFeeRate > 0) {
                uint256 tokenFee = (inputAmount * info.tokenFeeRate) / FEE_DENOMINATOR;
                if (tokenFee > returnFee.openLiqToken) {
                    returnFee.openLiqToken = tokenFee;
                }
            }
            returnFee.openliqReceiver = info.openliqReceiver;
        }
    }

    function getAmountBeforeFee(
        address integrator,
        address inputToken,
        uint256 inputAmount,
        uint256 feeP
    ) external view returns (address feeToken, uint256 beforeAmount) {
        require(feeP < FEE_DENOMINATOR);
        FeeStruct memory f = feeStruct;
        IntegratorFeeInfo memory info = integratorToFeeInfo[integrator];
        feeToken = inputToken;
        if (info.openliqReceiver == address(0)) {
            if (Helper._isNative(inputToken)) {
                inputAmount += f.fixedNative;
            }
            if (integrator != Helper.ZERO_ADDRESS && feeP > 0) {
                if (f.fixedNative == 0) {
                    uint256 p = feeP + f.tokenFeeRate;
                    beforeAmount = (inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - p) + 1;
                } else {
                    if (f.tokenFeeRate * FEE_DENOMINATOR > feeP * f.share) {
                        uint256 p = FEE_DENOMINATOR *
                            FEE_DENOMINATOR -
                            f.tokenFeeRate *
                            FEE_DENOMINATOR -
                            (FEE_DENOMINATOR - f.share) *
                            feeP;
                        beforeAmount = (inputAmount * FEE_DENOMINATOR * FEE_DENOMINATOR) / p + 1;
                    } else {
                        beforeAmount = (inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - feeP) + 1;
                    }
                }
            } else {
                if (f.tokenFeeRate > 0) {
                    beforeAmount = (inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - f.tokenFeeRate) + 1;
                } else {
                    beforeAmount = inputAmount;
                }
            }
        } else {
            if (Helper._isNative(inputToken)) {
                inputAmount += f.fixedNative;
            }
            if (integrator != Helper.ZERO_ADDRESS && feeP > 0) {
                if (info.tokenFeeRate * FEE_DENOMINATOR > feeP * info.share) {
                    uint256 p = FEE_DENOMINATOR *
                        FEE_DENOMINATOR -
                        info.tokenFeeRate *
                        FEE_DENOMINATOR -
                        (FEE_DENOMINATOR - info.share) *
                        feeP;
                    beforeAmount += (inputAmount * FEE_DENOMINATOR * FEE_DENOMINATOR) / p + 1;
                } else {
                    beforeAmount = (inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - feeP) + 1;
                }
            } else {
                if (info.tokenFeeRate > 0) {
                    beforeAmount = (inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - info.tokenFeeRate) + 1;
                } else {
                    beforeAmount = inputAmount;
                }
            }
        }
    }
}
