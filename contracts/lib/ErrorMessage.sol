// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;



library ErrorMessage {

    string internal constant ZERO_IN = "Router: zero in";

    string internal constant FEE_MISMATCH = "Router: fee mismatch";

    string internal constant FEE_LOWER = "Router: lower than fee";

    string internal constant ZERO_ADDR = "Router: zero addr";

    string internal constant NOT_CONTRACT = "Router: not contract";

    string internal constant BRIDGE_REQUIRE = "Router: bridge data required";

    string internal constant RECEIVE_LOW = "Router: receive too low";

    string internal constant SWAP_FAIL = "Router: swap failed";

    string internal constant SWAP_REQUIRE = "Router: swap data required";

    string internal constant CALL_AMOUNT_INVALID = "Router: callback amount invalid";

    string internal constant CALL_FAIL = "Router: callback failed";

    string internal constant MOS_ONLY = "Router: mos only";

    string internal constant DATA_EMPTY = "Router: data empty";

    string internal constant NO_APPROVE = "Router:not approved";

    string internal constant NATIVE_VAULE_OVERSPEND = "Router: native value overspend";

}