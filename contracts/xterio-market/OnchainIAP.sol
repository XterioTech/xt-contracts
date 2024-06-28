// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract OnchainIAP is AccessControl {
    using SafeERC20 for IERC20;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Product {
        uint32 productId;
        uint32 priceDecimals;
        address paymentRecipient;
        mapping(uint256 => SKU) skus;
        mapping(address => PaymentMethod) paymentMethods;
    }

    struct SKU {
        uint32 skuIndex;
        uint32 amount;
        bool disabled;
        uint256 price;
    }

    struct PaymentMethod {
        address paymentTokenAddress;
        bool paused;
        bool isFixedRate;
        uint256 numerator;
        uint256 denominator;
        address numeratorOracle;
        address denominatorOracle;
    }

    mapping(uint32 => Product) public products;

    event PurchaseSuccess(
        address indexed buyer,
        uint32 indexed productId,
        uint32 indexed skuIndex,
        address paymentTokenAddress,
        uint256 paymentAmount,
        uint32 amount
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    /****************** Admin Func ******************/
    function registerProduct(
        uint32 _productId,
        uint32 _priceDecimals,
        address _paymentRecipient
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId].productId = _productId;
        products[_productId].priceDecimals = _priceDecimals;
        products[_productId].paymentRecipient = _paymentRecipient;
    }

    function registerSKU(
        uint32 _productId,
        uint32 _skuId,
        uint256 _price,
        uint32 _amount,
        bool _disabled
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId].skus[_skuId] = SKU(
            _skuId,
            _amount,
            _disabled,
            _price
        );
    }

    function setDisableSKU(
        uint32 _productId,
        uint32 _skuId,
        bool isDisable
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId].skus[_skuId].disabled = isDisable;
    }

    function registerPaymentMethod(
        uint32 _productId,
        address _paymentTokenAddress,
        bool _isFixedRate,
        uint256 _numerator,
        uint256 _denominator,
        address _numeratorOracle,
        address _denominatorOracle
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId].paymentMethods[
            _paymentTokenAddress
        ] = PaymentMethod(
            _paymentTokenAddress,
            false,
            _isFixedRate,
            _numerator,
            _denominator,
            _numeratorOracle,
            _denominatorOracle
        );
    }

    function setPausePaymentMethod(
        uint32 _productId,
        address _paymentTokenAddress,
        bool _pause
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId]
            .paymentMethods[_paymentTokenAddress]
            .paused = _pause;
    }

    /****************** Core Func ******************/
    function purchaseSKU(
        uint32 _productId,
        uint32 _skuId,
        address _paymentTokenAddress
    ) public payable {
        Product storage product = products[_productId];
        SKU memory sku = product.skus[_skuId];
        PaymentMethod memory _pay = product.paymentMethods[
            _paymentTokenAddress
        ];

        require(!sku.disabled, "SKU is disabled");
        require(!_pay.paused, "Payment method is paused");

        (uint256 totalPrice, ) = getPriceForSKU(
            _productId,
            _skuId,
            _paymentTokenAddress
        );
        require(totalPrice > 0, "Invalid totalPrice");

        address recipient = product.paymentRecipient;
        if (_paymentTokenAddress == address(0)) {
            require(msg.value >= totalPrice, "Insufficient payment");
            (bool success, ) = recipient.call{value: totalPrice}("");
            require(success, "Transfer failed");
        } else {
            IERC20(_paymentTokenAddress).safeTransferFrom(
                msg.sender,
                recipient,
                totalPrice
            );
        }

        emit PurchaseSuccess(
            msg.sender,
            _productId,
            _skuId,
            _paymentTokenAddress,
            totalPrice,
            sku.amount
        );
    }

    function getPriceForSKU(
        uint32 _productId,
        uint32 _skuId,
        address _paymentTokenAddress
    ) public view returns (uint256 totalPrice, uint8 decimals) {
        Product storage product = products[_productId];
        SKU memory sku = product.skus[_skuId];
        PaymentMethod memory _pay = product.paymentMethods[
            _paymentTokenAddress
        ];

        uint256 priceRaw;
        if (_pay.isFixedRate) {
            priceRaw = (sku.price * _pay.numerator) / _pay.denominator;
        } else {
            uint256 numerator = _pay.numeratorOracle == address(0)
                ? 1
                : getOracleLatestAnswer(_pay.numeratorOracle);
            uint256 numeratorDecimals = _pay.numeratorOracle == address(0)
                ? 1
                : getOracleDecimals(_pay.numeratorOracle);
            uint256 denominator = _pay.denominatorOracle == address(0)
                ? 1
                : getOracleLatestAnswer(_pay.denominatorOracle);
            uint256 denominatorDecimals = _pay.denominatorOracle == address(0)
                ? 1
                : getOracleDecimals(_pay.denominatorOracle);
            priceRaw =
                (sku.price * numerator * (10 ** denominatorDecimals)) /
                denominator /
                (10 ** numeratorDecimals);
        }

        if (_paymentTokenAddress == address(0)) {
            totalPrice = (priceRaw * 10 ** 18) / (10 ** product.priceDecimals);
            decimals = 18;
        } else {
            totalPrice =
                (priceRaw * 10 ** decimals) /
                (10 ** product.priceDecimals);
            decimals = IERC20Metadata(_paymentTokenAddress).decimals();
        }
        return (totalPrice, decimals);
    }

    /**
     * Returns the latest answer.
     */
    function getOracleLatestAnswer(
        address _chainlinkOracleAddress
    ) public view returns (uint256) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int256 answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = AggregatorV3Interface(_chainlinkOracleAddress).latestRoundData();

        return uint256(answer);
    }

    function getOracleDecimals(
        address _chainlinkOracleAddress
    ) public view returns (uint256 decimals) {
        decimals = AggregatorV3Interface(_chainlinkOracleAddress).decimals();
    }

    /****************** View Func ******************/
    function getProductInfo(
        uint32 _productId
    ) public view returns (uint32, uint32, address) {
        Product storage product = products[_productId];
        return (
            product.productId,
            product.priceDecimals,
            product.paymentRecipient
        );
    }

    function getProductSKUInfo(
        uint32 _productId,
        uint32 _skuId
    ) public view returns (uint32, uint32, bool, uint256) {
        SKU memory sku = products[_productId].skus[_skuId];
        return (sku.skuIndex, sku.amount, sku.disabled, sku.price);
    }

    function getProductPaymentMethodInfo(
        uint32 _productId,
        address _paymentTokenAddress
    ) public view returns (bool, bool, uint256, uint256, address, address) {
        PaymentMethod memory _pay = products[_productId].paymentMethods[
            _paymentTokenAddress
        ];
        return (
            _pay.paused,
            _pay.isFixedRate,
            _pay.numerator,
            _pay.denominator,
            _pay.numeratorOracle,
            _pay.denominatorOracle
        );
    }
}
