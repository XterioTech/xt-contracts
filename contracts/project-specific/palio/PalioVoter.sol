// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract PalioVoter is Ownable {
    using EnumerableSet for EnumerableSet.UintSet;

    uint256 public constant CHAPTER_PERIOD = 7 * 24 * 60 * 60; // seconds for one chapter
	
    address public signer;

    uint256 public characterCnt;

    uint256[] public totalVotes;
    // address => character_idx => count
    mapping(address => mapping(uint256 => uint256)) public votedAmt;

    uint256 public eventStartTime; // event start time

    EnumerableSet.UintSet eliminatedCharacters;

    constructor(
        address _signer, 
        uint256 _characterCnt,
        uint256 _eventStartTime
    ) {
        signer = _signer;
        characterCnt = _characterCnt;
        eventStartTime = _eventStartTime;
    }

    function chapterIndex() public view returns (uint256) {
        require(block.timestamp >= eventStartTime, "PalioVoter: event not started");

        uint256 index = (block.timestamp - eventStartTime) / CHAPTER_PERIOD;
        if (index >= characterCnt - 1) {
            return characterCnt - 1;
        } else {
            return index;
        }
    }

    function getVotedAmt(address voter) public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](characterCnt);

        for (uint256 i = 0; i < characterCnt; i++) {
            result[i] = votedAmt[voter][i];
        }

        return result;
    }

	function vote(
        uint256 characterIdx,
        uint256 amount,
        uint256 expireTime,
        bytes calldata _sig
    ) external {
		// Check signature validity
        bytes32 inputHash = _getInputHash(
            characterIdx,
            amount,
            expireTime
        );
        _checkSigValidity(inputHash, _sig, signer);

        if (eliminatedCharacters.length() < chapterIndex()) {
            updateEliminatedCharacters();
        }

        require(!eliminatedCharacters.contains(characterIdx), 'This character has been eliminated.');

        require(amount > 0, 'Invalid vote amount.');
        require(block.timestamp < expireTime, 'signature expired.');
        
        votedAmt[msg.sender][characterIdx] += amount;
        totalVotes[characterIdx] += amount;
	}

    function updateEliminatedCharacters() public {
        require(eliminatedCharacters.length() < chapterIndex(), 'Elimination for current chapter has already been done.');

        uint256 minVotes = type(uint256).max;
        uint256 minCharacterIdx;

        for (uint256 i = 0; i < totalVotes.length; i++) {
            if (!eliminatedCharacters.contains(i) && totalVotes[i] < minVotes) {
                minVotes = totalVotes[i];
                minCharacterIdx = i;
            }
        }

        eliminatedCharacters.add(minCharacterIdx);
    }

    function getEliminatedCharacters() public view returns (uint256[] memory) {
        return eliminatedCharacters.values();
    }


	function _getInputHash(
        uint256 characterIdx,
        uint256 amount,
        uint256 expireTime
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    characterIdx,
					amount,
                    expireTime,
                    block.chainid,
                    address(this)
                )
            );
    }

    function _checkSigValidity(
        bytes32 hash,
        bytes memory sig,
        address _signer
    ) internal pure {
        require(
            _signer == ECDSA.recover(_getEthSignedMessageHash(hash), sig),
            "PalioVoter: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }
}
