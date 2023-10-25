// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IFeeManager {
    function getFee(
        address integrator,
        address inputToken,
        uint256 inputAmount
    ) external view returns (address feeToken, uint256 amount, uint256 nativeAmount);

    function getAmountBeforeFee(
        address integrator,
        address inputToken,
        uint256 inputAmount
    ) external view returns (address feeToken, uint256 beforeAmount);

    function payFeeWithIntegrator(address integrator, address inputToken, uint256 inputAmount) external payable;
}
