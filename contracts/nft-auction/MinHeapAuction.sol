// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct AuctionInfo {
    uint256 price;
    uint256 timestamp;
}

contract MinHeapAuction {
    uint256 private constant MAX_CAPACITY = 5;
    AuctionInfo[] private heap;

    event AuctionInserted(AuctionInfo auction);
    event AuctionExtracted(AuctionInfo auction);

    function insert(AuctionInfo calldata newAuction) external {
        require(newAuction.price > 0, "Price must be greater than zero");

        if (heap.length >= MAX_CAPACITY) {
            require(
                isHigherBid(newAuction, heap[0]),
                "Heap is full, value to be inserted should be smaller"
            );
            heap[0] = newAuction;
            heapifyDown(0);
        } else {
            heap.push(newAuction);
            heapifyUp(heap.length - 1);
        }

        emit AuctionInserted(newAuction);
    }

    function getMin() external view returns (AuctionInfo memory) {
        require(heap.length > 0, "Heap is empty");
        return heap[0];
    }

    function extractMin() external returns (AuctionInfo memory) {
        require(heap.length > 0, "Heap is empty");

        AuctionInfo memory root = heap[0];
        AuctionInfo memory lastNode = heap[heap.length - 1];
        heap.pop();

        if (heap.length > 0) {
            heap[0] = lastNode;
            heapifyDown(0);
        }

        emit AuctionExtracted(root);

        return root;
    }

    function heapifyUp(uint256 index) private {
        while (index > 0) {
            uint256 parentIndex = (index - 1) / 2;
            if (isHigherBid(heap[index], heap[parentIndex])) {
                break;
            }

            swap(index, parentIndex);
            index = parentIndex;
        }
    }

    function heapifyDown(uint256 index) private {
        uint256 smallest = index;
        uint256 leftChild = 2 * index + 1;
        uint256 rightChild = 2 * index + 2;

        if (
            leftChild < heap.length &&
            isHigherBid(heap[smallest], heap[leftChild])
        ) {
            smallest = leftChild;
        }

        if (
            rightChild < heap.length &&
            isHigherBid(heap[smallest], heap[rightChild])
        ) {
            smallest = rightChild;
        }

        if (smallest != index) {
            swap(smallest, index);
            heapifyDown(smallest);
        }
    }

    function isHigherBid(
        AuctionInfo memory newAuction,
        AuctionInfo memory oldAuction
    ) private pure returns (bool) {
        if (newAuction.price != oldAuction.price) {
            return newAuction.price > oldAuction.price;
        }
        return newAuction.timestamp < oldAuction.timestamp;
    }

    function swap(uint256 index1, uint256 index2) private {
        AuctionInfo memory temp = heap[index1];
        heap[index1] = heap[index2];
        heap[index2] = temp;
    }
}
