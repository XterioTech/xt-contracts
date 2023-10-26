// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC1155.sol";
import "./management/GatewayGuardedOwnable.sol";
import "@limitbreak/creator-token-contracts/contracts/erc1155c/ERC1155C.sol";
import "@limitbreak/creator-token-contracts/contracts/access/OwnableBasic.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract BasicERC1155C is
    IBasicERC1155,
    ERC2771Context,
    ERC1155Burnable,
    ERC1155C,
    OwnableBasic,
    GatewayGuardedOwnable,
    Pausable
{
    uint256 public constant VERSION_BasicERC1155C = 20231026;

    /**
     * @param _gateway NFTGateway contract of the NFT contract.
     */
    constructor(
        string memory _uri,
        address _gateway,
        address trustedForwarder
    )
        GatewayGuarded(_gateway)
        ERC2771Context(trustedForwarder)
        ERC1155OpenZeppelin(_uri)
    {}

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override onlyGatewayOrOwner {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override onlyGatewayOrOwner {
        _mintBatch(to, ids, amounts, data);
    }

    function mintAirdrop(
        address[] calldata accounts,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override onlyGatewayOrOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _mint(accounts[i], id, amount, data);
        }
    }

    function uri(uint256) public view override returns (string memory) {
        return
            string(
                abi.encodePacked(
                    super.uri(0),
                    "/",
                    Strings.toHexString(uint160(address(this)), 20),
                    "/{id}"
                )
            );
    }

    function contractURI() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    super.uri(0),
                    "/",
                    Strings.toHexString(uint160(address(this)), 20)
                )
            );
    }

    function setURI(
        string calldata newuri
    ) external override onlyGatewayOrOwner {
        _setURI(newuri);
    }

    function pause() external onlyGatewayOrOwner {
        _pause();
    }

    function unpause() external onlyGatewayOrOwner {
        _unpause();
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155C, ERC1155) {
        _requireNotPaused();
        ERC1155C._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function _afterTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155C, ERC1155) {
        ERC1155C._afterTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, ERC1155C) returns (bool) {
        return
            interfaceId == type(IBasicERC1155).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _msgSender()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }
}
