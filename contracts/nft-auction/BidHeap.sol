// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library BidHeap {
    struct Bid {
        uint256 id;
        address bidder;
        uint256 price;
        uint256 timestamp;
    }

    struct Heap {
        uint256 MAX_CAPACITY;
        Bid[] tree;
    }

    event BidInserted(Bid bid);
    event BidExtracted(Bid bid);

    function isFull(Heap storage heap) public view returns (bool) {
        return heap.tree.length >= heap.MAX_CAPACITY;
    }

    function totalCnt(Heap storage heap) external view returns (uint256) {
        return heap.tree.length;
    }

    function getMin(Heap storage heap) external view returns (Bid memory) {
        require(heap.tree.length > 0, "Heap is empty");
        return heap.tree[0];
    }

    function canInsert(
        Heap storage heap,
        Bid calldata newBid
    ) external view returns (bool) {
        return !isFull(heap) || isHigherBid(newBid, heap.tree[0]);
    }

    function isInHeap(
        Heap storage heap,
        Bid memory _b
    ) external view returns (bool) {
        require(heap.tree.length > 0, "Heap is empty");
        return isHigherBid(_b, heap.tree[0]) || isEqualBid(_b, heap.tree[0]);
    }

    function insert(Heap storage heap, Bid calldata newBid) external {
        require(newBid.price > 0, "Price must be greater than zero");

        if (isFull(heap)) {
            require(
                isHigherBid(newBid, heap.tree[0]),
                "Heap is full, value to be inserted should be smaller"
            );
            heap.tree[0] = newBid;
            heapifyDown(heap, 0);
        } else {
            heap.tree.push(newBid);
            heapifyUp(heap, heap.tree.length - 1);
        }

        emit BidInserted(newBid);
    }

    function extractMin(Heap storage heap) external returns (Bid memory) {
        require(heap.tree.length > 0, "Heap is empty");

        Bid memory root = heap.tree[0];
        Bid memory lasttree = heap.tree[heap.tree.length - 1];
        heap.tree.pop();

        if (heap.tree.length > 0) {
            heap.tree[0] = lasttree;
            heapifyDown(heap, 0);
        }

        emit BidExtracted(root);

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
        Bid memory _b1,
        Bid memory _b2
    ) private pure returns (bool) {
        return
            (_b1.price > _b2.price) ||
            (_b1.price == _b2.price &&
                (_b1.timestamp < _b2.timestamp ||
                    (_b1.timestamp == _b2.timestamp && _b1.id < _b2.id)));
    }

    function isEqualBid(
        Bid memory _b1,
        Bid memory _b2
    ) private pure returns (bool) {
        return
            _b1.price == _b2.price &&
            _b1.timestamp == _b2.timestamp &&
            _b1.id == _b2.id;
    }

    function swap(Heap storage heap, uint256 index1, uint256 index2) private {
        Bid memory temp = heap.tree[index1];
        heap.tree[index1] = heap.tree[index2];
        heap.tree[index2] = temp;
    }
}
