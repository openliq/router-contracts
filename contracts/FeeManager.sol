// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interface/IFeeManager.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";

contract FeeManager is Ownable2Step, IFeeManager {
    uint256 constant FEE_DENOMINATOR = 10000;

    struct FeeInfo {
        address receiver;
        uint256 fixedNative;
        uint256 tokenFeeRate;
        uint256 routerShare; // router share
    }

    //FeeStruct public feeStruct;

    // Integrator -> IntegratorFeeInfo
    mapping(address => FeeInfo) public feeInfoList;

    event SetIntegratorFeeRate(
        address indexed integrator,
        address indexed receiver,
        uint256 fixedNative,
        uint256 tokenRate,
        uint256 routerShare
    );

    //event InitialFeeStruct(FeeStruct feeStruct);

    constructor(address _owner) payable {
        require(_owner != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);
        _transferOwnership(_owner);
    }

    function setRouterFee(
        address _receiver,
        uint256 _fixedNative,
        uint256 _tokenRate,
        uint256 _routerShare
    ) external onlyOwner {
        _setFeeRate(Helper.ZERO_ADDRESS, _receiver, _fixedNative, _tokenRate, _routerShare);
    }

    function setIntegratorFee(
        address _integrator,
        uint256 _fixedNative,
        uint256 _tokenRate,
        uint256 _routerShare
    ) external onlyOwner {
        require(_integrator != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);

        _setFeeRate(_integrator, _integrator, _fixedNative, _tokenRate, _routerShare);
    }

    function getFee(
        address _integrator,
        address _inputToken,
        uint256 _inputAmount,
        uint256 _feeRate
    ) external view returns (FeeDetail memory feeDetail) {
        feeDetail.feeToken = _inputToken;

        FeeInfo memory info = feeInfoList[_integrator];
        if (info.receiver == Helper.ZERO_ADDRESS) {
            info = feeInfoList[Helper.ZERO_ADDRESS];
            if (info.receiver == Helper.ZERO_ADDRESS) {
                return feeDetail;
            }
        }

        uint256 feeRate = _feeRate;
        uint256 routerRate = feeRate * info.routerShare;
        if (_feeRate < info.tokenFeeRate) {
            // keep the router fee rate
            routerRate = (info.tokenFeeRate * info.routerShare) / FEE_DENOMINATOR;
            if (_feeRate >= routerRate) {
                feeRate = _feeRate;
            } else {
                feeRate = routerRate;
            }
        }

        if (feeRate > 0) {
            uint256 fee = (_inputAmount * feeRate) / FEE_DENOMINATOR;
            feeDetail.routerToken = (_inputAmount * routerRate) / FEE_DENOMINATOR;
            feeDetail.integratorToken = fee - feeDetail.routerToken;
        }
        feeDetail.routerNative = info.fixedNative;
        feeDetail.routerReceiver = info.receiver;
    }

    function getAmountBeforeFee(
        address _integrator,
        address _inputToken,
        uint256 _inputAmount,
        uint256 _feeRate
    ) external view returns (address feeToken, uint256 beforeAmount) {
        require(_feeRate < FEE_DENOMINATOR);
        FeeInfo memory f = feeInfoList[Helper.ZERO_ADDRESS];
        FeeInfo memory info = feeInfoList[_integrator];
        feeToken = _inputToken;
        if (info.receiver == address(0)) {
            if (Helper._isNative(_inputToken)) {
                _inputAmount += f.fixedNative;
            }
            if (_integrator != Helper.ZERO_ADDRESS && _feeRate > 0) {
                if (f.fixedNative == 0) {
                    uint256 p = _feeRate + f.tokenFeeRate;
                    beforeAmount = (_inputAmount * FEE_DENOMINATOR) / (FEE_DENOMINATOR - p) + 1;
                } else {
                    if (f.tokenFeeRate * FEE_DENOMINATOR > _feeRate * f.routerShare) {
                        uint256 p = FEE_DENOMINATOR *
                            FEE_DENOMINATOR -
                            f.tokenFeeRate *
                            FEE_DENOMINATOR -
                            (FEE_DENOMINATOR - f.routerShare) *
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
                if (info.tokenFeeRate * FEE_DENOMINATOR > _feeRate * info.routerShare) {
                    uint256 p = FEE_DENOMINATOR *
                        FEE_DENOMINATOR -
                        info.tokenFeeRate *
                        FEE_DENOMINATOR -
                        (FEE_DENOMINATOR - info.routerShare) *
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

    function _setFeeRate(
        address integrator,
        address _receiver,
        uint256 _fixedNative,
        uint256 _tokenRate,
        uint256 _routerShare
    ) internal {
        require(_receiver != address(0), ErrorMessage.ZERO_ADDR);
        require(_tokenRate < FEE_DENOMINATOR, "FeeManager: invalid tokenFeeRate");
        require(_routerShare <= FEE_DENOMINATOR, "FeeManager: invalid  share");

        FeeInfo storage routerFee = feeInfoList[integrator];
        routerFee.receiver = _receiver;
        routerFee.fixedNative = _fixedNative;
        routerFee.tokenFeeRate = _tokenRate;
        routerFee.routerShare = _routerShare;

        emit SetIntegratorFeeRate(integrator, _receiver, _fixedNative, _tokenRate, _routerShare);
    }
}
