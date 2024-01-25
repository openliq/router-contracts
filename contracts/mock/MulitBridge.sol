// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
interface ICCTP {
    function bridge(
        uint256 _amount,
        uint32 _destinationDomain,
        bytes32 _mintRecipient,
        address _burnToken,
        bytes calldata _payload
    ) external;
}

contract MulitBridge {
         
        struct BridgeParam {
            uint256 amount;
            uint32 destinationDomain;
            bytes32 mintRecipient;
            address burnToken;
            bytes  payload;
        }

       function mulitBridge(address adpat,BridgeParam[] calldata p) external {
            for (uint i = 0; i < p.length; i++) {
                BridgeParam memory bp = p[i];
                SafeERC20.safeTransferFrom(IERC20(bp.burnToken),msg.sender,address(this),bp.amount);    
                SafeERC20.forceApprove(IERC20(bp.burnToken),adpat,bp.amount); 
                ICCTP(adpat).bridge(bp.amount,bp.destinationDomain,bp.mintRecipient,bp.burnToken,bp.payload);   
            }
       }  
}