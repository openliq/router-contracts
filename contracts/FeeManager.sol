// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interface/IFeeManager.sol";
import "./lib/ErrorMessage.sol";
import "./lib/Helper.sol";


contract FeeManager is Ownable2Step,IFeeManager{
   
   uint256 constant FEE_DENOMINATOR = 10000;

    enum FeeType {
        NULL,
        FIXED,
        RATIO
    }

    struct IntegratorFeeInfo {
        FeeType feeType; 
        uint32 platformTokenShare;
        uint32 platformNativeShare; 
        uint80 tokenFee;  //fixed input token amount or ratio of input token amount 
        uint96 fixedNativeAmount;
    }

   struct FeeStruct{
       FeeType feeType;
       uint256 platformTokenFee;    //fixed input token amount or ratio of input token amount 
       uint256 fixedPlatformNativeFee;
       mapping(address => IntegratorFeeInfo) integratorToFeeInfo;
   }

   FeeStruct public feeStruct;
    // Integrator -> TokenAddress -> Balance
    mapping(address => mapping(address => uint256)) private _balances;
    // TokenAddress -> Balance
    mapping(address => uint256) private _platformBalances;

    
    event SetIntegratorFees(address integrator,IntegratorFeeInfo fee);
    event FeesWithdrawn(address indexed _token,address indexed _to,uint256 _amount);
    event InitialFeeStruct(FeeType feeType,uint256 fixedPlatformNativeFee,uint256 platformTokenFee);
    event PlatformFeesWithdrawn(address indexed _token,address indexed _to,uint256 _amount);
    event FeesCollected(address indexed _token,address indexed _integrator,uint256 _platformNative,uint256 platformToken,uint256 _integratorNative,uint256 _integratorToken);

    constructor(address _owner) payable {
        require(_owner != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);
        _transferOwnership(_owner);
    }


    function initialFeeStruct(FeeType feeType,uint256 fixedPlatformNativeFee,uint256 platformTokenFee)external onlyOwner{
         if(feeType == FeeType.RATIO) {
            require(platformTokenFee < FEE_DENOMINATOR,"invalid platformTokenFee");
         }
        feeStruct.feeType = feeType;
        feeStruct.fixedPlatformNativeFee = fixedPlatformNativeFee;
        feeStruct.platformTokenFee = platformTokenFee;
        emit InitialFeeStruct(feeType,fixedPlatformNativeFee,platformTokenFee);
    }
    

    function setIntegratorFees(address integrator,IntegratorFeeInfo calldata fees) external onlyOwner {
        require(integrator != Helper.ZERO_ADDRESS, ErrorMessage.ZERO_ADDR);
        require( fees.platformTokenShare < FEE_DENOMINATOR,"invalid platformTokenShare");
        require(fees.platformNativeShare < FEE_DENOMINATOR,"invalid platformNativeShare");
        if(fees.feeType == FeeType.RATIO){
             require(fees.tokenFee < FEE_DENOMINATOR,"invalid tokenFee");
        }
        feeStruct.integratorToFeeInfo[integrator] =  fees;
        emit SetIntegratorFees(integrator,fees);
    }

    function payFeeWithIntegrator(address integrator, address inpputToken,uint256 inputAmount) external payable override {
       (address feeToken,uint256 amount,uint256 nativeAmount) = _getFee(integrator,inpputToken,inputAmount);
       require(msg.value >= nativeAmount,"native fee mismatch");

       if(!Helper._isNative(feeToken) && amount > 0){
            SafeERC20.safeTransferFrom(
                IERC20(feeToken),
                msg.sender,
                address(this),
                amount
            );
       }

       IntegratorFeeInfo storage f =  feeStruct.integratorToFeeInfo[integrator];
       if(f.feeType == FeeType.NULL){

            _platformBalances[Helper.NATIVE_ADDRESS] += nativeAmount;
            if(!Helper._isNative(feeToken) && amount > 0){
                _platformBalances[feeToken] += amount;
            } 
            emit FeesCollected(integrator,feeToken,nativeAmount,amount,0,0);

       } else {

            uint256 platformNative = nativeAmount * f.platformNativeShare / FEE_DENOMINATOR;
            if(platformNative != 0) _platformBalances[Helper.NATIVE_ADDRESS] += platformNative;
            uint256 integratorNative = nativeAmount - platformNative;
            if(integratorNative != 0) _balances[integrator][Helper.NATIVE_ADDRESS] += integratorNative;
            uint256 platformToken = amount * f.platformTokenShare / FEE_DENOMINATOR;
            if(platformToken != 0) _platformBalances[feeToken] += platformToken;
            uint256 integratorToken = amount - platformToken;
            if(integratorToken != 0) _balances[integrator][feeToken] += integratorToken;
            emit FeesCollected(integrator,feeToken,platformNative,platformToken,integratorNative,integratorToken);
       }
    }

    function withdrawIntegratorFees(address[] calldata tokenAddresses)external {
        uint256 length = tokenAddresses.length;
        uint256 balance;
        for (uint256 i = 0; i < length; ) {
            balance = _balances[msg.sender][tokenAddresses[i]];
            if (balance != 0) {
                _balances[msg.sender][tokenAddresses[i]] = 0;
                 Helper._transfer(tokenAddresses[i],msg.sender,balance);
                emit FeesWithdrawn(tokenAddresses[i], msg.sender, balance);
            }
            unchecked {
                ++i;
            }
        }
    }


    function withdrawPlatformFees(address[] memory tokenAddresses) external onlyOwner{
        uint256 length = tokenAddresses.length;
        uint256 balance;
        for (uint256 i = 0; i < length; ) {
            balance = _platformBalances[tokenAddresses[i]];
            _platformBalances[tokenAddresses[i]] = 0;
            if(balance != 0){
                Helper._transfer(tokenAddresses[i],msg.sender,balance);
                emit PlatformFeesWithdrawn(tokenAddresses[i], msg.sender, balance);
            }
            unchecked {
                ++i;
            }
        }
    } 

    function getFee(address integrator, address inpputToken,uint256 inputAmount) external view override returns(address feeToken,uint256 amount,uint256 nativeAmount){
          return _getFee(integrator,inpputToken,inputAmount);
    }


    function integratorFeeInfo(address integrator) external view returns(IntegratorFeeInfo memory){
        return feeStruct.integratorToFeeInfo[integrator];
    }

    function getAmountBeforeFee(address integrator, address inpputToken,uint256 inputAmount)external view override returns(address feeToken,uint256 beforeAmount){
         feeToken = inpputToken;
         IntegratorFeeInfo storage f =  feeStruct.integratorToFeeInfo[integrator];
         if(f.feeType == FeeType.NULL){

                if(feeStruct.feeType == FeeType.FIXED){
                    if(Helper._isNative(inpputToken)){
                        beforeAmount = inputAmount + feeStruct.fixedPlatformNativeFee + feeStruct.platformTokenFee;
                    } else {
                        beforeAmount = inputAmount + feeStruct.platformTokenFee;
                    }
                } else if(feeStruct.feeType == FeeType.RATIO){
                    if(Helper._isNative(inpputToken)){
                        beforeAmount = (inputAmount + feeStruct.fixedPlatformNativeFee) * FEE_DENOMINATOR / (FEE_DENOMINATOR - feeStruct.platformTokenFee) + 1;
                    } else {
                        beforeAmount = inputAmount *  FEE_DENOMINATOR / (FEE_DENOMINATOR - feeStruct.platformTokenFee) + 1;
                    }
                } else {
                beforeAmount = inputAmount;
                }

          } else {

                if(f.feeType == FeeType.FIXED){
                    if(Helper._isNative(inpputToken)){
                        beforeAmount = inputAmount + f.fixedNativeAmount + f.tokenFee;
                    } else {
                        beforeAmount = inputAmount + f.tokenFee;
                    }
                } else {
                    if(Helper._isNative(inpputToken)){
                        beforeAmount = (inputAmount + f.fixedNativeAmount) * FEE_DENOMINATOR / (FEE_DENOMINATOR - f.tokenFee) + 1;
                    } else {
                        beforeAmount = inputAmount *  FEE_DENOMINATOR / (FEE_DENOMINATOR - f.tokenFee) + 1;
                    }
                }
        
       }
    }



    function _getFee(address integrator, address inpputToken,uint256 inputAmount) internal view returns(address feeToken,uint256 amount,uint256 nativeAmount) {
          IntegratorFeeInfo storage f =  feeStruct.integratorToFeeInfo[integrator];
          feeToken = inpputToken;

          if(f.feeType == FeeType.NULL){

                if(feeStruct.feeType == FeeType.FIXED){
                    nativeAmount = feeStruct.fixedPlatformNativeFee;
                    if(Helper._isNative(inpputToken)){
                        nativeAmount += feeStruct.platformTokenFee;
                        amount = 0;
                    } else {
                        amount = feeStruct.platformTokenFee;
                    }
                } else if(feeStruct.feeType == FeeType.RATIO){
                    nativeAmount = feeStruct.fixedPlatformNativeFee;
                    if(Helper._isNative(inpputToken)){
                        nativeAmount += inputAmount* feeStruct.platformTokenFee / FEE_DENOMINATOR;
                    } else {
                        amount = inputAmount * feeStruct.platformTokenFee / FEE_DENOMINATOR;
                    }
                } else {
                    amount = 0;
                    nativeAmount = 0;
                }

          } else {

                nativeAmount = uint256(f.fixedNativeAmount);
                if(f.feeType == FeeType.FIXED){
                    if(Helper._isNative(inpputToken)){
                        nativeAmount += f.tokenFee;
                        amount = 0;
                    } else {
                        amount = f.tokenFee;
                    }
                } else {
                    if(Helper._isNative(inpputToken)){
                        nativeAmount += inputAmount * f.tokenFee / FEE_DENOMINATOR;
                        amount = 0;
                    } else {
                        amount = inputAmount * f.tokenFee / FEE_DENOMINATOR;
                    }
                }

          }
          
    }


    function getTokenBalance(address integrator, address token)external view returns(uint256) {
        return _balances[integrator][token];
    }


    function getButterBalance(address token)external view returns(uint256) {
        return _platformBalances[token];
    }

    
}