// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library MinHeapAuction {
    struct AuctionInfo {
        address bidder;
        uint256 price;
        uint256 timestamp;
    }

    struct Heap {
        uint256 MAX_CAPACITY;
        AuctionInfo[] tree;
    }

    event AuctionInserted(AuctionInfo auction);
    event AuctionExtracted(AuctionInfo auction);

    function isFull(Heap storage heap) public view returns (bool) {
        return heap.tree.length >= heap.MAX_CAPACITY;
    }

    function totalCnt(Heap storage heap) external view returns (uint256) {
        return heap.tree.length;
    }

    function getMin(
        Heap storage heap
    ) external view returns (AuctionInfo memory) {
        require(heap.tree.length > 0, "Heap is empty");
        return heap.tree[0];
    }

    function canInsert(
        Heap storage heap,
        uint256 price
    ) external view returns (bool) {
        AuctionInfo memory newAuction = AuctionInfo(
            msg.sender,
            price,
            block.timestamp
        );
        return !isFull(heap) || isHigherBid(newAuction, heap.tree[0]);
    }

    function insert(
        Heap storage heap,
        AuctionInfo calldata newAuction
    ) external {
        require(newAuction.price > 0, "Price must be greater than zero");

        if (isFull(heap)) {
            require(
                isHigherBid(newAuction, heap.tree[0]),
                "Heap is full, value to be inserted should be smaller"
            );
            heap.tree[0] = newAuction;
            heapifyDown(heap, 0);
        } else {
            heap.tree.push(newAuction);
            heapifyUp(heap, heap.tree.length - 1);
        }

        emit AuctionInserted(newAuction);
    }

    function extractMin(
        Heap storage heap
    ) external returns (AuctionInfo memory) {
        require(heap.tree.length > 0, "Heap is empty");

        AuctionInfo memory root = heap.tree[0];
        AuctionInfo memory lasttree = heap.tree[heap.tree.length - 1];
        heap.tree.pop();

        if (heap.tree.length > 0) {
            heap.tree[0] = lasttree;
            heapifyDown(heap, 0);
        }

        emit AuctionExtracted(root);

        return root;
    }

    function heapifyUp(Heap storage heap, uint256 index) private {
        while (index > 0) {
            uint256 parentIndex = (index - 1) / 2;
            if (isHigherBid(heap.tree[index], heap.tree[parentIndex])) {
                break;
            }

            swap(heap, index, parentIndex);
            index = parentIndex;
        }
    }

    function heapifyDown(Heap storage heap, uint256 index) private {
        uint256 smallest = index;
        uint256 leftChild = 2 * index + 1;
        uint256 rightChild = 2 * index + 2;

        if (
            leftChild < heap.tree.length &&
            isHigherBid(heap.tree[smallest], heap.tree[leftChild])
        ) {
            smallest = leftChild;
        }

        if (
            rightChild < heap.tree.length &&
            isHigherBid(heap.tree[smallest], heap.tree[rightChild])
        ) {
            smallest = rightChild;
        }

        if (smallest != index) {
            swap(heap, smallest, index);
            heapifyDown(heap, smallest);
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

    function swap(Heap storage heap, uint256 index1, uint256 index2) private {
        AuctionInfo memory temp = heap.tree[index1];
        heap.tree[index1] = heap.tree[index2];
        heap.tree[index2] = temp;
    }
}
