// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract PalioVoter is Ownable {
    using EnumerableSet for EnumerableSet.UintSet;

    uint256 public constant CHAPTER_PERIOD = 7 * 24 * 60 * 60; // seconds for one chapter

    uint256 public constant CHARACTER_CNT = 5;
	
    address public signer;

    uint256[] public votes;

    // address => character_idx => count
    mapping(address => mapping(uint256 => uint256)) public votedAmt;
    
    // address => all characters count
    mapping(address => uint256) public userVotedAmt;

    uint256 public eventStartTime; // event start time

    EnumerableSet.UintSet eliminatedCharacters;

    constructor(
        address _signer, 
        uint256 _eventStartTime
    ) {
        signer = _signer;
        eventStartTime = _eventStartTime;
    }

    function chapterIndex() public view returns (uint256) {
        require(block.timestamp >= eventStartTime, "PalioVoter: event not started");

        uint256 index = (block.timestamp - eventStartTime) / CHAPTER_PERIOD;
        if (index >= CHARACTER_CNT - 1) {
            return CHARACTER_CNT - 1;
        } else {
            return index;
        }
    }

    function getVotedAmt(address voter) public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](CHARACTER_CNT);

        for (uint256 i = 0; i < CHARACTER_CNT; i++) {
            result[i] = votedAmt[voter][i];
        }

        return result;
    }

	function vote(
        uint256 characterIdx,
        uint256 amount,
        uint256 totalAmount,
        uint256 expireTime,
        bytes calldata _sig
    ) external {
		// Check signature validity
        bytes32 inputHash = _getInputHash(
            characterIdx,
            amount,
            totalAmount,
            expireTime
        );
        _checkSigValidity(inputHash, _sig, signer);

        if (eliminatedCharacters.length() < chapterIndex()) {
            updateEliminatedCharacters();
        }

        require(!eliminatedCharacters.contains(characterIdx), 'This character has been eliminated.');

        require(amount > 0, 'Invalid vote amount.');
        require(block.timestamp < expireTime, 'signature expired.');

        require(userVotedAmt[msg.sender] + amount <= totalAmount, 'Not enough votes');
        
        votes[characterIdx] += amount;
        votedAmt[msg.sender][characterIdx] += amount;
        userVotedAmt[msg.sender] += amount;
	}

    function findMinCharacterId() public view returns (uint256) {
        uint256 minVotes = type(uint256).max;
        uint256 minCharacterIdx;

        for (uint256 i = 0; i < votes.length; i++) {
            if (!eliminatedCharacters.contains(i) && votes[i] < minVotes) {
                minVotes = votes[i];
                minCharacterIdx = i;
            }
        }
        return minCharacterIdx;
    }

    function updateEliminatedCharacters() public {
        require(eliminatedCharacters.length() < chapterIndex(), 'Elimination for current chapter has already been done.');
        eliminatedCharacters.add(findMinCharacterId());
    }

    function getEliminatedCharacters() public view returns (uint256[] memory) {
        if (eliminatedCharacters.length() < chapterIndex()) {
            uint256 minCharacterIdx = findMinCharacterId();
            uint256[] memory eliminatedIds = new uint256[](eliminatedCharacters.length() + 1);
            for (uint256 i = 0; i < eliminatedCharacters.length(); i++) {
                eliminatedIds[i] = eliminatedCharacters.at(i);
            }
            eliminatedIds[eliminatedCharacters.length()] = minCharacterIdx;
            return eliminatedIds;
        }
        return eliminatedCharacters.values();
    }

	function _getInputHash(
        uint256 characterIdx,
        uint256 amount,
        uint256 totalAmount,
        uint256 expireTime
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    characterIdx,
					amount,
                    totalAmount,
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
