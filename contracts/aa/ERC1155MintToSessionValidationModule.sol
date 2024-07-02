// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ERC1155MintToSessionValidationModule {
    // execute(address,uint256,bytes)
    bytes4 public constant EXECUTE_SELECTOR = 0xb61d27f6;
    // execute_ncC(address,uint256,bytes)
    bytes4 public constant EXECUTE_OPTIMIZED_SELECTOR = 0x0000189a;

    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    /**
     * @dev validates if the _op (UserOperation) matches the SessionKey permissions
     * and that _op has been signed by this SessionKey
     * Please mind the decimals of your exact token when setting maxAmount
     * @param _op User Operation to be validated.
     * @param _userOpHash Hash of the User Operation to be validated.
     * @param _sessionKeyData SessionKey data, that describes sessionKey permissions
     * @param _sessionKeySignature Signature over the the _userOpHash.
     * @return true if the _op is valid, false otherwise.
     */
    function validateSessionUserOp(
        UserOperation calldata _op,
        bytes32 _userOpHash,
        bytes calldata _sessionKeyData,
        bytes calldata _sessionKeySignature
    ) external pure returns (bool) {
        require(
            bytes4(_op.callData[0:4]) == EXECUTE_OPTIMIZED_SELECTOR ||
                bytes4(_op.callData[0:4]) == EXECUTE_SELECTOR,
            "ERC1155MT Invalid Selector"
        );

        (address sessionKey, address recipient, uint256 tokenId) = abi.decode(
            _sessionKeyData,
            (address, address, uint256)
        );

        {
            // we expect _op.callData to be `SmartAccount.execute(to, value, calldata)` calldata
            (address _tokenAddress, uint256 callValue, ) = abi.decode(
                _op.callData[4:], // skip selector
                (address, uint256, bytes)
            );
            require(
                _tokenAddress == 0xBa739E856137D318254416883e5a1Ed01C7f2A3d,
                "ERC1155MT Wrong Token"
            );
            require(callValue == 0, "ERC1155MT Non Zero Value");
        }

        // // working with userOp.callData
        // // check if the call is to the allowed recepient and amount is not more than allowed
        bytes calldata data;

        {
            //offset represents where does the inner bytes array start
            uint256 offset = uint256(bytes32(_op.callData[4 + 64:4 + 96]));
            uint256 length = uint256(
                bytes32(_op.callData[4 + offset:4 + offset + 32])
            );

            data = _op.callData[4 + offset + 32:4 + offset + 32 + length];
        }

        (address recipientCalled, uint256 _tokenId, uint256 _amount) = abi
            .decode(data[4:], (address, uint256, uint256));

        require(recipientCalled == recipient, "ERC1155MT Wrong Recipient");
        require(tokenId == _tokenId, "ERC1155MT Wrong Token");
        require(_amount == 1, "ERC1155MT Wrong Amount");

        bytes32 userOpHash = _userOpHash;

        return
            ECDSA.recover(
                ECDSA.toEthSignedMessageHash(userOpHash),
                _sessionKeySignature
            ) == sessionKey;
    }
}
