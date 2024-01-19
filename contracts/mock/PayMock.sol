// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PayMock {
    event Pay(uint256 amount);

    function payFor(address) external payable {
        emit Pay(msg.value);
    }

    function mockTransfer(address token,address to,uint256 amount) external {
          SafeERC20.safeTransferFrom(IERC20(token),msg.sender,to,amount);
    }
}
