// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract OnchainIAP is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Product {
        bool disabled;
        uint32 priceDecimals;
        address paymentRecipient;
        mapping(uint256 => SKU) skus;
        mapping(address => PaymentMethod) paymentMethods;
    }

    struct SKU {
        bool disabled;
        uint256 amount;
        uint256 price;
    }

    struct PaymentMethod {
        bool valid;
        bool isFixedRate;
        uint32 numerator;
        uint32 denominator;
        address numeratorOracle;
        address denominatorOracle;
    }

    struct PriceInfo {
        uint256 totalPrice;
        uint8 decimals;
    }

    mapping(uint32 => Product) public products;

    EnumerableSet.UintSet productIds;

    mapping(uint32 => EnumerableSet.UintSet) productSKUIds;

    event PurchaseSuccess(
        address indexed buyer,
        uint32 indexed productId,
        uint32 indexed skuId,
        address paymentTokenAddress,
        uint256 paymentAmount,
        uint256 amount
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    /****************** Modifiers ******************/

    modifier productExists(uint32 _productId) {
        require(
            productIds.contains(_productId),
            "OnchainIAP: productId not exist"
        );
        _;
    }

    modifier skuExists(uint32 _productId, uint32 _skuId) {
        require(
            productSKUIds[_productId].contains(_skuId),
            "OnchainIAP: SKU does not exist"
        );
        _;
    }

    /****************** Admin Func ******************/
    function registerProduct(
        uint32 _productId,
        uint32 _priceDecimals,
        address _paymentRecipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        products[_productId].priceDecimals = _priceDecimals;
        products[_productId].paymentRecipient = _paymentRecipient;

        productIds.add(_productId);
    }

    function setDisableProduct(
        uint32 _productId,
        bool isDisable
    ) external onlyRole(MANAGER_ROLE) productExists(_productId) {
        products[_productId].disabled = isDisable;
    }

    function updateProductPaymentRecipient(
        uint32 _productId,
        address _paymentRecipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) productExists(_productId) {
        products[_productId].paymentRecipient = _paymentRecipient;
    }

    function registerSKU(
        uint32 _productId,
        uint32 _skuId,
        uint256 _price,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        products[_productId].skus[_skuId] = SKU(false, _amount, _price);

        productSKUIds[_productId].add(_skuId);
    }

    function setDisableSKU(
        uint32 _productId,
        uint32 _skuId,
        bool isDisable
    ) external onlyRole(MANAGER_ROLE) skuExists(_productId, _skuId) {
        products[_productId].skus[_skuId].disabled = isDisable;
    }

    function registerPaymentMethod(
        uint32 _productId,
        address _paymentTokenAddress,
        bool _isFixedRate,
        uint32 _numerator,
        uint32 _denominator,
        address _numeratorOracle,
        address _denominatorOracle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) productExists(_productId) {
        products[_productId].paymentMethods[
            _paymentTokenAddress
        ] = PaymentMethod(
            true,
            _isFixedRate,
            _numerator,
            _denominator,
            _numeratorOracle,
            _denominatorOracle
        );
    }

    function setPaymentMethodValid(
        uint32 _productId,
        address _paymentTokenAddress,
        bool _isValid
    ) external onlyRole(MANAGER_ROLE) {
        products[_productId]
            .paymentMethods[_paymentTokenAddress]
            .valid = _isValid;
    }

    /****************** Core Func ******************/
    function purchaseSKU(
        uint32 _productId,
        uint32 _skuId,
        address _paymentTokenAddress
    )
        external
        payable
        nonReentrant
        productExists(_productId)
        skuExists(_productId, _skuId)
    {
        Product storage product = products[_productId];
        require(!product.disabled, "OnchainIAP: Product disabled");
        SKU memory sku = product.skus[_skuId];
        require(!sku.disabled, "OnchainIAP: SKU disabled");
        PaymentMethod memory _pay = product.paymentMethods[
            _paymentTokenAddress
        ];
        require(_pay.valid, "OnchainIAP: Invalid payment method");

        (uint256 totalPrice, ) = getPriceForSKU(
            _productId,
            _skuId,
            _paymentTokenAddress
        );
        require(totalPrice > 0, "OnchainIAP: Invalid totalPrice");

        address recipient = product.paymentRecipient;
        if (_paymentTokenAddress == address(0)) {
            require(
                msg.value >= totalPrice,
                "OnchainIAP: Insufficient payment"
            );
            bool success = payable(recipient).send(totalPrice);
            require(success, "OnchainIAP: Transfer to recipient failed");

            uint256 excess = msg.value - totalPrice;
            if (excess > 0) {
                bool refundSuccess = payable(msg.sender).send(excess);
                require(refundSuccess, "OnchainIAP: Refund to sender failed");
            }
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
                ? 0
                : getOracleDecimals(_pay.numeratorOracle);
            uint256 denominator = _pay.denominatorOracle == address(0)
                ? 1
                : getOracleLatestAnswer(_pay.denominatorOracle);
            uint256 denominatorDecimals = _pay.denominatorOracle == address(0)
                ? 0
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
            decimals = IERC20Metadata(_paymentTokenAddress).decimals();
            totalPrice =
                (priceRaw * 10 ** decimals) /
                (10 ** product.priceDecimals);
        }
        return (totalPrice, decimals);
    }

    function getBatchPricesForSKU(
        uint32 _productId,
        uint32 _skuId,
        address[] calldata _paymentTokenAddresses
    ) public view returns (PriceInfo[] memory) {
        PriceInfo[] memory priceInfos = new PriceInfo[](
            _paymentTokenAddresses.length
        );

        for (uint i = 0; i < _paymentTokenAddresses.length; i++) {
            (uint256 totalPrice, uint8 decimals) = getPriceForSKU(
                _productId,
                _skuId,
                _paymentTokenAddresses[i]
            );
            priceInfos[i] = PriceInfo({
                totalPrice: totalPrice,
                decimals: decimals
            });
        }

        return priceInfos;
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
    ) public view returns (uint32, address) {
        Product storage product = products[_productId];
        return (product.priceDecimals, product.paymentRecipient);
    }

    function getProductSKUInfo(
        uint32 _productId,
        uint32 _skuId
    ) public view returns (uint256, bool, uint256) {
        SKU memory sku = products[_productId].skus[_skuId];
        return (sku.amount, sku.disabled, sku.price);
    }

    function getProductPaymentMethodInfo(
        uint32 _productId,
        address _paymentTokenAddress
    ) public view returns (bool, bool, uint256, uint256, address, address) {
        PaymentMethod memory _pay = products[_productId].paymentMethods[
            _paymentTokenAddress
        ];
        return (
            _pay.valid,
            _pay.isFixedRate,
            _pay.numerator,
            _pay.denominator,
            _pay.numeratorOracle,
            _pay.denominatorOracle
        );
    }

    function listProductIds() public view returns (uint256[] memory) {
        return productIds.values();
    }

    function listSKUIds(
        uint32 _productId
    ) public view productExists(_productId) returns (uint256[] memory) {
        return productSKUIds[_productId].values();
    }
}
