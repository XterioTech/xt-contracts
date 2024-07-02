// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

contract ContractAddressSessionValidationModule {
    // execute(address,uint256,bytes)
    bytes4 public constant EXECUTE_SELECTOR = 0xb61d27f6;
    // execute_ncC(address,uint256,bytes)
    bytes4 public constant EXECUTE_OPTIMIZED_SELECTOR = 0x0000189a;

    /**
     * @dev validates if the _op (UserOperation) matches the SessionKey permissions
     * and that _op has been signed by this SessionKey
     * @param _op User Operation to be validated.
     * @param _userOpHash Hash of the User Operation to be validated.
     * @param _sessionKeyData SessionKey data, that describes sessionKey permissions
     * @param _sessionKeySignature Signature over the the _userOpHash.
     * @return true if the _op is valid, false otherwise.
     */
    function validateSessionUserOp(
        PackedUserOperation calldata _op,
        bytes32 _userOpHash,
        bytes calldata _sessionKeyData,
        bytes calldata _sessionKeySignature
    ) external pure returns (bool) {
        require(
            bytes4(_op.callData[0:4]) == EXECUTE_OPTIMIZED_SELECTOR ||
                bytes4(_op.callData[0:4]) == EXECUTE_SELECTOR,
            "CASV Invalid Selector"
        );

        (address sessionKey, address[] memory ContractAddresses) = abi.decode(
            _sessionKeyData,
            (address, address[])
        );

        {
            // we expect _op.callData to be `SmartAccount.execute(to, value, calldata)` calldata
            (address TargetContractAddress, uint256 callValue, ) = abi.decode(
                _op.callData[4:], // skip selector
                (address, uint256, bytes)
            );
            uint256 len = ContractAddresses.length;
            bool exist;
            for (uint256 i; i < len; ) {
                if (ContractAddresses[i] == TargetContractAddress) {
                    exist = true;
                    break;
                }
                unchecked {
                    ++i;
                }
            }
            require(exist, "CASV Wrong Target Contract Address");
            require(callValue == 0, "CASV Non Zero Value");
        }

        return
            ECDSA.recover(
                ECDSA.toEthSignedMessageHash(_userOpHash),
                _sessionKeySignature
            ) == sessionKey;
    }
}
